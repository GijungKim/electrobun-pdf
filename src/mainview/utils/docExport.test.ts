import { test, expect, describe } from "bun:test";
import { docToBlocks, layoutLines, type ProseNode, type TextSegment } from "./docExport";

describe("docToBlocks", () => {
	test("maps a heading with its level", () => {
		const doc: ProseNode = {
			type: "doc",
			content: [
				{
					type: "heading",
					attrs: { level: 2 },
					content: [{ type: "text", text: "Title" }],
				},
			],
		};
		expect(docToBlocks(doc)).toEqual([
			{ kind: "heading", level: 2, segments: [{ text: "Title", bold: false, italic: false }] },
		]);
	});

	test("captures bold and italic marks on text segments", () => {
		const doc: ProseNode = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", marks: [{ type: "bold" }], text: "B" },
						{ type: "text", text: " plain " },
						{ type: "text", marks: [{ type: "italic" }], text: "I" },
					],
				},
			],
		};
		expect(docToBlocks(doc)).toEqual([
			{
				kind: "paragraph",
				segments: [
					{ text: "B", bold: true, italic: false },
					{ text: " plain ", bold: false, italic: false },
					{ text: "I", bold: false, italic: true },
				],
			},
		]);
	});

	test("emits one listItem block per item, numbered for ordered lists", () => {
		const item = (t: string): ProseNode => ({
			type: "listItem",
			content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
		});
		const doc: ProseNode = {
			type: "doc",
			content: [{ type: "orderedList", content: [item("one"), item("two")] }],
		};
		const blocks = docToBlocks(doc);
		expect(blocks).toEqual([
			{ kind: "listItem", ordered: true, index: 1, segments: [{ text: "one", bold: false, italic: false }] },
			{ kind: "listItem", ordered: true, index: 2, segments: [{ text: "two", bold: false, italic: false }] },
		]);
	});

	test("bullet lists are unordered", () => {
		const doc: ProseNode = {
			type: "doc",
			content: [
				{
					type: "bulletList",
					content: [
						{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
					],
				},
			],
		};
		expect(docToBlocks(doc)[0]).toMatchObject({ kind: "listItem", ordered: false, index: 1 });
	});

	test("unknown node types degrade to a paragraph carrying their text (never dropped)", () => {
		const doc: ProseNode = {
			type: "doc",
			content: [
				{
					type: "table",
					content: [{ type: "paragraph", content: [{ type: "text", text: "cell" }] }],
				},
			],
		};
		expect(docToBlocks(doc)).toEqual([
			{ kind: "paragraph", segments: [{ text: "cell", bold: false, italic: false }] },
		]);
	});

	test("empty doc yields no blocks", () => {
		expect(docToBlocks({ type: "doc", content: [] })).toEqual([]);
	});
});

// Monospace measurer: every character is 1 unit wide, whatever the style.
const mono = (text: string) => text.length;
// Style-sensitive measurer: bold glyphs are twice as wide.
const boldWide = (text: string, bold: boolean) => text.length * (bold ? 2 : 1);

const seg = (text: string, bold = false, italic = false): TextSegment => ({ text, bold, italic });

describe("layoutLines", () => {
	test("keeps a short paragraph on one line, merging same-style tokens into one run", () => {
		expect(layoutLines([seg("hello world")], 80, mono)).toEqual([
			[{ text: "hello world", bold: false, italic: false, x: 0 }],
		]);
	});

	test("preserves style changes mid-line with the correct x offsets", () => {
		const lines = layoutLines([seg("a "), seg("bold", true), seg(" c", false, true)], 80, mono);
		expect(lines).toEqual([
			[
				{ text: "a ", bold: false, italic: false, x: 0 },
				{ text: "bold", bold: true, italic: false, x: 2 },
				{ text: " c", bold: false, italic: true, x: 6 },
			],
		]);
	});

	test("x offsets come from the measurer, so wider styles push later runs right", () => {
		const lines = layoutLines([seg("ab", true), seg("cd")], 80, boldWide);
		expect(lines[0]).toEqual([
			{ text: "ab", bold: true, italic: false, x: 0 },
			{ text: "cd", bold: false, italic: false, x: 4 },
		]);
	});

	test("wraps at whitespace and drops the space that would start the new line", () => {
		const lines = layoutLines([seg("one two three")], 7, mono);
		expect(lines.map((l) => l.map((r) => r.text).join(""))).toEqual(["one two", "three"]);
		expect(lines[1]?.[0]?.x).toBe(0);
	});

	test("a style run can straddle a line break", () => {
		const lines = layoutLines([seg("plain "), seg("bold words here", true)], 11, mono);
		expect(lines.map((l) => l.map((r) => [r.text, r.bold]))).toEqual([
			[["plain ", false], ["bold", true]],
			[["words here", true]],
		]);
	});

	test("hard breaks force a new line", () => {
		const lines = layoutLines([seg("a"), seg("\n"), seg("b")], 80, mono);
		expect(lines.map((l) => l.map((r) => r.text).join(""))).toEqual(["a", "b"]);
	});

	test("a word wider than the line is split by character instead of overflowing", () => {
		const lines = layoutLines([seg("abcdefgh")], 3, mono);
		expect(lines.map((l) => l.map((r) => r.text).join(""))).toEqual(["abc", "def", "gh"]);
	});

	test("empty input still yields one empty line", () => {
		expect(layoutLines([], 80, mono)).toEqual([[]]);
		expect(layoutLines([seg("")], 80, mono)).toEqual([[]]);
	});
});
