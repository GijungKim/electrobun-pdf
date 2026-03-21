import mammoth from "mammoth";
import * as mupdf from "mupdf";

/**
 * Parse a DOCX file buffer into HTML
 */
export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
	const result = await mammoth.convertToHtml(
		{ arrayBuffer: buffer },
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

	destroy(): void {
		this.doc.destroy();
	}
}
