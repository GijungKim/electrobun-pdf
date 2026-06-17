import Electrobun, {
	BrowserView,
	BrowserWindow,
	ApplicationMenu,
	Updater,
	Utils,
} from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { parseDocx, PdfRenderer } from "./fileParser";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log("Vite dev server not running. Using built assets.");
		}
	}
	return "views://mainview/index.html";
}

async function processDocument(fileName: string, nodeBuffer: Buffer) {
	const fileType = fileName.split(".").pop()?.toLowerCase() || "";
	console.log(`[bun] Processing: ${fileName} (${fileType}, ${nodeBuffer.byteLength} bytes)`);

	mainWindow.webview.rpc?.send.statusUpdate({
		status: "Parsing document...",
	});

	try {
		if (fileType === "pdf") {
			const renderer = new PdfRenderer(nodeBuffer);
			try {
				const totalPages = renderer.pageCount;
				console.log(`[bun] PDF has ${totalPages} pages, rendering...`);

				for (let p = 1; p <= totalPages; p++) {
					mainWindow.webview.rpc?.send.statusUpdate({
						status: `Rendering page ${p} of ${totalPages}...`,
					});
					console.log(`[bun] Rendering page ${p}/${totalPages}...`);
					const imageDataUrl = renderer.renderPage(p, 2);
					console.log(
						`[bun] Page ${p} rendered (${imageDataUrl.length} chars)`,
					);
					mainWindow.webview.rpc?.send.pdfPageReady({
						pageNum: p,
						totalPages,
						imageDataUrl,
					});
				}

				mainWindow.webview.rpc?.send.pdfDone({ fileName, totalPages });
				console.log("[bun] All PDF pages sent");
			} finally {
				renderer.destroy();
			}
		} else if (fileType === "docx") {
			const arrayBuffer = nodeBuffer.buffer.slice(
				nodeBuffer.byteOffset,
				nodeBuffer.byteOffset + nodeBuffer.byteLength,
			) as ArrayBuffer;
			const html = await parseDocx(arrayBuffer);
			console.log(`[bun] DOCX parsed to ${html.length} chars`);
			mainWindow.webview.rpc?.send.fileOpened({
				fileName,
				html,
				fileType,
			});
		} else {
			mainWindow.webview.rpc?.send.statusUpdate({
				status: `Unsupported file type: .${fileType} (PDF and DOCX only)`,
			});
		}
	} catch (err) {
		console.error("[bun] Error:", err);
		mainWindow.webview.rpc?.send.statusUpdate({
			status: `Error: ${err}`,
		});
	}
}

const rpc = BrowserView.defineRPC<AppRPC>({
	maxRequestTime: 60000,
	handlers: {
		requests: {},
		messages: {
			triggerOpen: async () => {
				console.log("[bun] triggerOpen received");

				const paths = await Utils.openFileDialog({
					startingFolder: Utils.paths.documents,
					allowedFileTypes: "pdf,docx",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});

				if (!paths || paths.length === 0) {
					console.log("[bun] No file selected");
					mainWindow.webview.rpc?.send.statusUpdate({ status: "" });
					return;
				}

				const filePath = paths[0];
				const fileName = filePath.split(/[/\\]/).pop() || "document";
				const buffer = await Bun.file(filePath).arrayBuffer();
				await processDocument(fileName, Buffer.from(buffer));
			},

			openFileData: async ({ fileName, data }) => {
				console.log(`[bun] openFileData received: ${fileName}`);
				await processDocument(fileName, Buffer.from(data, "base64"));
			},

			triggerExport: async ({ data, fileName }) => {
				try {
					// Let user pick a destination folder
					const paths = await Utils.openFileDialog({
						startingFolder: Utils.paths.documents,
						allowedFileTypes: "*",
						canChooseFiles: false,
						canChooseDirectory: true,
						allowsMultipleSelection: false,
					});

					if (!paths || paths.length === 0) {
						console.log("[bun] Export cancelled");
						mainWindow.webview.rpc?.send.statusUpdate({ status: "Export cancelled" });
						return;
					}

					const destDir = paths[0];
					let savePath = `${destDir}/${fileName}`;

					// Avoid overwriting existing files by appending a number
					const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
					const baseName = ext ? fileName.slice(0, -ext.length) : fileName;
					let counter = 1;
					while (await Bun.file(savePath).exists()) {
						savePath = `${destDir}/${baseName} (${counter})${ext}`;
						counter++;
					}

					const buffer = Buffer.from(data, "base64");
					await Bun.write(savePath, buffer);
					console.log(`[bun] Exported ${buffer.length} bytes to ${savePath}`);
					Utils.showItemInFolder(savePath);
					mainWindow.webview.rpc?.send.fileSaved({
						success: true,
						path: savePath,
					});
				} catch (err) {
					console.error("[bun] Save error:", err);
					mainWindow.webview.rpc?.send.fileSaved({ success: false });
				}
			},
		},
	},
});

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "electrobun-pdf",
	url,
	rpc,
	frame: {
		width: 1200,
		height: 850,
		x: 100,
		y: 100,
	},
});

ApplicationMenu.setApplicationMenu([
	{
		submenu: [
			{ label: "About electrobun-pdf", role: "about" },
			{ type: "separator" },
			{ label: "Quit electrobun-pdf", role: "quit" },
		],
	},
	{
		label: "File",
		submenu: [
			{ label: "Open...", action: "open", accelerator: "o" },
			{ type: "separator" },
			{ label: "Export as PDF", action: "exportPdf", accelerator: "e" },
			{ type: "separator" },
			{ label: "Close Window", role: "close" },
		],
	},
	{
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			{ type: "separator" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "selectAll" },
		],
	},
	{
		label: "View",
		submenu: [
			{ role: "toggleFullScreen" },
			{ role: "minimize" },
			{ role: "zoom" },
		],
	},
]);

Electrobun.events.on("application-menu-clicked", (e) => {
	const action = e.data.action;
	if (action) {
		mainWindow.webview.rpc?.send.menuAction({ action });
	}
});

console.log("electrobun-pdf started!");
