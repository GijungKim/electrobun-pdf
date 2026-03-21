import { RPCSchema } from "electrobun/bun";

export type AppRPC = {
	bun: RPCSchema<{
		requests: {};
		messages: {
			triggerOpen: {};
			triggerExport: { data: string; fileName: string };
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			menuAction: { action: string };
			fileOpened: { fileName: string; html: string; fileType: string };
			pdfPageReady: { pageNum: number; totalPages: number; imageDataUrl: string };
			pdfDone: { fileName: string; totalPages: number };
			fileSaved: { success: boolean; path?: string };
			statusUpdate: { status: string };
		};
	}>;
};
