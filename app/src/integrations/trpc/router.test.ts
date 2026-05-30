/**
 * Integration-level tests for the expense procedures that now carry real
 * rules: `update` edits amount + note of a *caller-owned* entry and never
 * touches `createdAt`, and ownership is enforced by pinning `userId` in the
 * `where` clause (so another user's id matches nothing — a no-op).
 *
 * Prisma is mocked at the `#/db` boundary so these run in the default node
 * environment with no database: we assert the exact `where`/`data` the
 * procedure hands Prisma, which is where the ownership + no-backdating
 * guarantees live. `#/lib/auth` is mocked only to keep importing the router
 * free of Better Auth / env side effects; the caller's context is built
 * directly, so the auth module itself is never exercised.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const deleteMany = vi.fn();
const create = vi.fn();

vi.mock("#/db", () => ({
	prisma: {
		expense: { updateMany, deleteMany, create },
	},
}));
vi.mock("#/lib/auth", () => ({ auth: {} }));

const { trpcRouter } = await import("./router");

function caller(userId: string | null) {
	return trpcRouter.createCaller({ userId });
}

beforeEach(() => {
	vi.clearAllMocks();
	updateMany.mockResolvedValue({ count: 1 });
	deleteMany.mockResolvedValue({ count: 1 });
});

describe("expense.update", () => {
	it("edits amount and note of a caller-owned entry", async () => {
		await caller("user-a").expense.update({
			id: "e1",
			amountCents: 2_000,
			note: "lunch",
		});

		expect(updateMany).toHaveBeenCalledTimes(1);
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "e1", userId: "user-a" },
			data: { amountCents: 2_000, note: "lunch" },
		});
	});

	it("never includes createdAt in the update (no backdating)", async () => {
		await caller("user-a").expense.update({ id: "e1", amountCents: 500 });

		const { data } = updateMany.mock.calls[0][0];
		expect(data).not.toHaveProperty("createdAt");
	});

	it("is a no-op against another user's id (scoped by id + userId)", async () => {
		// The row belongs to user-b; user-a edits it. Prisma matches nothing
		// (count 0) and the call resolves without throwing.
		updateMany.mockResolvedValue({ count: 0 });

		await expect(
			caller("user-a").expense.update({ id: "user-bs-row", amountCents: 999 }),
		).resolves.toBeUndefined();

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "user-bs-row", userId: "user-a" },
			data: { amountCents: 999, note: null },
		});
	});

	it("clears the note when given an empty string", async () => {
		await caller("user-a").expense.update({
			id: "e1",
			amountCents: 500,
			note: "   ",
		});

		expect(updateMany.mock.calls[0][0].data.note).toBeNull();
	});

	it("trims a whitespace-padded note", async () => {
		await caller("user-a").expense.update({
			id: "e1",
			amountCents: 500,
			note: "  coffee  ",
		});

		expect(updateMany.mock.calls[0][0].data.note).toBe("coffee");
	});

	it("rejects a zero amount but accepts a negative (adjustment) amount", async () => {
		// Zero is meaningless for any entry → rejected, and Prisma is never touched.
		await expect(
			caller("user-a").expense.update({ id: "e1", amountCents: 0 }),
		).rejects.toThrow();
		expect(updateMany).not.toHaveBeenCalled();

		// A negative amount is a valid adjustment edit (a top-up is stored negative),
		// so `update` resolves and forwards the signed amount to Prisma.
		await expect(
			caller("user-a").expense.update({ id: "e1", amountCents: -100 }),
		).resolves.toBeUndefined();
		expect(updateMany).toHaveBeenCalledTimes(1);
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "e1", userId: "user-a" },
			data: { amountCents: -100, note: null },
		});
	});

	it("rejects an unauthenticated caller", async () => {
		await expect(
			caller(null).expense.update({ id: "e1", amountCents: 500 }),
		).rejects.toThrow();
		expect(updateMany).not.toHaveBeenCalled();
	});
});

describe("expense.add", () => {
	beforeEach(() => {
		create.mockResolvedValue({
			id: "new-id",
			kind: "SPEND",
			amountCents: 1_000,
			note: null,
			createdAt: new Date("2025-03-18T10:00:00.000Z"),
		});
	});

	it("creates a spend with a positive amount and SPEND kind", async () => {
		await caller("user-a").expense.add({ kind: "spend", amountCents: 1_000 });

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				userId: "user-a",
				kind: "SPEND",
				amountCents: 1_000,
				note: null,
			},
		});
	});

	it("defaults the kind to a spend when none is given", async () => {
		await caller("user-a").expense.add({ amountCents: 1_000 });

		expect(create.mock.calls[0][0].data.kind).toBe("SPEND");
	});

	it("rejects a non-positive spend (zero and negative)", async () => {
		await expect(
			caller("user-a").expense.add({ kind: "spend", amountCents: 0 }),
		).rejects.toThrow();
		await expect(
			caller("user-a").expense.add({ kind: "spend", amountCents: -100 }),
		).rejects.toThrow();
		// And the same when relying on the default kind.
		await expect(
			caller("user-a").expense.add({ amountCents: -100 }),
		).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();
	});

	it("accepts a positive (set-aside) adjustment and stores ADJUSTMENT kind", async () => {
		await caller("user-a").expense.add({
			kind: "adjustment",
			amountCents: 5_000,
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				userId: "user-a",
				kind: "ADJUSTMENT",
				amountCents: 5_000,
				note: null,
			},
		});
	});

	it("accepts a negative (top-up) adjustment and forwards the signed amount", async () => {
		await caller("user-a").expense.add({
			kind: "adjustment",
			amountCents: -5_000,
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0].data).toMatchObject({
			kind: "ADJUSTMENT",
			amountCents: -5_000,
		});
	});

	it("rejects a zero adjustment amount", async () => {
		await expect(
			caller("user-a").expense.add({ kind: "adjustment", amountCents: 0 }),
		).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();
	});

	it("rejects an unauthenticated caller", async () => {
		await expect(
			caller(null).expense.add({ kind: "spend", amountCents: 1_000 }),
		).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();
	});
});
