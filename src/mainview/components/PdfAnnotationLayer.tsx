import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { PageAnnotations } from "../utils/annotations";
import { circleFromDrag, clampPercent } from "../utils/geometry";
import type { PdfTextRegion } from "../../shared/types";

export type Tool = "select" | "replace" | "text" | "circle";

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
	textRegions: readonly PdfTextRegion[];
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
	textRegions,
	onChange,
	onPageFocus,
}: PdfAnnotationLayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { texts, circles, replacements } = annotations;
	const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
	const [replacementDraft, setReplacementDraft] = useState("");
	const [pageScale, setPageScale] = useState(1);
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

	useEffect(() => {
		const container = containerRef.current;
		const pageWidth = textRegions[0]?.pageWidth;
		if (!container || !pageWidth) return;
		const updateScale = () => setPageScale(container.clientWidth / pageWidth);
		updateScale();
		const observer = new ResizeObserver(updateScale);
		observer.observe(container);
		return () => observer.disconnect();
	}, [textRegions]);

	// End text editing, discarding the annotation if it was left empty.
	const finishEditingText = useCallback(
		(id: string) => {
			const text = texts.find((t) => t.id === id);
			if (text && text.text.trim() === "") {
				onChange(pageNum, {
					texts: texts.filter((t) => t.id !== id),
					circles,
					replacements,
				});
			}
			if (pendingTextRef.current?.id === id) pendingTextRef.current = null;
			setEditingTextId((prev) => (prev === id ? null : prev));
		},
		[texts, circles, replacements, onChange, pageNum],
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
					replacements,
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
			replacements,
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
							replacements,
						}
					: {
							texts,
							circles: circles.map((c) =>
								c.id === draggingId ? { ...c, cx: x, cy: y } : c,
							),
							replacements,
						};
			// First move records the undo point; subsequent moves are transient.
			const before = dragBeforeRef.current ?? undefined;
			dragBeforeRef.current = null;
			onChange(pageNum, next, before);
		},
		[drawingCircle, draggingId, getRelativePos, texts, circles, replacements, onChange, pageNum],
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
						replacements,
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
		replacements,
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
				replacements,
			};
			const pending = pendingTextRef.current;
			if (pending?.id === id && text.trim() !== "") {
				pendingTextRef.current = null;
				onChange(pageNum, next, pending.before);
			} else {
				onChange(pageNum, next);
			}
		},
		[texts, circles, replacements, onChange, pageNum],
	);

	const deleteAnnotation = useCallback(
		(id: string) => {
			onPageFocus?.(pageNum);
			onChange(
				pageNum,
				{
					texts: texts.filter((t) => t.id !== id),
					circles: circles.filter((c) => c.id !== id),
					replacements,
				},
				annotations,
			);
			if (editingTextId === id) setEditingTextId(null);
		},
		[editingTextId, onPageFocus, pageNum, annotations, texts, circles, replacements, onChange],
	);

	const startReplacement = useCallback(
		(e: React.MouseEvent, region: PdfTextRegion) => {
			e.stopPropagation();
			onPageFocus?.(pageNum);
			setEditingRegionId(region.id);
			setReplacementDraft(
				replacements.find((item) => item.regionId === region.id)?.text ?? region.text,
			);
		},
		[onPageFocus, pageNum, replacements],
	);

	const finishReplacement = useCallback(() => {
		const region = textRegions.find((item) => item.id === editingRegionId);
		setEditingRegionId(null);
		if (!region) return;
		const value = replacementDraft.trim();
		if (!value) return;
		if (value === region.text) {
			if (replacements.some((item) => item.regionId === region.id)) {
				onChange(
					pageNum,
					{
						texts,
						circles,
						replacements: replacements.filter(
							(item) => item.regionId !== region.id,
						),
					},
					annotations,
				);
			}
			return;
		}
		const replacement = {
			regionId: region.id,
			originalText: region.text,
			text: value,
			rect: region.rect,
			fontSize: region.fontSize,
			fontFamily: region.fontFamily,
			fontName: region.fontName,
			fontStyle: region.fontStyle,
			baseline: region.baseline,
			color: region.color,
		};
		onChange(
			pageNum,
			{
				texts,
				circles,
				replacements: [
					...replacements.filter((item) => item.regionId !== region.id),
					replacement,
				],
			},
			annotations,
		);
	}, [
		editingRegionId,
		replacementDraft,
		textRegions,
		onChange,
		pageNum,
		texts,
		circles,
		replacements,
		annotations,
	]);

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
			: activeTool === "replace"
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
			{activeTool === "replace" && (
				<div className="absolute right-2 top-2 z-10 rounded bg-surface-950/80 px-2 py-1 text-[10px] text-white pointer-events-none">
					Original fonts are reused when possible · fallback is reported on export
				</div>
			)}

			{/* MuPDF word geometry: click a word in Replace mode to edit it. */}
			{textRegions.map((region) => {
				const [x1, y1, x2, y2] = region.percentRect;
				const replacement = replacements.find(
					(item) => item.regionId === region.id,
				);
				const fontSizePoints = replacement
					? Math.max(
							5,
							Math.min(
								region.fontSize,
								region.fontSize *
									([...region.text].length /
										Math.max(1, [...replacement.text].length)),
							),
						)
					: region.fontSize;
				const fontSize = fontSizePoints * pageScale;
				return (
					<div
						key={region.id}
						className={`absolute ${activeTool === "replace" ? "hover:outline hover:outline-2 hover:outline-accent/80 bg-accent/5" : "pointer-events-none"}`}
						style={{
							left: `${x1}%`,
							top: `${y1}%`,
							width: `${x2 - x1}%`,
							height: `${y2 - y1}%`,
						}}
						onClick={(event) =>
							activeTool === "replace" && startReplacement(event, region)
						}
					>
						{replacement && editingRegionId !== region.id && (
							<span
								className="absolute inset-0 bg-white whitespace-nowrap leading-none flex items-center"
								style={{
									fontSize,
									fontFamily:
										region.fontFamily === "Times-Roman"
											? "Times New Roman, serif"
											: region.fontFamily === "Courier"
												? "Courier New, monospace"
												: "Arial, Helvetica, sans-serif",
									fontWeight: region.fontStyle?.bold ? 700 : 400,
									fontStyle: region.fontStyle?.italic ? "italic" : "normal",
									color: `rgb(${replacement.color.map((v) => Math.round(v * 255)).join(",")})`,
								}}
							>
								{replacement.text}
							</span>
						)}
						{editingRegionId === region.id && (
							<input
								autoFocus
								aria-label={`Replace ${region.text}`}
								value={replacementDraft}
								onChange={(event) => setReplacementDraft(event.target.value)}
								onBlur={finishReplacement}
								onKeyDown={(event) => {
									if (event.key === "Enter") event.currentTarget.blur();
									if (event.key === "Escape") setEditingRegionId(null);
								}}
								onClick={(event) => event.stopPropagation()}
								className="absolute left-0 top-0 z-20 min-w-[8rem] bg-white border border-accent rounded-sm px-1 py-0.5 text-surface-950 shadow-lg outline-none"
								style={{ fontSize: Math.max(11, region.fontSize * pageScale) }}
							/>
						)}
					</div>
				);
			})}

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
