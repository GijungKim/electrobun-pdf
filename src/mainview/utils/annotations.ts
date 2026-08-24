// The annotation document for an open PDF: one PageAnnotations per page, keyed
// by 1-based page number. Kept as plain immutable objects so a whole-document
// snapshot is just an object reference — the undo history (see history.ts)
// stores these snapshots directly, sharing untouched page slices between them.

import type { ExportAnnotation } from "./fileHandlers";

export interface TextAnnotation {
	id: string;
	x: number;
	y: number;
	text: string;
	fontSize: number;
	color: string;
}

export interface CircleAnnotation {
	id: string;
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	color: string;
	strokeWidth: number;
}

export interface PageAnnotations {
	readonly texts: readonly TextAnnotation[];
	readonly circles: readonly CircleAnnotation[];
}

export type DocAnnotations = Readonly<Record<number, PageAnnotations>>;

export const EMPTY_PAGE: PageAnnotations = Object.freeze({
	texts: Object.freeze([]) as readonly TextAnnotation[],
	circles: Object.freeze([]) as readonly CircleAnnotation[],
});

export const EMPTY_DOC: DocAnnotations = Object.freeze({});

export function pageAnnotations(
	doc: DocAnnotations,
	pageNum: number,
): PageAnnotations {
	return doc[pageNum] ?? EMPTY_PAGE;
}

export function withPage(
	doc: DocAnnotations,
	pageNum: number,
	page: PageAnnotations,
): DocAnnotations {
	return { ...doc, [pageNum]: page };
}

/**
 * The page whose slice differs between two snapshots, or null if none.
 * Every edit replaces exactly one page slice, so identity comparison is enough;
 * used after undo/redo to reveal the page that just changed.
 */
export function changedPage(a: DocAnnotations, b: DocAnnotations): number | null {
	const pages = new Set<number>();
	for (const k of Object.keys(a)) pages.add(Number(k));
	for (const k of Object.keys(b)) pages.add(Number(k));
	for (const p of [...pages].sort((x, y) => x - y)) {
		if (pageAnnotations(a, p) !== pageAnnotations(b, p)) return p;
	}
	return null;
}

/** Flatten one page's annotations into the export format; blank texts are skipped. */
export function toExportAnnotations(page: PageAnnotations): ExportAnnotation[] {
	return [
		...page.texts
			.filter((t) => t.text.trim())
			.map((t) => ({
				type: "text" as const,
				x: t.x,
				y: t.y,
				text: t.text,
				fontSize: t.fontSize,
				color: t.color,
			})),
		...page.circles.map((c) => ({
			type: "circle" as const,
			cx: c.cx,
			cy: c.cy,
			rx: c.rx,
			ry: c.ry,
			color: c.color,
			strokeWidth: c.strokeWidth,
		})),
	];
}
