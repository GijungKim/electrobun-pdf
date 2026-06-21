import { test, expect, describe } from "bun:test";
import { circleFromDrag, fitImageToPage, clampPercent } from "./geometry";

describe("circleFromDrag", () => {
	test("computes center and radii for a forward drag", () => {
		expect(circleFromDrag(10, 20, 30, 60)).toEqual({
			cx: 20,
			cy: 40,
			rx: 10,
			ry: 20,
		});
	});

	test("is direction-independent (reversed drag → same circle)", () => {
		expect(circleFromDrag(30, 60, 10, 20)).toEqual({
			cx: 20,
			cy: 40,
			rx: 10,
			ry: 20,
		});
	});

	test("zero-size drag yields zero radii", () => {
		expect(circleFromDrag(5, 5, 5, 5)).toEqual({
			cx: 5,
			cy: 5,
			rx: 0,
			ry: 0,
		});
	});
});

describe("fitImageToPage", () => {
	const W = 200;
	const H = 287;
	const M = 5;

	test("wide image is width-constrained and vertically centered", () => {
		const fit = fitImageToPage(1000, 500, W, H, M); // aspect 2.0 > 200/287
		expect(fit.drawWidth).toBeCloseTo(200, 5);
		expect(fit.drawHeight).toBeCloseTo(100, 5);
		expect(fit.xOffset).toBeCloseTo(5, 5);
		expect(fit.yOffset).toBeCloseTo(98.5, 5);
	});

	test("tall image is height-constrained and horizontally centered", () => {
		const fit = fitImageToPage(500, 1000, W, H, M); // aspect 0.5 < 200/287
		expect(fit.drawHeight).toBeCloseTo(287, 5);
		expect(fit.drawWidth).toBeCloseTo(143.5, 5);
		expect(fit.xOffset).toBeCloseTo(33.25, 5);
		expect(fit.yOffset).toBeCloseTo(5, 5);
	});
});

describe("clampPercent", () => {
	test("passes through an in-range value", () => {
		expect(clampPercent(42)).toBe(42);
	});

	test("clamps a negative value to 0", () => {
		expect(clampPercent(-5)).toBe(0);
	});

	test("clamps a value above 100 to 100", () => {
		expect(clampPercent(137)).toBe(100);
	});

	test("keeps the exact bounds", () => {
		expect(clampPercent(0)).toBe(0);
		expect(clampPercent(100)).toBe(100);
	});
});
