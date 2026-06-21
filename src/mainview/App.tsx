import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import ImageExt from "@tiptap/extension-image";
import { Table as TableExt } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

import Toolbar from "./components/Toolbar";
import PdfToolbar from "./components/PdfToolbar";
import StatusBar from "./components/StatusBar";
import WelcomeScreen from "./components/WelcomeScreen";
import PdfAnnotationLayer, {
	type Tool,
} from "./components/PdfAnnotationLayer";
import {
	triggerOpen,
	triggerExport,
	openFileData,
	onMenuAction,
	onFileOpened,
	onPdfPageReady,
	onPdfDone,
	onFileSaved,
	onStatusUpdate,
} from "./rpc";
import {
	exportToPdf,
	exportEditorToPdf,
	uint8ToBase64,
	type ExportAnnotation,
} from "./utils/fileHandlers";
import type { ProseNode } from "./utils/docExport";

export default function App() {
	const [fileName, setFileName] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const [showEditor, setShowEditor] = useState(false);
	const [pdfPages, setPdfPages] = useState<string[]>([]);
	const [isPdf, setIsPdf] = useState(false);
	const pdfReadyRef = useRef(false);
	const [activeTool, setActiveTool] = useState<Tool>("select");
	const [strokeWidth, setStrokeWidth] = useState(3);
	const [annotationColor, setAnnotationColor] = useState("#000000");
	const [activePageNum, setActivePageNum] = useState<number>(1);
	const [totalPages, setTotalPages] = useState(0);
	const [pdfSessionId, setPdfSessionId] = useState(0);
	const [isDraggingFile, setIsDraggingFile] = useState(false);
	const dragCounter = useRef(0);
	const pageAnnotationsRef = useRef<Map<number, ExportAnnotation[]>>(new Map());
	const editorContentRef = useRef<HTMLDivElement>(null);

	const editor = useEditor({
		extensions: [
			StarterKit,
			Underline,
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			ImageExt.configure({ inline: false, allowBase64: true }),
			TableExt.configure({ resizable: true }),
			TableRow,
			TableCell,
			TableHeader,
			Highlight,
			TextStyle,
			Color,
		],
		content: "",
		editorProps: {
			attributes: {
				class: "prose prose-sm sm:prose max-w-none focus:outline-none min-h-[600px] px-16 py-12",
			},
		},
	});

	const wordCount =
		editor?.getText().split(/\s+/).filter(Boolean).length ?? 0;

	const handleOpen = useCallback(() => {
		setStatus("Opening file...");
		triggerOpen();
	}, []);

	const handleAnnotationsChange = useCallback(
		(pageNum: number, annotations: ExportAnnotation[]) => {
			pageAnnotationsRef.current.set(pageNum, annotations);
		},
		[],
	);

	const handleExportPdf = useCallback(async () => {
		if (isPdf && !pdfReadyRef.current) {
			setStatus("Still rendering pages, please wait...");
			return;
		}
		setStatus("Generating PDF...");
		try {
			let pdfBytes: Uint8Array;

			if (isPdf) {
				// Build export pages from images + annotations
				const exportPages = pdfPages
					.filter(Boolean)
					.map((imageDataUrl, i) => ({
						imageDataUrl,
						annotations: pageAnnotationsRef.current.get(i + 1) || [],
					}));
				pdfBytes = await exportToPdf(exportPages);
			} else {
				if (!editor) return;
				pdfBytes = await exportEditorToPdf(editor.getJSON() as unknown as ProseNode);
			}

			const base64 = uint8ToBase64(new Uint8Array(pdfBytes));

			const baseName = fileName
				? fileName.replace(/\.[^.]+$/, "")
				: "document";

			triggerExport(base64, `${baseName}-annotated.pdf`);
		} catch (err) {
			console.error("Error exporting PDF:", err);
			setStatus("Error exporting PDF");
		}
	}, [editor, fileName, isPdf, pdfPages]);

	// Drag & drop to open files
	const handleDroppedFile = useCallback(async (file: File) => {
		const ext = file.name.split(".").pop()?.toLowerCase();
		if (ext !== "pdf" && ext !== "docx") {
			setStatus(`Unsupported file type: ${file.name} (PDF and DOCX only)`);
			return;
		}
		setStatus(`Reading ${file.name}...`);
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			openFileData(file.name, uint8ToBase64(bytes));
		} catch (err) {
			console.error("Error reading dropped file:", err);
			setStatus("Error reading dropped file");
		}
	}, []);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current++;
		if (e.dataTransfer.types.includes("Files")) setIsDraggingFile(true);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current--;
		if (dragCounter.current <= 0) {
			dragCounter.current = 0;
			setIsDraggingFile(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			dragCounter.current = 0;
			setIsDraggingFile(false);
			const file = e.dataTransfer.files?.[0];
			if (file) handleDroppedFile(file);
		},
		[handleDroppedFile],
	);

	// Prevent the webview from navigating away when a file is dropped
	// outside our handlers
	useEffect(() => {
		const prevent = (e: DragEvent) => e.preventDefault();
		window.addEventListener("dragover", prevent);
		window.addEventListener("drop", prevent);
		return () => {
			window.removeEventListener("dragover", prevent);
			window.removeEventListener("drop", prevent);
		};
	}, []);

	// Track which PDF page is centered in the viewport
	const handleScroll = useCallback(() => {
		if (!isPdf) return;
		const container = editorContentRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const mid = rect.top + rect.height / 2;
		let best = activePageNum;
		let bestDist = Infinity;
		container
			.querySelectorAll<HTMLElement>("[data-pdf-page]")
			.forEach((el) => {
				const r = el.getBoundingClientRect();
				const dist = Math.abs((r.top + r.bottom) / 2 - mid);
				if (dist < bestDist) {
					bestDist = dist;
					best = Number(el.dataset.pdfPage);
				}
			});
		setActivePageNum(best);
	}, [isPdf, activePageNum]);

	// Keyboard shortcuts for tools
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!isPdf) return;

			// Escape always goes back to select, even from a textarea
			if (e.key === "Escape") {
				setActiveTool("select");
				if (e.target instanceof HTMLElement) e.target.blur();
				return;
			}

			// Don't trigger tool shortcuts when typing in an input
			if (
				e.target instanceof HTMLTextAreaElement ||
				e.target instanceof HTMLInputElement
			)
				return;

			if (e.key === "v" || e.key === "V") setActiveTool("select");
			if (e.key === "t" || e.key === "T") setActiveTool("text");
			if (e.key === "c" || e.key === "C") setActiveTool("circle");
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isPdf]);

	// Listen for messages from bun process
	useEffect(() => {
		onFileOpened((data) => {
			// Clear previous state, then load new DOCX
			setPdfPages([]);
			setIsPdf(false);
			setActiveTool("select");
			setTotalPages(0);
			pageAnnotationsRef.current.clear();
			setFileName(data.fileName);
			editor?.commands.setContent(data.html);
			setShowEditor(true);
			setStatus("Ready");
		});

		onPdfPageReady((data) => {
			setTotalPages(data.totalPages);
			setPdfPages((prev) => {
				if (data.pageNum === 1) {
					setIsPdf(true);
					pdfReadyRef.current = false;
					setActiveTool("select");
					setActivePageNum(1);
					setPdfSessionId((id) => id + 1);
					pageAnnotationsRef.current.clear();
					setShowEditor(true);
					return [data.imageDataUrl];
				}
				const updated = [...prev];
				updated[data.pageNum - 1] = data.imageDataUrl;
				return updated;
			});
		});

		onPdfDone((data) => {
			setFileName(data.fileName);
			pdfReadyRef.current = true;
			setStatus("Ready");
		});

		onFileSaved((data) => {
			if (data?.success) {
				setStatus(`Exported to ${data.path}`);
			} else {
				setStatus("Export failed");
			}
		});

		onStatusUpdate((s) => {
			setStatus(s);
		});

		onMenuAction((action) => {
			if (action === "open") handleOpen();
			if (action === "exportPdf") handleExportPdf();
		});
	}, [editor, handleOpen, handleExportPdf]);

	const dropOverlay = isDraggingFile ? (
		<div className="absolute inset-0 z-50 bg-surface-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
			<div className="border-2 border-dashed border-accent rounded-xl px-12 py-10 text-center">
				<p className="text-surface-100 text-lg font-medium">
					Drop to open
				</p>
				<p className="text-surface-500 text-sm mt-1">PDF or DOCX</p>
			</div>
		</div>
	) : null;

	if (!showEditor) {
		return (
			<div
				className="h-screen relative"
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<WelcomeScreen onOpen={handleOpen} status={status} />
				{dropOverlay}
			</div>
		);
	}

	return (
		<div
			className="h-screen relative flex flex-col bg-surface-950"
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{isPdf ? (
				<PdfToolbar
					activeTool={activeTool}
					onToolChange={setActiveTool}
					strokeWidth={strokeWidth}
					onStrokeWidthChange={setStrokeWidth}
					color={annotationColor}
					onColorChange={setAnnotationColor}
					onOpen={handleOpen}
					onExportPdf={handleExportPdf}
				/>
			) : (
				<Toolbar
					editor={editor}
					onOpen={handleOpen}
					onExportPdf={handleExportPdf}
				/>
			)}
			<div
				ref={editorContentRef}
				className="flex-1 overflow-y-auto bg-surface-100"
				onScroll={handleScroll}
			>
				{isPdf ? (
					<div className="py-6 space-y-6">
						{pdfPages.map((dataUrl, i) =>
							dataUrl ? (
								<div
									key={`${pdfSessionId}-${i}`}
									data-pdf-page={i + 1}
									className="max-w-[816px] mx-auto bg-white shadow-lg shadow-surface-900/10 rounded-sm overflow-hidden"
								>
									<PdfAnnotationLayer
										pageNum={i + 1}
										imageDataUrl={dataUrl}
										activeTool={activeTool}
										strokeWidth={strokeWidth}
										color={annotationColor}
										isActivePage={activePageNum === i + 1}
										onAnnotationsChange={handleAnnotationsChange}
										onPageFocus={setActivePageNum}
									/>
								</div>
							) : (
								<div
									key={i}
									className="max-w-[816px] mx-auto bg-white shadow-lg rounded-sm h-[1056px] flex items-center justify-center text-surface-300 font-mono text-sm"
								>
									Loading page {i + 1}...
								</div>
							),
						)}
					</div>
				) : (
					<div className="max-w-[816px] mx-auto my-6 bg-white shadow-lg shadow-surface-900/10 rounded-sm min-h-[1056px]">
						<EditorContent editor={editor} />
					</div>
				)}
			</div>
			<StatusBar
				fileName={fileName}
				status={status}
				wordCount={isPdf ? 0 : wordCount}
				currentPage={activePageNum}
				pageCount={isPdf ? totalPages : 0}
			/>
			{dropOverlay}
		</div>
	);
}
