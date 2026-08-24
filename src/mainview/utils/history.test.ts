import { test, expect, describe } from "bun:test";
import {
	canRedo,
	canUndo,
	commit,
	createHistory,
	redo,
	replace,
	undo,
} from "./history";

describe("history", () => {
	test("fresh history has nothing to undo or redo", () => {
		const h = createHistory("a");
		expect(h.present).toBe("a");
		expect(canUndo(h)).toBe(false);
		expect(canRedo(h)).toBe(false);
		expect(undo(h)).toBe(h);
		expect(redo(h)).toBe(h);
	});

	test("commit records an undo point and undo restores it", () => {
		let h = createHistory("a");
		h = commit(h, "a", "b");
		expect(h.present).toBe("b");
		expect(canUndo(h)).toBe(true);
		h = undo(h);
		expect(h.present).toBe("a");
		expect(canUndo(h)).toBe(false);
		expect(canRedo(h)).toBe(true);
	});

	test("supports many levels, in order", () => {
		let h = createHistory(0);
		for (let i = 1; i <= 5; i++) h = commit(h, i - 1, i);
		expect(h.present).toBe(5);
		h = undo(h);
		h = undo(h);
		expect(h.present).toBe(3);
		h = redo(h);
		expect(h.present).toBe(4);
		h = undo(undo(undo(undo(h))));
		expect(h.present).toBe(0);
		expect(canUndo(h)).toBe(false);
	});

	test("a commit after undo discards the redo stack", () => {
		let h = commit(createHistory("a"), "a", "b");
		h = undo(h);
		expect(canRedo(h)).toBe(true);
		h = commit(h, "a", "c");
		expect(h.present).toBe("c");
		expect(canRedo(h)).toBe(false);
	});

	test("replace changes the present without adding an undo step", () => {
		let h = commit(createHistory("a"), "a", "b");
		h = replace(h, "b2");
		h = replace(h, "b3");
		expect(h.present).toBe("b3");
		expect(h.past).toEqual(["a"]);
		// Undo goes straight back past all the transient replaces …
		h = undo(h);
		expect(h.present).toBe("a");
		// … and redo lands on the latest transient value, not the committed one.
		h = redo(h);
		expect(h.present).toBe("b3");
	});

	test("undo point is the explicit `before`, not the previous present", () => {
		// Models a drag: transient moves happened before the commit was recorded.
		let h = createHistory("start");
		h = replace(h, "moved-a-bit");
		h = commit(h, "start", "moved-more");
		h = undo(h);
		expect(h.present).toBe("start");
	});

	test("history is capped at the limit, dropping the oldest entries", () => {
		let h = createHistory(0);
		for (let i = 1; i <= 10; i++) h = commit(h, i - 1, i, 3);
		expect(h.past).toEqual([7, 8, 9]);
		expect(h.present).toBe(10);
	});

	test("does not mutate inputs", () => {
		const h0 = createHistory("a");
		const h1 = commit(h0, "a", "b");
		const h2 = undo(h1);
		redo(h2);
		expect(h0).toEqual({ past: [], present: "a", future: [] });
		expect(h1).toEqual({ past: ["a"], present: "b", future: [] });
		expect(h2).toEqual({ past: [], present: "a", future: ["b"] });
	});
});
