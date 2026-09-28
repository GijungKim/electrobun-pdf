import mammoth from "mammoth";
import * as mupdf from "mupdf";
import type {
	NativePdfPageEdits,
	PdfTextRegion,
	PdfTextReplacement,
	PdfFontStyle,
} from "../shared/types";

/**
 * Parse a DOCX file buffer into HTML
 */
export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
	// Mammoth's Node build only reads `buffer` (`arrayBuffer` is the browser
	// build's option). Buffer.from(ArrayBuffer) is a view, not a copy.
	const result = await mammoth.convertToHtml(
		{ buffer: Buffer.from(buffer) },
		{
			styleMap: [
				"p[style-name='Heading 1'] => h1:fresh",
				"p[style-name='Heading 2'] => h2:fresh",
				"p[style-name='Heading 3'] => h3:fresh",
			],
		},
	);

	if (result.messages.length > 0) {
		console.log("Mammoth conversion messages:", result.messages);
	}

	return result.value;
}

/**
 * Opens a MuPDF document once and provides methods to render pages.
 * Call destroy() when done to free resources.
 */
export class PdfRenderer {
	private doc: mupdf.Document;

	constructor(fileBuffer: Buffer) {
		this.doc = mupdf.Document.openDocument(fileBuffer, "application/pdf");
	}

	get pageCount(): number {
		return this.doc.countPages();
	}

	renderPage(pageNum: number, scale: number = 2): string {
		const page = this.doc.loadPage(pageNum - 1);
		try {
			const pixmap = page.toPixmap(
				mupdf.Matrix.scale(scale, scale),
				mupdf.ColorSpace.DeviceRGB,
				false,
				true,
			);
			try {
				const png = pixmap.asPNG();
				const base64 = Buffer.from(png).toString("base64");
				return `data:image/png;base64,${base64}`;
			} finally {
				pixmap.destroy();
			}
		} finally {
			page.destroy();
		}
	}

	extractTextRegions(pageNum: number): PdfTextRegion[] {
		const page = this.doc.loadPage(pageNum - 1);
		try {
			const words = extractPageWords(page, pageNum);
			return words.map(({ font, ...region }) => {
				font.destroy();
				return region;
			});
		} finally {
			page.destroy();
		}
	}

	destroy(): void {
		this.doc.destroy();
	}
}

type ExtractedPdfWord = PdfTextRegion & { font: mupdf.Font };

/**
 * MuPDF exposes the decoded font through structured text, but does not expose
 * the source character codes. Keep that font and ask addSimpleFont to create a
 * fresh, known Latin encoding; writing Unicode directly into the old PDF font
 * resource would be incorrect for custom encodings and Type0 fonts.
 */
function extractPageWords(page: mupdf.Page, pageNum: number): ExtractedPdfWord[] {
	const bounds = page.getBounds();
	const width = bounds[2] - bounds[0];
	const height = bounds[3] - bounds[1];
	const regions: ExtractedPdfWord[] = [];
	let word = "";
	let rect: [number, number, number, number] | null = null;
	let font: mupdf.Font | null = null;
	let fontSize = 12;
	let fontFamily: PdfTextRegion["fontFamily"] = "Helvetica";
	let fontName = "Helvetica";
	let fontStyle: PdfFontStyle = { bold: false, italic: false, serif: false, monospace: false };
	let baseline: [number, number] = [0, 0];
	let color: [number, number, number] = [0, 0, 0];
	let horizontal = true;
	let wordIndex = 0;

	const flush = () => {
		if (word && rect && font && width > 0 && height > 0 && horizontal) {
			regions.push({
				id: `p${pageNum}-w${wordIndex++}`,
				text: word,
				rect,
				percentRect: [
					((rect[0] - bounds[0]) / width) * 100,
					((rect[1] - bounds[1]) / height) * 100,
					((rect[2] - bounds[0]) / width) * 100,
					((rect[3] - bounds[1]) / height) * 100,
				],
				fontSize,
				fontFamily,
				fontName,
				fontStyle,
				baseline,
				pageWidth: width,
				color,
				font,
			});
			font = null;
		} else {
			font?.destroy();
			font = null;
		}
		word = "";
		rect = null;
		horizontal = true;
	};

	const stext = page.toStructuredText();
	try {
		stext.walk({
			beginLine: flush,
			onChar: (char, origin, charFont, size, quad, charColor) => {
				if (/\s/u.test(char)) {
					charFont.destroy();
					flush();
					return;
				}
				const charRect: [number, number, number, number] = [
					Math.min(quad[0], quad[2], quad[4], quad[6]),
					Math.min(quad[1], quad[3], quad[5], quad[7]),
					Math.max(quad[0], quad[2], quad[4], quad[6]),
					Math.max(quad[1], quad[3], quad[5], quad[7]),
				];
				if (!rect) {
					rect = charRect;
					font = charFont;
					fontSize = size;
					fontName = charFont.getName();
					fontFamily = baseFontFamily(fontName);
					fontStyle = {
						bold: charFont.isBold(),
						italic: charFont.isItalic(),
						serif: charFont.isSerif(),
						monospace: charFont.isMono(),
					};
					baseline = [origin[0], origin[1]];
					color = normalizeRgb(charColor);
				} else {
					charFont.destroy();
					rect = [
						Math.min(rect[0], charRect[0]), Math.min(rect[1], charRect[1]),
						Math.max(rect[2], charRect[2]), Math.max(rect[3], charRect[3]),
					];
				}
				horizontal &&= Math.abs(quad[3] - quad[1]) < 0.5 && Math.abs(quad[4] - quad[0]) < 0.5;
				word += char;
			},
			endLine: flush,
		});
		flush();
	} finally {
		stext.destroy();
	}
	return regions;
}

function normalizeRgb(color: mupdf.Color): [number, number, number] {
	if (color.length === 1) return [color[0], color[0], color[0]];
	if (color.length === 3) return [color[0], color[1], color[2]];
	if (color.length === 4) {
		return [
			1 - Math.min(1, color[0] + color[3]),
			1 - Math.min(1, color[1] + color[3]),
			1 - Math.min(1, color[2] + color[3]),
		];
	}
	return [0, 0, 0];
}

function baseFontFamily(name: string): PdfTextRegion["fontFamily"] {
	const lower = name.toLowerCase();
	if (lower.includes("courier") || lower.includes("mono")) return "Courier";
	if (lower.includes("times") || lower.includes("serif")) return "Times-Roman";
	return "Helvetica";
}

export function fitReplacementFontSize(replacement: PdfTextReplacement): number {
	const font = new mupdf.Font(fallbackFontName(replacement));
	try {
		return fitWithFont(replacement, font, fallbackFontName(replacement));
	} finally {
		font.destroy();
	}
}

function fitWithFont(replacement: PdfTextReplacement, font: mupdf.Font, label: string): number {
	if (!replacement.text.trim() || /[\r\n]/u.test(replacement.text)) {
		throw new Error("Replacement must be a single non-empty line.");
	}
	let advance = 0;
	for (const char of replacement.text) {
		winAnsiByte(char, label);
		const glyph = font.encodeCharacter(char);
		if (glyph === 0) throw unsupportedCharacter(char, label);
		advance += font.advanceGlyph(glyph);
	}
	const width = replacement.rect[2] - replacement.rect[0];
	const sizeForWidth = advance > 0 ? width / advance : replacement.fontSize;
	// A structured-text rectangle is the ink box, not the font em box. Using
	// its height as a size cap shrinks ordinary text by several points. Preserve
	// the source size/baseline and only reduce size when the new advance is wider.
	const size = Math.min(replacement.fontSize, sizeForWidth);
	if (size < 5) {
		throw new Error(
			`“${replacement.text}” cannot fit this ${width.toFixed(1)}pt text region at the 5pt minimum. Shorten the replacement.`,
		);
	}
	return size;
}

function fallbackFontName(replacement: Pick<PdfTextReplacement, "fontFamily" | "fontStyle">): string {
	const style = replacement.fontStyle;
	const family = style?.monospace ? "Courier" : style?.serif ? "Times" : replacement.fontFamily === "Times-Roman" ? "Times" : replacement.fontFamily;
	if (family === "Courier") return style?.bold ? (style.italic ? "Courier-BoldOblique" : "Courier-Bold") : style?.italic ? "Courier-Oblique" : "Courier";
	if (family === "Times") return style?.bold ? (style.italic ? "Times-BoldItalic" : "Times-Bold") : style?.italic ? "Times-Italic" : "Times-Roman";
	return style?.bold ? (style.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : style?.italic ? "Helvetica-Oblique" : "Helvetica";
}

const WIN_ANSI_SPECIAL = new Map<number, number>([
	[0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
	[0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
	[0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
	[0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
	[0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
	[0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
	[0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function unsupportedCharacter(char: string, fontFamily: string): Error {
	return new Error(
		`“${char}” is not supported by ${fontFamily}. Use printable Windows-1252 text for this prototype.`,
	);
}

function winAnsiByte(char: string, fontFamily: string): number {
	const codePoint = char.codePointAt(0) ?? 0;
	if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
	if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
	const mapped = WIN_ANSI_SPECIAL.get(codePoint);
	if (mapped !== undefined) return mapped;
	throw unsupportedCharacter(char, fontFamily);
}

function encodeWinAnsi(text: string, fontFamily: string): Uint8Array {
	if (!text.trim() || /[\r\n]/u.test(text)) {
		throw new Error("Inserted PDF text must be a single non-empty line.");
	}
	return Uint8Array.from([...text].map((char) => winAnsiByte(char, fontFamily)));
}

function hexToRgb(hex: string): [number, number, number] {
	const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
	if (!match) return [0, 0, 0];
	return [
		parseInt(match[1], 16) / 255,
		parseInt(match[2], 16) / 255,
		parseInt(match[3], 16) / 255,
	];
}

function transformPoint(matrix: mupdf.Matrix, point: mupdf.Point): mupdf.Point {
	return [
		point[0] * matrix[0] + point[1] * matrix[2] + matrix[4],
		point[0] * matrix[1] + point[1] * matrix[3] + matrix[5],
	];
}

function cloneDictionary(doc: mupdf.PDFDocument, source: mupdf.PDFObject): mupdf.PDFObject {
	const copy = doc.newDictionary();
	if (!source.isNull()) {
		source.resolve().forEach((value, key) => copy.put(key, value));
	}
	return copy;
}

function appendPageText(
	doc: mupdf.PDFDocument,
	page: mupdf.PDFPage,
	text: string,
	rect: [number, number, number, number],
	font: mupdf.Font,
	fontLabel: string,
	fontSize: number,
	color: [number, number, number],
	baseline?: [number, number],
): void {
	const encodedText = encodeWinAnsi(text, fontLabel);
	const pageObject = page.getObject();
	const resources = cloneDictionary(doc, pageObject.getInheritable("Resources"));
	const fonts = cloneDictionary(doc, resources.get("Font"));
	const resourceName = `EBF${doc.countObjects()}`;
	for (const char of text) {
		if (font.encodeCharacter(char) === 0) {
			throw unsupportedCharacter(char, fontLabel);
		}
	}
	fonts.put(resourceName, doc.addSimpleFont(font, "Latin"));
	resources.put("Font", fonts);
	pageObject.put("Resources", resources);

	// Build a text matrix in PDF user space whose x/y axes map to right/up in
	// MuPDF page space. This also handles pages rotated via /Rotate without
	// treating genuinely rotated source glyphs as editable.
	const inverse = mupdf.Matrix.invert(page.getTransform());
	const pageBaseline: [number, number] = baseline ?? [rect[0], rect[1] + fontSize * 1.075];
	const origin = transformPoint(inverse, pageBaseline);
	const xAxis = transformPoint(inverse, [pageBaseline[0] + 1, pageBaseline[1]]);
	const yAxis = transformPoint(inverse, [pageBaseline[0], pageBaseline[1] - 1]);
	const hexText = [...encodedText]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	const content = [
		"q",
		"BT",
		`/${resourceName} ${fontSize.toFixed(4)} Tf`,
		"0 Tr 0 Tc 0 Tw 100 Tz 0 TL 0 Ts",
		`${color[0].toFixed(4)} ${color[1].toFixed(4)} ${color[2].toFixed(4)} rg`,
		`${(xAxis[0] - origin[0]).toFixed(6)} ${(xAxis[1] - origin[1]).toFixed(6)} ${(yAxis[0] - origin[0]).toFixed(6)} ${(yAxis[1] - origin[1]).toFixed(6)} ${origin[0].toFixed(4)} ${origin[1].toFixed(4)} Tm`,
		`<${hexText}> Tj`,
		"ET",
		"Q",
	].join("\n");
	const prefix = doc.addStream("q\n", {});
	const suffix = doc.addStream("Q\n", {});
	const stream = doc.addStream(content, {});
	const contents = pageObject.get("Contents");
	const newContents = doc.newArray();
	newContents.push(prefix);
	if (!contents.isNull()) {
		const resolved = contents.resolve();
		if (resolved.isArray()) resolved.forEach((value) => newContents.push(value));
		else newContents.push(contents);
	}
	newContents.push(suffix);
	newContents.push(stream);
	pageObject.put("Contents", newContents);
}

/**
 * Apply edits to the original PDF rather than rebuilding pages as images.
 * Replaced source text is removed with a text-only redaction and new text is
 * appended as an isolated page-content stream, so surrounding text stays
 * searchable. Existing overlay text is also appended as page content; circles
 * remain native PDF annotations.
 */
export interface EditPdfResult {
	data: Uint8Array;
	warnings: string[];
}

export function editPdf(buffer: Buffer, pages: NativePdfPageEdits[]): Uint8Array {
	return editPdfWithDiagnostics(buffer, pages).data;
}

export function editPdfWithDiagnostics(buffer: Buffer, pages: NativePdfPageEdits[]): EditPdfResult {
	const doc = new mupdf.PDFDocument(buffer);
	const warnings: string[] = [];
	try {
		for (const edits of pages) {
			if (
				edits.pageNum < 1 ||
				edits.pageNum > doc.countPages() ||
				(edits.replacements.length === 0 && edits.annotations.length === 0)
			) continue;

			const page = doc.loadPage(edits.pageNum - 1);
			try {
				// Capture MuPDF's decoded source font handles before redaction removes
				// the original glyphs. Region IDs are generated by this same walk.
				const sourceWords = extractPageWords(page, edits.pageNum);
				const sourceFonts = new Map(sourceWords.map((word) => [word.id, word]));
				const replacementRedactions: mupdf.PDFAnnotation[] = [];
				for (const replacement of edits.replacements) {
					if (!replacement.text.trim()) continue;
					const redaction = page.createAnnotation("Redact");
					redaction.setRect(replacement.rect);
					redaction.update();
					replacementRedactions.push(redaction);
				}
				for (const redaction of replacementRedactions) {
					// Apply only the redaction created for this replacement. Calling the
					// page-wide API would also apply pre-existing, unapplied redactions.
					redaction.applyRedaction(
						0,
						mupdf.PDFPage.REDACT_IMAGE_NONE,
						mupdf.PDFPage.REDACT_LINE_ART_NONE,
						mupdf.PDFPage.REDACT_TEXT_REMOVE,
					);
				}

				try {
					for (const replacement of edits.replacements) {
						if (!replacement.text.trim()) continue;
						const sourceWord = sourceFonts.get(replacement.regionId);
						let selectedFont = sourceWord?.font;
						let selectedLabel = sourceWord?.fontName ?? replacement.fontName ?? "original font";
						let ownedFallback: mupdf.Font | null = null;
						let size: number;
						try {
							if (!selectedFont || sourceWord?.text !== replacement.originalText) {
								throw new Error("the source font could not be matched to the selected word");
							}
							// This checks both the known output encoding and the actual embedded
							// font/subset before the original page is modified further.
							size = fitWithFont(replacement, selectedFont, selectedLabel);
						} catch (error) {
							const fallbackName = fallbackFontName(replacement);
							ownedFallback = new mupdf.Font(fallbackName);
							selectedFont = ownedFallback;
							selectedLabel = fallbackName;
							try {
								size = fitWithFont(replacement, selectedFont, selectedLabel);
							} catch (fallbackError) {
								ownedFallback.destroy();
								ownedFallback = null;
								throw fallbackError;
							}
							warnings.push(
								`“${replacement.originalText}” used ${fallbackName} because ${replacement.fontName ?? sourceWord?.fontName ?? "its original font"} could not be reused (${error instanceof Error ? error.message : String(error)}).`,
							);
						}
						try {
							appendPageText(
								doc, page, replacement.text, replacement.rect,
								selectedFont, selectedLabel, size, replacement.color,
								replacement.baseline ?? sourceWord?.baseline,
							);
						} catch (error) {
							// A malformed or unsupported embedded font can fail while MuPDF
							// creates the new resource even when all glyphs exist. Retry once
							// with a style-compatible Base-14 font rather than emitting bad bytes.
							if (ownedFallback) throw error;
							const fallbackName = fallbackFontName(replacement);
							ownedFallback = new mupdf.Font(fallbackName);
							const fallbackSize = fitWithFont(replacement, ownedFallback, fallbackName);
							appendPageText(
								doc, page, replacement.text, replacement.rect,
								ownedFallback, fallbackName, fallbackSize, replacement.color,
								replacement.baseline ?? sourceWord?.baseline,
							);
							warnings.push(`“${replacement.originalText}” used ${fallbackName} because ${selectedLabel} could not be embedded safely.`);
						} finally {
							ownedFallback?.destroy();
						}
					}
				} finally {
					for (const word of sourceWords) word.font.destroy();
				}

				const pageBounds = page.getBounds();
				const pageWidth = pageBounds[2] - pageBounds[0];
				const pageHeight = pageBounds[3] - pageBounds[1];
				for (const annotation of edits.annotations) {
					const rgb = hexToRgb(annotation.color);
					if (annotation.type === "text" && annotation.text?.trim()) {
						const x = pageBounds[0] + ((annotation.x ?? 0) / 100) * pageWidth;
						const baseline = pageBounds[1] + ((annotation.y ?? 0) / 100) * pageHeight;
						const size = annotation.fontSize ?? 16;
						const overlayFont = new mupdf.Font("Helvetica");
						try {
							appendPageText(
								doc, page, annotation.text,
								[x, baseline - size, pageBounds[2], baseline + size * 0.5],
								overlayFont, "Helvetica", size * 0.75, rgb,
							);
						} finally {
							overlayFont.destroy();
						}
					} else if (annotation.type === "circle") {
						const cx = pageBounds[0] + ((annotation.cx ?? 0) / 100) * pageWidth;
						const cy = pageBounds[1] + ((annotation.cy ?? 0) / 100) * pageHeight;
						const rx = ((annotation.rx ?? 0) / 100) * pageWidth;
						const ry = ((annotation.ry ?? 0) / 100) * pageHeight;
						const circle = page.createAnnotation("Circle");
						circle.setRect([cx - rx, cy - ry, cx + rx, cy + ry]);
						circle.setColor(rgb);
						circle.setBorderWidth(annotation.strokeWidth ?? 2);
						circle.setFlags(mupdf.PDFAnnotation.IS_PRINT);
						circle.update();
					}
				}
				page.update();
			} finally {
				page.destroy();
			}
		}
		const output = doc.saveToBuffer("garbage=compact,compress=yes");
		try {
			return { data: new Uint8Array(output.asUint8Array()), warnings };
		} finally {
			output.destroy();
		}
	} finally {
		doc.destroy();
	}
}
