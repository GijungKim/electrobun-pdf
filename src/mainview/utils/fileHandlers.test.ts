import { test, expect, describe } from "bun:test";
import { uint8ToBase64 } from "./fileHandlers";

describe("uint8ToBase64", () => {
	test("empty input returns empty string", () => {
		expect(uint8ToBase64(new Uint8Array([]))).toBe("");
	});

	test("encodes a small known input", () => {
		// "Hi" -> bytes [72, 105] -> base64 "SGk="
		expect(uint8ToBase64(new Uint8Array([72, 105]))).toBe("SGk=");
	});

	test("round-trips across the 8192-byte chunk boundary", () => {
		const len = 8192 * 2 + 5; // spans three chunks
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) bytes[i] = i % 256;

		const decoded = atob(uint8ToBase64(bytes));
		expect(decoded.length).toBe(len);
		for (let i = 0; i < len; i++) {
			expect(decoded.charCodeAt(i)).toBe(bytes[i]);
		}
	});
});
