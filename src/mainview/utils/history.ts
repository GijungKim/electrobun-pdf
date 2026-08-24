// Generic, immutable undo/redo history. Pure and dependency-free so it can be
// unit-tested; the app keeps one History<DocAnnotations> for the whole PDF.
//
// Two kinds of update:
//   commit(before, next)  — records `before` as an undo point, makes `next` the
//                           present, and discards any redo entries.
//   replace(next)         — swaps the present without touching history. Used
//                           for transient updates (each mousemove of a drag,
//                           each keystroke in a text box) so one user action
//                           costs one undo step.

export interface History<T> {
	readonly past: readonly T[];
	readonly present: T;
	readonly future: readonly T[];
}

export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
	return { past: [], present, future: [] };
}

export function commit<T>(
	h: History<T>,
	before: T,
	next: T,
	limit: number = DEFAULT_HISTORY_LIMIT,
): History<T> {
	const past = [...h.past, before];
	if (past.length > limit) past.splice(0, past.length - limit);
	return { past, present: next, future: [] };
}

export function replace<T>(h: History<T>, next: T): History<T> {
	return { past: h.past, present: next, future: h.future };
}

export function canUndo<T>(h: History<T>): boolean {
	return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
	return h.future.length > 0;
}

/** Step back one entry. No-op (same object) when there is nothing to undo. */
export function undo<T>(h: History<T>): History<T> {
	if (!canUndo(h)) return h;
	const past = h.past.slice(0, -1);
	const present = h.past[h.past.length - 1] as T;
	return { past, present, future: [h.present, ...h.future] };
}

/** Step forward one entry. No-op (same object) when there is nothing to redo. */
export function redo<T>(h: History<T>): History<T> {
	if (!canRedo(h)) return h;
	const [present, ...future] = h.future as [T, ...T[]];
	return { past: [...h.past, h.present], present, future };
}
