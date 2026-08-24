import { test, expect, describe } from "bun:test";
import {
	EMPTY_DOC,
	EMPTY_PAGE,
	changedPage,
	pageAnnotations,
	toExportAnnotations,
	withPage,
	type PageAnnotations,
} from "./annotations";

const text = (id: string, t = "hi"): PageAnnotations["texts"][number] => ({
	id,
	x: 10,
	y: 20,
	text: t,
	fontSize: 16,
	color: "#000",
});
const circle = (id: string): PageAnnotations["circles"][number] => ({
	id,
	cx: 50,
	cy: 50,
	rx: 5,
	ry: 5,
	color: "#f00",
	strokeWidth: 3,
});

describe("annotations document", () => {
	test("unset pages read as the shared empty page", () => {
		expect(pageAnnotations(EMPTY_DOC, 3)).toBe(EMPTY_PAGE);
	});

	test("withPage replaces one slice and leaves the others' identity intact", () => {
		const p1: PageAnnotations = { texts: [text("a")], circles: [] };
		const p2: PageAnnotations = { texts: [], circles: [circle("c")] };
		const doc = withPage(withPage(EMPTY_DOC, 1, p1), 2, p2);
		const next = withPage(doc, 2, EMPTY_PAGE);
		expect(pageAnnotations(next, 1)).toBe(p1);
		expect(pageAnnotations(next, 2)).toBe(EMPTY_PAGE);
		expect(pageAnnotations(doc, 2)).toBe(p2); // original untouched
	});

	test("changedPage finds the page that differs, including added and removed pages", () => {
		const p1: PageAnnotations = { texts: [text("a")], circles: [] };
		const doc = withPage(EMPTY_DOC, 4, p1);
		expect(changedPage(EMPTY_DOC, doc)).toBe(4);
		expect(changedPage(doc, EMPTY_DOC)).toBe(4);
		expect(changedPage(doc, doc)).toBeNull();
		const moved = withPage(doc, 4, { ...p1, texts: [text("a", "bye")] });
		expect(changedPage(doc, moved)).toBe(4);
	});

	test("toExportAnnotations flattens texts then circles and drops blank texts", () => {
		const page: PageAnnotations = {
			texts: [text("a", "keep"), text("b", "   ")],
			circles: [circle("c")],
		};
		expect(toExportAnnotations(page)).toEqual([
			{ type: "text", x: 10, y: 20, text: "keep", fontSize: 16, color: "#000" },
			{ type: "circle", cx: 50, cy: 50, rx: 5, ry: 5, color: "#f00", strokeWidth: 3 },
		]);
	});
});
