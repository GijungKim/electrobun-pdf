import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/types";

type Callback<T> = (data: T) => void;

const callbacks = {
	menuAction: null as Callback<string> | null,
	fileOpened: null as Callback<{
		fileName: string;
		html: string;
		fileType: string;
	}> | null,
	pdfPageReady: null as Callback<{
		pageNum: number;
		totalPages: number;
		imageDataUrl: string;
	}> | null,
	pdfDone: null as Callback<{ fileName: string; totalPages: number }> | null,
	fileSaved: null as Callback<{ success: boolean; path?: string }> | null,
	statusUpdate: null as Callback<string> | null,
};

export function onMenuAction(cb: typeof callbacks.menuAction) {
	callbacks.menuAction = cb;
}
export function onFileOpened(cb: typeof callbacks.fileOpened) {
	callbacks.fileOpened = cb;
}
export function onPdfPageReady(cb: typeof callbacks.pdfPageReady) {
	callbacks.pdfPageReady = cb;
}
export function onPdfDone(cb: typeof callbacks.pdfDone) {
	callbacks.pdfDone = cb;
}
export function onFileSaved(cb: typeof callbacks.fileSaved) {
	callbacks.fileSaved = cb;
}
export function onStatusUpdate(cb: typeof callbacks.statusUpdate) {
	callbacks.statusUpdate = cb;
}

const rpc = Electroview.defineRPC<AppRPC>({
	handlers: {
		requests: {},
		messages: {
			menuAction: ({ action }) => {
				callbacks.menuAction?.(action);
			},
			fileOpened: (data) => {
				callbacks.fileOpened?.(data);
			},
			pdfPageReady: (data) => {
				callbacks.pdfPageReady?.(data);
			},
			pdfDone: (data) => {
				callbacks.pdfDone?.(data);
			},
			fileSaved: (data) => {
				callbacks.fileSaved?.(data);
			},
			statusUpdate: ({ status }) => {
				callbacks.statusUpdate?.(status);
			},
		},
	},
});

const electroview = new Electroview({ rpc });

export function triggerOpen() {
	electroview.rpc!.send.triggerOpen({});
}

export function openFileData(fileName: string, data: string) {
	electroview.rpc!.send.openFileData({ fileName, data });
}

export function triggerExport(data: string, fileName: string) {
	electroview.rpc!.send.triggerExport({ data, fileName });
}
