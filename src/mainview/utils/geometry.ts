// Pure geometry helpers extracted from the PDF annotation + export paths so the
// coordinate math can be unit-tested in isolation (no React, no jsPDF, no DOM).

export interface Circle {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
}

/**
 * Compute an ellipse (center + radii) from two drag corner points.
 * Direction-independent: radii are always non-negative.
 * Units are whatever the caller uses (this app uses 0–100 percentages).
 */
export function circleFromDrag(
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
): Circle {
	return {
		cx: (startX + currentX) / 2,
		cy: (startY + currentY) / 2,
		rx: Math.abs(currentX - startX) / 2,
		ry: Math.abs(currentY - startY) / 2,
	};
}

export interface ImageFit {
	drawWidth: number;
	drawHeight: number;
	xOffset: number;
	yOffset: number;
}

/**
 * Scale an image to fit inside a page's content box while preserving aspect
 * ratio, then center it. All values share the caller's unit (mm in exportToPdf).
 */
export function fitImageToPage(
	imgWidth: number,
	imgHeight: number,
	contentWidth: number,
	contentHeight: number,
	margin: number,
): ImageFit {
	const imgAspect = imgWidth / imgHeight;
	const pageAspect = contentWidth / contentHeight;

	let drawWidth: number;
	let drawHeight: number;

	if (imgAspect > pageAspect) {
		drawWidth = contentWidth;
		drawHeight = contentWidth / imgAspect;
	} else {
		drawHeight = contentHeight;
		drawWidth = contentHeight * imgAspect;
	}

	const xOffset = margin + (contentWidth - drawWidth) / 2;
	const yOffset = margin + (contentHeight - drawHeight) / 2;

	return { drawWidth, drawHeight, xOffset, yOffset };
}

/**
 * Clamp a page-relative percentage coordinate to the visible page range
 * [0, 100], so a dragged annotation can't leave the page (and be lost on export).
 */
export function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}
