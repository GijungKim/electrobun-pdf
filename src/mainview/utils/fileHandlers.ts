import { fitImageToPage } from "./geometry";

export interface ExportAnnotation {
	type: "text" | "circle";
	// percentages (0-100)
	x?: number;
	y?: number;
	cx?: number;
	cy?: number;
	rx?: number;
	ry?: number;
	text?: string;
	fontSize?: number;
	color: string;
	strokeWidth?: number;
}

export interface ExportPage {
	imageDataUrl: string;
	annotations: ExportAnnotation[];
}

/**
 * Convert bytes to base64 in chunks to avoid stack overflow on large files.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 8192;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

/**
 * Generate a PDF by drawing page images + annotations directly on jsPDF canvas.
 * No html2canvas — works reliably in Electrobun's webview.
 */
export async function exportToPdf(pages: ExportPage[]): Promise<Uint8Array> {
	const { default: jsPDF } = await import("jspdf");

	const pdf = new jsPDF("p", "mm", "a4");
	const pdfWidth = 210;
	const pdfHeight = 297;
	const margin = 5;
	const contentWidth = pdfWidth - margin * 2;
	const contentHeight = pdfHeight - margin * 2;

	// Decode all page images up front so they load in parallel
	const images = await Promise.all(
		pages.map(
			(page) =>
				new Promise<HTMLImageElement>((resolve, reject) => {
					const img = new Image();
					img.onload = () => resolve(img);
					img.onerror = reject;
					img.src = page.imageDataUrl;
				}),
		),
	);

	for (let i = 0; i < pages.length; i++) {
		if (i > 0) pdf.addPage();

		const page = pages[i];
		const img = images[i];

		// Fit image to page (centered, aspect-preserving)
		const { drawWidth, drawHeight, xOffset, yOffset } = fitImageToPage(
			img.width,
			img.height,
			contentWidth,
			contentHeight,
			margin,
		);

		// Draw page image
		pdf.addImage(
			page.imageDataUrl,
			"PNG",
			xOffset,
			yOffset,
			drawWidth,
			drawHeight,
		);

		// Draw annotations on top
		for (const ann of page.annotations) {
			if (ann.type === "text" && ann.text && ann.x !== undefined && ann.y !== undefined) {
				// Convert percentage position to mm
				const textX = xOffset + (ann.x / 100) * drawWidth;
				const textY = yOffset + (ann.y / 100) * drawHeight;
				const fontSizePt = (ann.fontSize || 16) * 0.75; // px to pt approx

				pdf.setTextColor(ann.color);
				pdf.setFontSize(fontSizePt);
				pdf.text(ann.text, textX, textY);
			} else if (ann.type === "circle" && ann.cx !== undefined && ann.cy !== undefined) {
				const cx = xOffset + (ann.cx! / 100) * drawWidth;
				const cy = yOffset + (ann.cy! / 100) * drawHeight;
				const rx = (ann.rx! / 100) * drawWidth;
				const ry = (ann.ry! / 100) * drawHeight;

				pdf.setDrawColor(ann.color);
				pdf.setLineWidth((ann.strokeWidth || 2) * 0.264); // px to mm
				pdf.ellipse(cx, cy, rx, ry, "S");
			}
		}
	}

	return new Uint8Array(pdf.output("arraybuffer"));
}

/**
 * Export DOCX editor content. Uses a simple canvas approach.
 */
export async function exportEditorToPdf(
	editorElement: HTMLElement,
): Promise<Uint8Array> {
	const { default: jsPDF } = await import("jspdf");

	// Create a temporary canvas by manually rendering
	const pdf = new jsPDF("p", "mm", "a4");

	// Get all text content and write it simply
	// This is a fallback - for DOCX the text content is what matters
	const text = editorElement.innerText || "";
	const lines = pdf.splitTextToSize(text, 180);

	pdf.setFontSize(11);
	pdf.setTextColor("#1a1916");

	const lineHeight = 5;
	const margin = 15;
	let y = margin;

	for (const line of lines) {
		if (y + lineHeight > 282) {
			pdf.addPage();
			y = margin;
		}
		pdf.text(line, margin, y);
		y += lineHeight;
	}

	return new Uint8Array(pdf.output("arraybuffer"));
}
