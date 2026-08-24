// Pure mapping from a ProseMirror/TipTap document (editor.getJSON()) to a flat
// list of styled blocks, plus a jsPDF renderer. The mapper is dependency-free
// and unit-tested; the renderer imports jsPDF dynamically (kept out of the
// mapper so tests don't load jsPDF).

export interface ProseMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface ProseNode {
	type?: string;
	attrs?: Record<string, unknown>;
	content?: ProseNode[];
	text?: string;
	marks?: ProseMark[];
}

export interface TextSegment {
	text: string;
	bold: boolean;
	italic: boolean;
}

export type PdfBlock =
	| { kind: "heading"; level: number; segments: TextSegment[] }
	| { kind: "paragraph"; segments: TextSegment[] }
	| { kind: "listItem"; ordered: boolean; index: number; segments: TextSegment[] };

// Collect inline text segments from a block node, recursing through any nested
// inline structure. hardBreak becomes a newline so jsPDF wraps on it.
function inlineSegments(node: ProseNode): TextSegment[] {
	const out: TextSegment[] = [];
	const walk = (n: ProseNode) => {
		if (n.type === "text") {
			const marks = n.marks ?? [];
			out.push({
				text: n.text ?? "",
				bold: marks.some((m) => m.type === "bold"),
				italic: marks.some((m) => m.type === "italic"),
			});
			return;
		}
		if (n.type === "hardBreak") {
			out.push({ text: "\n", bold: false, italic: false });
			return;
		}
		(n.content ?? []).forEach(walk);
	};
	(node.content ?? []).forEach(walk);
	return out;
}

// Fallback so text is never lost for an unrecognized node type.
function plainText(node: ProseNode): string {
	if (node.type === "text") return node.text ?? "";
	return (node.content ?? []).map(plainText).join("");
}

/**
 * Flatten a ProseMirror doc into renderable blocks. Recognized: heading,
 * paragraph, bulletList/orderedList (one block per listItem), blockquote
 * (rendered as its inner paragraphs). Any other node type degrades to a
 * paragraph carrying its plain text — never dropped.
 */
export function docToBlocks(doc: ProseNode): PdfBlock[] {
	const blocks: PdfBlock[] = [];
	for (const node of doc.content ?? []) {
		switch (node.type) {
			case "heading":
				blocks.push({
					kind: "heading",
					level:
						typeof node.attrs?.level === "number"
							? (node.attrs.level as number)
							: 1,
					segments: inlineSegments(node),
				});
				break;
			case "paragraph":
				blocks.push({ kind: "paragraph", segments: inlineSegments(node) });
				break;
			case "bulletList":
			case "orderedList": {
				const ordered = node.type === "orderedList";
				let i = 0;
				for (const item of node.content ?? []) {
					i++;
					blocks.push({
						kind: "listItem",
						ordered,
						index: i,
						segments: inlineSegments(item),
					});
				}
				break;
			}
			case "blockquote":
				for (const child of node.content ?? []) {
					blocks.push({
						kind: "paragraph",
						segments: inlineSegments(child),
					});
				}
				break;
			default: {
				const text = plainText(node);
				if (text !== "") {
					blocks.push({
						kind: "paragraph",
						segments: [{ text, bold: false, italic: false }],
					});
				}
			}
		}
	}
	return blocks;
}

export interface LineRun {
	text: string;
	bold: boolean;
	italic: boolean;
	/** Horizontal offset from the line start, in the measurer's units. */
	x: number;
}

/** Width of `text` when set in the given style, in the caller's units. */
export type Measure = (text: string, bold: boolean, italic: boolean) => number;

/**
 * Break styled segments into lines no wider than `maxWidth`, preserving each
 * run's bold/italic and recording where along the line it starts, so a
 * paragraph can change style mid-line. Pure: the font metrics come from
 * `measure`, which the renderer backs with jsPDF's getTextWidth.
 *
 * Wrapping happens at whitespace; a "\n" segment forces a break; whitespace
 * that would start a wrapped line is dropped; a single word wider than the
 * line is split across lines by character rather than overflowing.
 * Always yields at least one (possibly empty) line so blank paragraphs still
 * take vertical space.
 */
export function layoutLines(
	segments: TextSegment[],
	maxWidth: number,
	measure: Measure,
): LineRun[][] {
	const lines: LineRun[][] = [];
	let line: LineRun[] = [];
	let x = 0;

	const newline = () => {
		// Trailing whitespace at a wrap point renders as nothing; drop it.
		const last = line[line.length - 1];
		if (last) {
			last.text = last.text.replace(/\s+$/, "");
			if (last.text === "") line.pop();
		}
		lines.push(line);
		line = [];
		x = 0;
	};

	const place = (text: string, width: number, bold: boolean, italic: boolean) => {
		const last = line[line.length - 1];
		if (last && last.bold === bold && last.italic === italic) {
			last.text += text;
		} else {
			line.push({ text, bold, italic, x });
		}
		x += width;
	};

	for (const seg of segments) {
		const { bold, italic } = seg;
		for (const piece of seg.text.split(/(\n)/)) {
			if (piece === "") continue;
			if (piece === "\n") {
				newline();
				continue;
			}
			for (const token of piece.split(/(\s+)/)) {
				if (token === "") continue;
				const isSpace = /^\s+$/.test(token);
				const width = measure(token, bold, italic);

				if (x > 0 && x + width > maxWidth) {
					newline();
					if (isSpace) continue;
				}

				if (width > maxWidth && !isSpace) {
					// Overlong word: split by character.
					for (const ch of token) {
						const w = measure(ch, bold, italic);
						if (x > 0 && x + w > maxWidth) newline();
						place(ch, w, bold, italic);
					}
					continue;
				}

				place(token, width, bold, italic);
			}
		}
	}
	lines.push(line);
	return lines;
}

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

function fontStyle(bold: boolean, italic: boolean): FontStyle {
	if (bold && italic) return "bolditalic";
	if (bold) return "bold";
	if (italic) return "italic";
	return "normal";
}

/**
 * Render blocks to a PDF. Headings get larger bold type; lists get a
 * bullet/number prefix and an indent; bold and italic runs are honored
 * wherever they occur, including mid-line, via layoutLines.
 */
export async function renderBlocksToPdf(blocks: PdfBlock[]): Promise<Uint8Array> {
	const { default: jsPDF } = await import("jspdf");
	const pdf = new jsPDF("p", "mm", "a4");

	const margin = 15;
	const maxWidth = 180; // 210mm - 2*15mm
	const pageBottom = 282;
	let y = margin;

	pdf.setTextColor("#1a1916");

	const headingSize: Record<number, number> = { 1: 20, 2: 16, 3: 13 };

	for (const block of blocks) {
		let fontSize = 11;
		let indent = 0;
		let spaceAfter = 2;
		let segments = block.segments;

		if (block.kind === "heading") {
			fontSize = headingSize[block.level] ?? 12;
			spaceAfter = 3;
			segments = segments.map((s) => ({ ...s, bold: true }));
		} else if (block.kind === "listItem") {
			indent = 6;
			const first = segments[0];
			segments = [
				{
					text: block.ordered ? `${block.index}. ` : "• ",
					bold: first?.bold ?? false,
					italic: first?.italic ?? false,
				},
				...segments,
			];
		}

		const setFont = (bold: boolean, italic: boolean) => {
			pdf.setFont("helvetica", fontStyle(bold, italic));
			pdf.setFontSize(fontSize);
		};
		const measure: Measure = (text, bold, italic) => {
			setFont(bold, italic);
			return pdf.getTextWidth(text);
		};

		const lineHeight = fontSize * 0.5; // mm, approximate
		const lines = layoutLines(segments, maxWidth - indent, measure);

		for (const line of lines) {
			if (y + lineHeight > pageBottom) {
				pdf.addPage();
				y = margin;
			}
			for (const run of line) {
				setFont(run.bold, run.italic);
				pdf.text(run.text, margin + indent + run.x, y);
			}
			y += lineHeight;
		}
		y += spaceAfter;
	}

	return new Uint8Array(pdf.output("arraybuffer"));
}
