import { memo, useCallback, useRef, useState } from "react";
import type { PageAnnotations } from "../utils/annotations";
import { circleFromDrag, clampPercent } from "../utils/geometry";

export type Tool = "select" | "text" | "circle";

/**
 * Report a change to this page's annotations. Pass `before` to make the change
 * an undo step (the state to restore); omit it for transient updates that
 * belong to an already-recorded step (drag moves, keystrokes).
 */
export type AnnotationsChange = (
	pageNum: number,
	next: PageAnnotations,
	before?: PageAnnotations,
) => void;

interface PdfAnnotationLayerProps {
	pageNum: number;
	imageDataUrl: string;
	activeTool: Tool;
	strokeWidth: number;
	color: string;
	annotations: PageAnnotations;
	onChange: AnnotationsChange;
	onPageFocus?: (pageNum: number) => void;
}

function PdfAnnotationLayer({
	pageNum,
	imageDataUrl,
	activeTool,
	strokeWidth,
	color,
	annotations,
	onChange,
	onPageFocus,
}: PdfAnnotationLayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { texts, circles } = annotations;
	const [editingTextId, setEditingTextId] = useState<string | null>(null);
	const [hoveredCircleId, setHoveredCircleId] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const draggingTypeRef = useRef<"text" | "circle" | null>(null);
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	// The page state as it was when a drag started; recorded as the undo point on
	// the first move, then cleared so later moves are transient.
	const dragBeforeRef = useRef<PageAnnotations | null>(null);
	// A freshly placed, still-empty text box: its undo point (the page without
	// it) is recorded on the first keystroke, so an abandoned empty box costs
	// no undo step.
	const pendingTextRef = useRef<{ id: string; before: PageAnnotations } | null>(
		null,
	);
	const [drawingCircle, setDrawingCircle] = useState<{
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
	} | null>(null);

	// End text editing, discarding the annotation if it was left empty.
	const finishEditingText = useCallback(
		(id: string) => {
			const text = texts.find((t) => t.id === id);
			if (text && text.text.trim() === "") {
				onChange(pageNum, {
					texts: texts.filter((t) => t.id !== id),
					circles,
				});
			}
			if (pendingTextRef.current?.id === id) pendingTextRef.current = null;
			setEditingTextId((prev) => (prev === id ? null : prev));
		},
		[texts, circles, onChange, pageNum],
	);

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
				const pos = getRelativePos(e);
				const id = `text-${Date.now()}`;
				pendingTextRef.current = { id, before: annotations };
				onChange(pageNum, {
					texts: [
						...texts,
						{ id, x: pos.x, y: pos.y, text: "", fontSize: 16, color },
					],
					circles,
				});
				setEditingTextId(id);
			} else if (activeTool === "circle") {
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
		[
			activeTool,
			getRelativePos,
			color,
			onPageFocus,
			pageNum,
			annotations,
			texts,
			circles,
			onChange,
		],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (drawingCircle) {
				const pos = getRelativePos(e);
				setDrawingCircle((prev) =>
					prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null,
				);
				return;
			}
			if (!draggingId) return;

			const pos = getRelativePos(e);
			const x = clampPercent(pos.x - dragOffsetRef.current.x);
			const y = clampPercent(pos.y - dragOffsetRef.current.y);
			const next: PageAnnotations =
				draggingTypeRef.current === "text"
					? {
							texts: texts.map((t) =>
								t.id === draggingId ? { ...t, x, y } : t,
							),
							circles,
						}
					: {
							texts,
							circles: circles.map((c) =>
								c.id === draggingId ? { ...c, cx: x, cy: y } : c,
							),
						};
			// First move records the undo point; subsequent moves are transient.
			const before = dragBeforeRef.current ?? undefined;
			dragBeforeRef.current = null;
			onChange(pageNum, next, before);
		},
		[drawingCircle, draggingId, getRelativePos, texts, circles, onChange, pageNum],
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
				onChange(
					pageNum,
					{
						texts,
						circles: [
							...circles,
							{ id: `circle-${Date.now()}`, cx, cy, rx, ry, color, strokeWidth },
						],
					},
					annotations,
				);
			}
			setDrawingCircle(null);
		}

		if (draggingId) {
			setDraggingId(null);
			draggingTypeRef.current = null;
			dragBeforeRef.current = null;
		}
	}, [
		drawingCircle,
		draggingId,
		strokeWidth,
		color,
		annotations,
		texts,
		circles,
		onChange,
		pageNum,
	]);

	const startDraggingText = useCallback(
		(e: React.MouseEvent, textId: string) => {
			e.stopPropagation();
			e.preventDefault();
			onPageFocus?.(pageNum);
			const pos = getRelativePos(e);
			const text = texts.find((t) => t.id === textId);
			if (!text) return;
			dragOffsetRef.current = { x: pos.x - text.x, y: pos.y - text.y };
			dragBeforeRef.current = annotations;
			setDraggingId(textId);
			draggingTypeRef.current = "text";
			setEditingTextId(null);
		},
		[getRelativePos, texts, annotations, onPageFocus, pageNum],
	);

	const startDraggingCircle = useCallback(
		(e: React.MouseEvent, circleId: string) => {
			e.stopPropagation();
			e.preventDefault();
			onPageFocus?.(pageNum);
			const pos = getRelativePos(e);
			const circle = circles.find((c) => c.id === circleId);
			if (!circle) return;
			dragOffsetRef.current = { x: pos.x - circle.cx, y: pos.y - circle.cy };
			dragBeforeRef.current = annotations;
			setDraggingId(circleId);
			draggingTypeRef.current = "circle";
		},
		[getRelativePos, circles, annotations, onPageFocus, pageNum],
	);

	const updateTextContent = useCallback(
		(id: string, text: string) => {
			const next: PageAnnotations = {
				texts: texts.map((t) => (t.id === id ? { ...t, text } : t)),
				circles,
			};
			const pending = pendingTextRef.current;
			if (pending?.id === id && text.trim() !== "") {
				pendingTextRef.current = null;
				onChange(pageNum, next, pending.before);
			} else {
				onChange(pageNum, next);
			}
		},
		[texts, circles, onChange, pageNum],
	);

	const deleteAnnotation = useCallback(
		(id: string) => {
			onPageFocus?.(pageNum);
			onChange(
				pageNum,
				{
					texts: texts.filter((t) => t.id !== id),
					circles: circles.filter((c) => c.id !== id),
				},
				annotations,
			);
			if (editingTextId === id) setEditingTextId(null);
		},
		[editingTextId, onPageFocus, pageNum, annotations, texts, circles, onChange],
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

// Memoized: the parent re-renders on every annotation change (including each
// drag move), but only the edited page's `annotations` identity changes.
export default memo(PdfAnnotationLayer);
