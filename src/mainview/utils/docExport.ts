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

/**
 * Render blocks to a PDF. Block-level styling only: headings get larger bold
 * type; a block whose entire text shares bold/italic is rendered in that style;
 * lists get bullet/number prefixes and an indent. Inline mid-paragraph mark
 * changes are NOT yet honored (the text is preserved at normal weight) — see
 * plans/004-findings.md.
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
		const text = block.segments.map((s) => s.text).join("");

		let fontSize = 11;
		let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal";
		let indent = 0;
		let prefix = "";
		let spaceAfter = 2;

		if (block.kind === "heading") {
			fontSize = headingSize[block.level] ?? 12;
			fontStyle = "bold";
			spaceAfter = 3;
		} else if (block.kind === "listItem") {
			indent = 6;
			prefix = block.ordered ? `${block.index}. ` : "• ";
		}

		// Whole-block bold/italic (only when every non-blank segment shares it).
		if (block.kind !== "heading") {
			const nonEmpty = block.segments.filter((s) => s.text.trim() !== "");
			const allBold = nonEmpty.length > 0 && nonEmpty.every((s) => s.bold);
			const allItalic =
				nonEmpty.length > 0 && nonEmpty.every((s) => s.italic);
			if (allBold && allItalic) fontStyle = "bolditalic";
			else if (allBold) fontStyle = "bold";
			else if (allItalic) fontStyle = "italic";
		}

		pdf.setFont("helvetica", fontStyle);
		pdf.setFontSize(fontSize);

		const lineHeight = fontSize * 0.5; // mm, approximate
		const lines: string[] = pdf.splitTextToSize(prefix + text, maxWidth - indent);

		for (const line of lines) {
			if (y + lineHeight > pageBottom) {
				pdf.addPage();
				y = margin;
			}
			pdf.text(line, margin + indent, y);
			y += lineHeight;
		}
		y += spaceAfter;
	}

	return new Uint8Array(pdf.output("arraybuffer"));
}
