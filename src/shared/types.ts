import { RPCSchema } from "electrobun/bun";

export interface PdfTextRegion {
	id: string;
	text: string;
	/** MuPDF page-space rectangle, in points. */
	rect: [number, number, number, number];
	/** Page-relative rectangle, in percentages, for the webview overlay. */
	percentRect: [number, number, number, number];
	fontSize: number;
	fontFamily: "Helvetica" | "Times-Roman" | "Courier";
	/** Exact source font name reported by MuPDF (subset prefixes are retained). */
	fontName?: string;
	fontStyle?: PdfFontStyle;
	/** First glyph origin in MuPDF page space; used to retain the source baseline. */
	baseline?: [number, number];
	pageWidth: number;
	color: [number, number, number];
}

export interface PdfTextReplacement {
	regionId: string;
	originalText: string;
	text: string;
	rect: [number, number, number, number];
	fontSize: number;
	fontFamily: "Helvetica" | "Times-Roman" | "Courier";
	fontName?: string;
	fontStyle?: PdfFontStyle;
	baseline?: [number, number];
	color: [number, number, number];
}

export interface PdfFontStyle {
	bold: boolean;
	italic: boolean;
	serif: boolean;
	monospace: boolean;
}

export interface NativePdfAnnotation {
	type: "text" | "circle";
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

export interface NativePdfPageEdits {
	pageNum: number;
	replacements: PdfTextReplacement[];
	annotations: NativePdfAnnotation[];
}

export type AppRPC = {
	bun: RPCSchema<{
		requests: {};
		messages: {
			triggerOpen: {};
			openFileData: { fileName: string; data: string };
			triggerExport: { data: string; fileName: string };
			exportEditedPdf: { fileName: string; pages: NativePdfPageEdits[] };
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			menuAction: { action: string };
			fileOpened: { fileName: string; html: string; fileType: string };
			pdfPageReady: {
				pageNum: number;
				totalPages: number;
				imageDataUrl: string;
				textRegions: PdfTextRegion[];
			};
			pdfDone: { fileName: string; totalPages: number };
			fileSaved: { success: boolean; path?: string };
			statusUpdate: { status: string };
		};
	}>;
};
