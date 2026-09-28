import { describe, expect, test } from "bun:test";
import { jsPDF } from "jspdf";
import * as mupdf from "mupdf";
import {
	editPdf,
	editPdfWithDiagnostics,
	fitReplacementFontSize,
	PdfRenderer,
} from "./fileParser";
import type { PdfTextReplacement } from "../shared/types";

function searchableText(bytes: Uint8Array): string {
	const doc = new mupdf.PDFDocument(bytes);
	try {
		const page = doc.loadPage(0);
		try {
			const text = page.toStructuredText();
			try {
				return text.asText();
			} finally {
				text.destroy();
			}
		} finally {
			page.destroy();
		}
	} finally {
		doc.destroy();
	}
}

function embeddedFontPdf(text: string, subset = false): Buffer {
	const doc = new mupdf.PDFDocument();
	const font = new mupdf.Font(
		"KenPixel",
		`${import.meta.dir}/test-fixtures/kenpixel.ttf`,
	);
	try {
		const fonts = doc.newDictionary();
		fonts.put("F1", doc.addSimpleFont(font, "Latin"));
		const resources = doc.newDictionary();
		resources.put("Font", fonts);
		const hex = [...Buffer.from(text, "ascii")]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		const page = doc.addPage(
			[0, 0, 300, 150],
			0,
			resources,
			`BT /F1 24 Tf 30 70 Td <${hex}> Tj ET`,
		);
		doc.insertPage(-1, page);
		if (subset) doc.subsetFonts();
		const output = doc.saveToBuffer();
		try {
			return Buffer.from(output.asUint8Array());
		} finally {
			output.destroy();
		}
	} finally {
		font.destroy();
		doc.destroy();
	}
}

function pageFontNames(bytes: Uint8Array): string[] {
	const doc = new mupdf.PDFDocument(bytes);
	try {
		const page = doc.loadPage(0);
		try {
			const result: string[] = [];
			page.getObject().getInheritable("Resources").get("Font").resolve().forEach((value) => {
				const name = value.resolve().get("BaseFont");
				if (name.isName()) result.push(name.asName());
			});
			return result;
		} finally {
			page.destroy();
		}
	} finally {
		doc.destroy();
	}
}

describe("PDF text replacement", () => {
	test("extracts clickable words and saves replacement as searchable text", () => {
		const source = new jsPDF();
		source.text("Hello old world", 20, 20);
		const input = Buffer.from(source.output("arraybuffer"));
		const renderer = new PdfRenderer(input);
		const regions = renderer.extractTextRegions(1);
		renderer.destroy();

		expect(regions.map((region) => region.text)).toEqual(["Hello", "old", "world"]);
		const old = regions[1];
		const output = editPdf(input, [
			{
				pageNum: 1,
				replacements: [
					{
						regionId: old.id,
						originalText: old.text,
						text: "new",
						rect: old.rect,
						fontSize: old.fontSize,
						fontFamily: old.fontFamily,
						color: old.color,
					},
				],
				annotations: [],
			},
		]);

		const text = searchableText(output);
		expect(text).toContain("Hello");
		expect(text).toContain("new");
		expect(text).toContain("world");
		expect(text).not.toContain("old");
	});

	test("re-embeds the decoded original font with a safe encoding", () => {
		const input = embeddedFontPdf("Hello");
		const renderer = new PdfRenderer(input);
		const original = renderer.extractTextRegions(1)[0];
		renderer.destroy();
		expect(original.fontName).toBe("KenPixel");

		const result = editPdfWithDiagnostics(input, [{
			pageNum: 1,
			replacements: [{
				...original,
				regionId: original.id,
				originalText: original.text,
				text: "World",
			}],
			annotations: [],
		}]);
		expect(result.warnings).toEqual([]);
		expect(searchableText(result.data)).toContain("World");
		expect(pageFontNames(result.data).filter((name) => name.includes("KenPixel"))).toHaveLength(2);
	});

	test("uses and reports a style-compatible fallback when a subset lacks a glyph", () => {
		const input = embeddedFontPdf("Hello", true);
		const renderer = new PdfRenderer(input);
		const original = renderer.extractTextRegions(1)[0];
		renderer.destroy();

		const result = editPdfWithDiagnostics(input, [{
			pageNum: 1,
			replacements: [{
				...original,
				regionId: original.id,
				originalText: original.text,
				text: "Zoo",
			}],
			annotations: [],
		}]);
		expect(result.warnings.join(" ")).toMatch(/Helvetica.*not supported|could not be reused/);
		expect(searchableText(result.data)).toContain("Zoo");
		expect(pageFontNames(result.data)).toContain("Times-Roman");
	});

	test("uses real standard-font advances and rejects text below the 5pt floor", () => {
		const base: PdfTextReplacement = {
			regionId: "word",
			originalText: "short",
			text: "iii",
			rect: [0, 0, 30, 16],
			fontSize: 12,
			fontFamily: "Helvetica",
			color: [0, 0, 0],
		};
		const narrow = fitReplacementFontSize(base);
		const wide = fitReplacementFontSize({ ...base, text: "WWW" });
		expect(narrow).toBe(12);
		expect(wide).toBeLessThan(narrow);
		for (const fontFamily of ["Helvetica", "Times-Roman", "Courier"] as const) {
			expect(
				fitReplacementFontSize({ ...base, text: "fit", fontFamily }),
			).toBeGreaterThanOrEqual(5);
			expect(() =>
				fitReplacementFontSize({
					...base,
					text: "This replacement is much too long for the selected region",
					fontFamily,
				}),
			).toThrow(/cannot fit/);
		}
		expect(() => fitReplacementFontSize({ ...base, text: "snowman ☃" })).toThrow(
			/not supported/,
		);
		expect(fitReplacementFontSize({ ...base, text: "“ok”" })).toBeGreaterThanOrEqual(5);
		expect(() => fitReplacementFontSize({ ...base, text: "bad\u0080" })).toThrow(
			/Windows-1252/,
		);
	});

	test("maps Helvetica, Times, and Courier and excludes rotated glyph runs", () => {
		const source = new jsPDF();
		source.setFont("helvetica");
		source.text("sans", 20, 20);
		source.setFont("times");
		source.text("serif", 20, 30);
		source.setFont("courier");
		source.text("mono", 20, 40);
		source.text("rotated", 60, 60, { angle: 90 });
		const renderer = new PdfRenderer(Buffer.from(source.output("arraybuffer")));
		const regions = renderer.extractTextRegions(1);
		renderer.destroy();
		expect(regions.map(({ text, fontFamily }) => [text, fontFamily])).toEqual([
			["sans", "Helvetica"],
			["serif", "Times-Roman"],
			["mono", "Courier"],
		]);
	});

	test("preserves adjacent vector graphics and pre-existing annotations", () => {
		const source = new jsPDF();
		source.text("replace target", 20, 20);
		source.setFillColor(220, 20, 60);
		source.rect(70, 12, 20, 12, "F");
		const initial = new mupdf.PDFDocument(source.output("arraybuffer"));
		const initialPage = initial.loadPage(0);
		const note = initialPage.createAnnotation("Text");
		note.setRect([300, 50, 320, 70]);
		note.setContents("keep this note");
		note.update();
		const pendingRedaction = initialPage.createAnnotation("Redact");
		pendingRedaction.setRect([350, 50, 370, 70]);
		pendingRedaction.setContents("keep pending");
		pendingRedaction.update();
		initialPage.destroy();
		const withNote = initial.saveToBuffer();
		const input = Buffer.from(withNote.asUint8Array());
		withNote.destroy();
		initial.destroy();

		const renderer = new PdfRenderer(input);
		const target = renderer.extractTextRegions(1).find((region) => region.text === "target")!;
		renderer.destroy();
		const output = editPdf(input, [
			{
				pageNum: 1,
				replacements: [
					{
						regionId: target.id,
						originalText: target.text,
						text: "result",
						rect: target.rect,
						fontSize: target.fontSize,
						fontFamily: target.fontFamily,
						color: target.color,
					},
				],
				annotations: [],
			},
		]);

		const edited = new mupdf.PDFDocument(output);
		const editedPage = edited.loadPage(0);
		expect(
			editedPage
				.getAnnotations()
				.map((annotation) => [annotation.getType(), annotation.getContents()]),
		).toEqual([
			["Text", "keep this note"],
			["Redact", "keep pending"],
		]);
		const pixmap = editedPage.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB);
		const pixels = pixmap.getPixels();
		const sample = 45 * pixmap.getStride() + 210 * 3;
		expect(pixels[sample]).toBeGreaterThan(150);
		expect(pixels[sample + 1]).toBeLessThan(100);
		expect(pixels[sample + 2]).toBeLessThan(150);
		pixmap.destroy();
		editedPage.destroy();
		edited.destroy();
	});

	test("isolates inserted text from a nonidentity graphics state left by original contents", () => {
		const source = new jsPDF();
		source.text("old", 20, 20);
		const contaminated = new mupdf.PDFDocument(source.output("arraybuffer"));
		const page = contaminated.loadPage(0);
		const pageObject = page.getObject();
		const originalContents = pageObject.get("Contents");
		const contents = contaminated.newArray();
		contents.push(originalContents);
		contents.push(contaminated.addStream("2 0 0 2 100 100 cm\n", {}));
		pageObject.put("Contents", contents);
		page.destroy();
		const contaminatedBuffer = contaminated.saveToBuffer();
		const input = Buffer.from(contaminatedBuffer.asUint8Array());
		contaminatedBuffer.destroy();
		contaminated.destroy();

		const renderer = new PdfRenderer(input);
		const old = renderer.extractTextRegions(1)[0];
		renderer.destroy();
		const output = editPdf(input, [
			{
				pageNum: 1,
				replacements: [
					{
						regionId: old.id,
						originalText: old.text,
						text: "new",
						rect: old.rect,
						fontSize: old.fontSize,
						fontFamily: old.fontFamily,
						color: old.color,
					},
				],
				annotations: [],
			},
		]);
		const outputRenderer = new PdfRenderer(Buffer.from(output));
		const replacement = outputRenderer
			.extractTextRegions(1)
			.find((region) => region.text === "new");
		outputRenderer.destroy();
		expect(replacement).toBeDefined();
		expect(Math.abs(replacement!.rect[0] - old.rect[0])).toBeLessThan(2);
		expect(Math.abs(replacement!.baseline![1] - old.baseline![1])).toBeLessThan(0.1);
	});

	test("rejects unsupported overlay text instead of writing malformed simple-font bytes", () => {
		const source = new jsPDF();
		source.text("page", 20, 20);
		const input = Buffer.from(source.output("arraybuffer"));
		const valid = editPdf(input, [
			{
				pageNum: 1,
				replacements: [],
				annotations: [
					{
						type: "text",
						text: "€ “ok”",
						x: 10,
						y: 10,
						color: "#000000",
					},
				],
			},
		]);
		expect(searchableText(valid)).toContain("€ “ok”");
		expect(() =>
			editPdf(input, [
				{
					pageNum: 1,
					replacements: [],
					annotations: [
						{
							type: "text",
							text: "emoji 😀",
							x: 10,
							y: 10,
							color: "#000000",
						},
					],
				},
			]),
		).toThrow(/printable Windows-1252/);
	});
});
