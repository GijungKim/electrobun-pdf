import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportAnnotation } from "../utils/fileHandlers";
import { circleFromDrag, clampPercent } from "../utils/geometry";

export type Tool = "select" | "text" | "circle";

interface TextAnnotation {
	id: string;
	x: number;
	y: number;
	text: string;
	fontSize: number;
	color: string;
}

interface CircleAnnotation {
	id: string;
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	color: string;
	strokeWidth: number;
}

type AnnotationState = {
	texts: TextAnnotation[];
	circles: CircleAnnotation[];
};

interface PdfAnnotationLayerProps {
	pageNum: number;
	imageDataUrl: string;
	activeTool: Tool;
	strokeWidth: number;
	color: string;
	isActivePage: boolean;
	onAnnotationsChange?: (
		pageNum: number,
		annotations: ExportAnnotation[],
	) => void;
	onPageFocus?: (pageNum: number) => void;
}

export default function PdfAnnotationLayer({
	pageNum,
	imageDataUrl,
	activeTool,
	strokeWidth,
	color,
	isActivePage,
	onAnnotationsChange,
	onPageFocus,
}: PdfAnnotationLayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [texts, setTexts] = useState<TextAnnotation[]>([]);
	const [circles, setCircles] = useState<CircleAnnotation[]>([]);
	const [editingTextId, setEditingTextId] = useState<string | null>(null);
	const [hoveredCircleId, setHoveredCircleId] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const draggingTypeRef = useRef<"text" | "circle" | null>(null);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const [drawingCircle, setDrawingCircle] = useState<{
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
	} | null>(null);

	// Single-level undo/redo — kept in refs so taking a snapshot
	// doesn't re-render the page
	const undoStateRef = useRef<AnnotationState | null>(null);
	const redoStateRef = useRef<AnnotationState | null>(null);

	const saveUndoState = useCallback(() => {
		undoStateRef.current = { texts: [...texts], circles: [...circles] };
		redoStateRef.current = null;
	}, [texts, circles]);

	const undo = useCallback(() => {
		const prev = undoStateRef.current;
		if (!prev) return;
		redoStateRef.current = { texts: [...texts], circles: [...circles] };
		setTexts(prev.texts);
		setCircles(prev.circles);
		undoStateRef.current = null;
	}, [texts, circles]);

	const redo = useCallback(() => {
		const next = redoStateRef.current;
		if (!next) return;
		undoStateRef.current = { texts: [...texts], circles: [...circles] };
		setTexts(next.texts);
		setCircles(next.circles);
		redoStateRef.current = null;
	}, [texts, circles]);

	// Cmd+Z / Cmd+Shift+Z — only active page handles undo/redo
	useEffect(() => {
		if (!isActivePage) return;
		const handler = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLTextAreaElement ||
				e.target instanceof HTMLInputElement
			)
				return;

			if ((e.metaKey || e.ctrlKey) && e.key === "z") {
				e.preventDefault();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [undo, redo, isActivePage]);

	// End text editing, discarding the annotation if it was left empty.
	// Functional updates guard against the blur that fires when focus
	// moves to a newly placed text box.
	const finishEditingText = useCallback((id: string) => {
		setTexts((prev) =>
			prev.filter((t) => t.text.trim() !== "" || t.id !== id),
		);
		setEditingTextId((prev) => (prev === id ? null : prev));
	}, []);

	// Report annotations to parent for export
	useEffect(() => {
		if (!onAnnotationsChange) return;
		const annotations: ExportAnnotation[] = [
			...texts
				.filter((t) => t.text.trim())
				.map((t) => ({
					type: "text" as const,
					x: t.x,
					y: t.y,
					text: t.text,
					fontSize: t.fontSize,
					color: t.color,
				})),
			...circles.map((c) => ({
				type: "circle" as const,
				cx: c.cx,
				cy: c.cy,
				rx: c.rx,
				ry: c.ry,
				color: c.color,
				strokeWidth: c.strokeWidth,
			})),
		];
		onAnnotationsChange(pageNum, annotations);
	}, [texts, circles, pageNum, onAnnotationsChange]);

	const getRelativePos = useCallback((e: React.MouseEvent) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: ((e.clientX - rect.left) / rect.width) * 100,
			y: ((e.clientY - rect.top) / rect.height) * 100,
		};
	}, []);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			onPageFocus?.(pageNum);
			if (activeTool === "text") {
				saveUndoState();
				const pos = getRelativePos(e);
				const id = `text-${Date.now()}`;
				setTexts((prev) => [
					...prev,
					{
						id,
						x: pos.x,
						y: pos.y,
						text: "",
						fontSize: 16,
						color,
					},
				]);
				setEditingTextId(id);
			} else if (activeTool === "circle") {
				saveUndoState();
				const pos = getRelativePos(e);
				setDrawingCircle({
					startX: pos.x,
					startY: pos.y,
					currentX: pos.x,
					currentY: pos.y,
				});
			} else if (activeTool === "select") {
				setEditingTextId(null);
			}
		},
		[activeTool, getRelativePos, color, saveUndoState, onPageFocus, pageNum],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (drawingCircle) {
				const pos = getRelativePos(e);
				setDrawingCircle((prev) =>
					prev
						? { ...prev, currentX: pos.x, currentY: pos.y }
						: null,
				);
			} else if (draggingId && draggingTypeRef.current === "text") {
				const pos = getRelativePos(e);
				setTexts((prev) =>
					prev.map((t) =>
						t.id === draggingId
							? {
									...t,
									x: clampPercent(pos.x - dragOffsetRef.current.x),
									y: clampPercent(pos.y - dragOffsetRef.current.y),
								}
							: t,
					),
				);
			} else if (draggingId && draggingTypeRef.current === "circle") {
				const pos = getRelativePos(e);
				setCircles((prev) =>
					prev.map((c) =>
						c.id === draggingId
							? {
									...c,
									cx: clampPercent(pos.x - dragOffsetRef.current.x),
									cy: clampPercent(pos.y - dragOffsetRef.current.y),
								}
							: c,
					),
				);
			}
		},
		[drawingCircle, draggingId, getRelativePos],
	);

	const handleMouseUp = useCallback(() => {
		if (drawingCircle) {
			const { cx, cy, rx, ry } = circleFromDrag(
				drawingCircle.startX,
				drawingCircle.startY,
				drawingCircle.currentX,
				drawingCircle.currentY,
			);

			if (rx > 0.5 && ry > 0.5) {
				setCircles((prev) => [
					...prev,
					{
						id: `circle-${Date.now()}`,
						cx,
						cy,
						rx,
						ry,
						color,
						strokeWidth,
					},
				]);
			}
			setDrawingCircle(null);
		}

		if (draggingId) {
			setDraggingId(null);
			draggingTypeRef.current = null;
		}
	}, [drawingCircle, draggingId, strokeWidth, color]);

	const startDraggingText = useCallback(
		(e: React.MouseEvent, textId: string) => {
			e.stopPropagation();
			e.preventDefault();
			onPageFocus?.(pageNum);
			saveUndoState();
			const pos = getRelativePos(e);
			const text = texts.find((t) => t.id === textId);
			if (!text) return;
			dragOffsetRef.current = { x: pos.x - text.x, y: pos.y - text.y };
			setDraggingId(textId);
			draggingTypeRef.current = "text";
			setEditingTextId(null);
		},
		[getRelativePos, texts, saveUndoState, onPageFocus, pageNum],
	);

	const startDraggingCircle = useCallback(
		(e: React.MouseEvent, circleId: string) => {
			e.stopPropagation();
			e.preventDefault();
			onPageFocus?.(pageNum);
			saveUndoState();
			const pos = getRelativePos(e);
			const circle = circles.find((c) => c.id === circleId);
			if (!circle) return;
			dragOffsetRef.current = { x: pos.x - circle.cx, y: pos.y - circle.cy };
			setDraggingId(circleId);
			draggingTypeRef.current = "circle";
		},
		[getRelativePos, circles, saveUndoState, onPageFocus, pageNum],
	);

	const updateTextContent = useCallback((id: string, text: string) => {
		setTexts((prev) =>
			prev.map((t) => (t.id === id ? { ...t, text } : t)),
		);
	}, []);

	const deleteAnnotation = useCallback(
		(id: string) => {
			onPageFocus?.(pageNum);
			saveUndoState();
			setTexts((prev) => prev.filter((t) => t.id !== id));
			setCircles((prev) => prev.filter((c) => c.id !== id));
			if (editingTextId === id) setEditingTextId(null);
		},
		[editingTextId, saveUndoState, onPageFocus, pageNum],
	);

	const previewCircle = drawingCircle
		? circleFromDrag(
				drawingCircle.startX,
				drawingCircle.startY,
				drawingCircle.currentX,
				drawingCircle.currentY,
			)
		: null;

	const isDragging = !!draggingId;
	const cursorClass =
		activeTool === "text"
			? "cursor-text"
			: activeTool === "circle"
				? "cursor-crosshair"
				: isDragging
					? "cursor-grabbing"
					: "cursor-default";

	return (
		<div
			ref={containerRef}
			className={`relative ${cursorClass}`}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
		>
			<img
				src={imageDataUrl}
				alt={`Page ${pageNum}`}
				className="w-full h-auto block select-none pointer-events-none"
				draggable={false}
			/>

			{/* SVG overlay for circles */}
			<svg
				className="absolute inset-0 w-full h-full overflow-visible"
				style={{ left: 0, top: 0, pointerEvents: "none" }}
			>
				{circles.map((c) => (
					<ellipse
						key={c.id}
						cx={`${c.cx}%`}
						cy={`${c.cy}%`}
						rx={`${c.rx}%`}
						ry={`${c.ry}%`}
						fill="none"
						stroke={c.color}
						strokeWidth={c.strokeWidth}
						className="cursor-grab"
						style={{ pointerEvents: "stroke" }}
						onMouseDown={(e) => startDraggingCircle(e, c.id)}
					/>
				))}
				{previewCircle && (
					<ellipse
						cx={`${previewCircle.cx}%`}
						cy={`${previewCircle.cy}%`}
						rx={`${previewCircle.rx}%`}
						ry={`${previewCircle.ry}%`}
						fill="none"
						stroke={color}
						strokeWidth={strokeWidth}
						strokeDasharray="6 4"
					/>
				)}
			</svg>

			{/* Invisible wider hit area for circles (easier to grab) */}
			<svg
				className="absolute inset-0 w-full h-full overflow-visible"
				style={{ left: 0, top: 0, pointerEvents: "none" }}
			>
				{circles.map((c) => (
					<ellipse
						key={`hit-${c.id}`}
						cx={`${c.cx}%`}
						cy={`${c.cy}%`}
						rx={`${c.rx}%`}
						ry={`${c.ry}%`}
						fill="none"
						stroke="transparent"
						strokeWidth={Math.max(c.strokeWidth + 8, 12)}
						className="cursor-grab active:cursor-grabbing"
						style={{ pointerEvents: "stroke" }}
						onMouseDown={(e) => startDraggingCircle(e, c.id)}
						onMouseEnter={() => setHoveredCircleId(c.id)}
						onMouseLeave={() => setHoveredCircleId(null)}
					/>
				))}
			</svg>

			{/* Text annotations */}
			{texts.map((t) => (
				<div
					key={t.id}
					className="absolute group"
					style={{
						left: `${t.x}%`,
						top: `${t.y}%`,
						transform: `translateY(-${t.fontSize * 0.85}px)`,
					}}
				>
					{editingTextId === t.id ? (
						<textarea
							autoFocus
							aria-label="Annotation text"
							value={t.text}
							onChange={(e) =>
								updateTextContent(t.id, e.target.value)
							}
							onKeyDown={(e) => {
								if (e.key === "Escape") finishEditingText(t.id);
							}}
							onBlur={() => finishEditingText(t.id)}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							className="bg-transparent border-none outline-none resize-none min-w-[80px] min-h-[20px] p-0 m-0 leading-none"
							style={{
								fontSize: t.fontSize,
								lineHeight: 1,
								color: t.color,
								caretColor: t.color,
							}}
						/>
					) : (
						<>
							<span
								className="whitespace-pre-wrap cursor-grab hover:bg-yellow-100/30 active:cursor-grabbing"
								style={{ fontSize: t.fontSize, color: t.color }}
								onDoubleClick={(e) => {
									e.stopPropagation();
									onPageFocus?.(pageNum);
									setEditingTextId(t.id);
								}}
								onMouseDown={(e) => {
									startDraggingText(e, t.id);
								}}
							>
								{t.text || "\u00A0"}
							</span>
							{activeTool === "select" && (
								<button
									type="button"
									title="Delete text"
									aria-label="Delete text annotation"
									className="absolute -top-2.5 -right-2.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
									onClick={(e) => {
										e.stopPropagation();
										deleteAnnotation(t.id);
									}}
									onMouseDown={(e) => {
										e.stopPropagation();
										onPageFocus?.(pageNum);
									}}
								>
									×
								</button>
							)}
						</>
					)}
				</div>
			))}

			{/* Delete buttons for circles */}
			{activeTool === "select" &&
				circles.map((c) => (
					<button
						key={`del-${c.id}`}
						type="button"
						title="Delete circle"
						aria-label="Delete circle annotation"
						className={`absolute w-5 h-5 bg-red-500 text-white rounded-full text-xs ${hoveredCircleId === c.id ? "opacity-100" : "opacity-0"} hover:opacity-100 transition-opacity flex items-center justify-center z-10`}
						style={{
							left: `${c.cx + c.rx}%`,
							top: `${c.cy - c.ry}%`,
							transform: "translate(-50%, -50%)",
						}}
						onClick={(e) => {
							e.stopPropagation();
							deleteAnnotation(c.id);
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onPageFocus?.(pageNum);
						}}
					>
						×
					</button>
				))}
		</div>
	);
}
