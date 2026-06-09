import { describe, expect, it } from "vitest";
import { moveItem } from "./routine";

describe("moveItem", () => {
	it("moves an item down one position", () => {
		expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
	});

	it("moves an item up one position", () => {
		expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
	});

	it("moves a middle item in both directions", () => {
		expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
	});

	it("is a no-op when moving the first item up", () => {
		expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
	});

	it("is a no-op when moving the last item down", () => {
		expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
	});

	it("is a no-op for an out-of-range index", () => {
		expect(moveItem(["a", "b"], 5, -1)).toEqual(["a", "b"]);
		expect(moveItem(["a", "b"], -1, 1)).toEqual(["a", "b"]);
	});

	it("returns a new array and leaves the input untouched", () => {
		const input = ["a", "b", "c"];
		const result = moveItem(input, 0, 1);
		expect(result).not.toBe(input);
		expect(input).toEqual(["a", "b", "c"]);
	});

	it("returns a copy even for no-op moves", () => {
		const input = ["a", "b"];
		expect(moveItem(input, 0, -1)).not.toBe(input);
	});
});
