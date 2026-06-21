import { test, expect, describe } from "bun:test";
import { docToBlocks, type ProseNode } from "./docExport";

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
