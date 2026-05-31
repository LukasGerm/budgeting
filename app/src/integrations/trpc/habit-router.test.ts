/**
 * Integration-level tests for the `habitRouter` procedures.
 *
 * Mirrors router.test.ts: Prisma is mocked at the `#/db` boundary; the caller
 * context is built directly via `trpcRouter.createCaller`; auth is mocked to
 * prevent env side-effects. We assert the exact `where`/`data`/`include` shapes
 * the procedure hands Prisma — that's where the ownership and day-mapping
 * guarantees live.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Prisma mocks (must be declared before the dynamic import) ----

const habitFindMany = vi.fn();
const habitFindFirst = vi.fn();
const habitCreate = vi.fn();
const habitUpdateMany = vi.fn();
const habitDeleteMany = vi.fn();
const habitCompletionUpsert = vi.fn();
const habitCompletionDeleteMany = vi.fn();

vi.mock("#/db", () => ({
	prisma: {
		habit: {
			findMany: habitFindMany,
			findFirst: habitFindFirst,
			create: habitCreate,
			updateMany: habitUpdateMany,
			deleteMany: habitDeleteMany,
		},
		habitCompletion: {
			upsert: habitCompletionUpsert,
			deleteMany: habitCompletionDeleteMany,
		},
	},
}));
vi.mock("#/lib/auth", () => ({ auth: {} }));

const { trpcRouter } = await import("./router");

function caller(userId: string | null) {
	return trpcRouter.createCaller({ userId });
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// habit.list
// ---------------------------------------------------------------------------

describe("habit.list", () => {
	it("queries scoped to ctx.userId with createdAt asc order and includes completions", async () => {
		habitFindMany.mockResolvedValue([]);

		await caller("user-a").habit.list();

		expect(habitFindMany).toHaveBeenCalledTimes(1);
		expect(habitFindMany).toHaveBeenCalledWith({
			where: { userId: "user-a" },
			orderBy: { createdAt: "asc" },
			include: { completions: true },
		});
	});

	it("maps a completion @db.Date (UTC-midnight Date) to an ISO YYYY-MM-DD string via UTC parts", async () => {
		// A UTC-midnight Date for 2025-03-20 — what Prisma returns for a @db.Date value.
		const utcMidnight = new Date("2025-03-20T00:00:00.000Z");

		habitFindMany.mockResolvedValue([
			{
				id: "h1",
				name: "Read",
				icon: "BookOpen",
				color: "#f87171",
				createdAt: new Date("2025-01-01T00:00:00.000Z"),
				completions: [{ day: utcMidnight }],
			},
		]);

		const rows = await caller("user-a").habit.list();

		expect(rows).toHaveLength(1);
		expect(rows[0].completionDays).toEqual(["2025-03-20"]);
	});

	it("returns an empty completionDays array when a habit has no completions", async () => {
		habitFindMany.mockResolvedValue([
			{
				id: "h1",
				name: "Read",
				icon: "BookOpen",
				color: "#f87171",
				createdAt: new Date("2025-01-01T00:00:00.000Z"),
				completions: [],
			},
		]);

		const rows = await caller("user-a").habit.list();
		expect(rows[0].completionDays).toEqual([]);
	});

	it("returns the full wire shape for each habit", async () => {
		const createdAt = new Date("2025-01-15T12:00:00.000Z");
		habitFindMany.mockResolvedValue([
			{
				id: "h1",
				name: "Meditate",
				icon: "Moon",
				color: "#818cf8",
				createdAt,
				completions: [],
			},
		]);

		const rows = await caller("user-a").habit.list();
		expect(rows[0]).toMatchObject({
			id: "h1",
			name: "Meditate",
			icon: "Moon",
			color: "#818cf8",
			createdAt,
			completionDays: [],
		});
	});

	it("rejects an unauthenticated caller", async () => {
		await expect(caller(null).habit.list()).rejects.toThrow();
		expect(habitFindMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// habit.create
// ---------------------------------------------------------------------------

describe("habit.create", () => {
	beforeEach(() => {
		// Default: no existing habits for the color-picking findMany.
		habitFindMany.mockResolvedValue([]);
		habitCreate.mockResolvedValue({
			id: "h-new",
			name: "Run",
			icon: "Footprints",
			color: "#f87171",
			createdAt: new Date("2025-03-20T10:00:00.000Z"),
		});
	});

	it("scopes the create to ctx.userId", async () => {
		await caller("user-a").habit.create({ name: "Run", icon: "Footprints" });

		expect(habitCreate).toHaveBeenCalledTimes(1);
		const { data } = habitCreate.mock.calls[0][0];
		expect(data.userId).toBe("user-a");
	});

	it("forwards the trimmed name and icon to Prisma", async () => {
		await caller("user-a").habit.create({
			name: "  Run  ",
			icon: "Footprints",
		});

		const { data } = habitCreate.mock.calls[0][0];
		expect(data.name).toBe("Run");
		expect(data.icon).toBe("Footprints");
	});

	it("assigns a color via pickHabitColor — picks a palette entry not in usedColors", async () => {
		// First two palette colors are in use; the third should be chosen.
		habitFindMany.mockResolvedValue([
			{ color: "#f87171" }, // red-400
			{ color: "#fb923c" }, // orange-400
		]);

		await caller("user-a").habit.create({ name: "Meditate", icon: "Moon" });

		const { data } = habitCreate.mock.calls[0][0];
		// Third palette entry is "#facc15" (yellow-400).
		expect(data.color).toBe("#facc15");
	});

	it("falls back deterministically when all palette colors are used", async () => {
		// Provide all 10 palette colors as used.
		habitFindMany.mockResolvedValue([
			{ color: "#f87171" },
			{ color: "#fb923c" },
			{ color: "#facc15" },
			{ color: "#4ade80" },
			{ color: "#34d399" },
			{ color: "#22d3ee" },
			{ color: "#818cf8" },
			{ color: "#e879f9" },
			{ color: "#f472b6" },
			{ color: "#a78bfa" },
		]);

		await caller("user-a").habit.create({ name: "Hydrate", icon: "Droplet" });

		const { data } = habitCreate.mock.calls[0][0];
		// 10 used colors, palette length 10 → fallback index = 10 % 10 = 0 → "#f87171"
		expect(data.color).toBe("#f87171");
	});

	it("queries the caller's existing colors scoped to userId", async () => {
		await caller("user-a").habit.create({ name: "Read", icon: "BookOpen" });

		// First findMany is the color-query (second would be unexpected).
		expect(habitFindMany).toHaveBeenCalledWith({
			where: { userId: "user-a" },
			select: { color: true },
		});
	});

	it("returns the created habit in the list wire shape with empty completionDays", async () => {
		const createdAt = new Date("2025-03-20T10:00:00.000Z");
		habitCreate.mockResolvedValue({
			id: "h-new",
			name: "Run",
			icon: "Footprints",
			color: "#f87171",
			createdAt,
		});

		const result = await caller("user-a").habit.create({
			name: "Run",
			icon: "Footprints",
		});

		expect(result).toMatchObject({
			id: "h-new",
			name: "Run",
			icon: "Footprints",
			color: "#f87171",
			createdAt,
			completionDays: [],
		});
	});

	it("rejects an empty name after trimming", async () => {
		await expect(
			caller("user-a").habit.create({ name: "   ", icon: "BookOpen" }),
		).rejects.toThrow();
		expect(habitCreate).not.toHaveBeenCalled();
	});

	it("rejects a name exceeding 60 characters", async () => {
		await expect(
			caller("user-a").habit.create({
				name: "A".repeat(61),
				icon: "BookOpen",
			}),
		).rejects.toThrow();
		expect(habitCreate).not.toHaveBeenCalled();
	});

	it("rejects an icon outside the curated set", async () => {
		await expect(
			// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test validation
			caller("user-a").habit.create({ name: "Run", icon: "NotAnIcon" as any }),
		).rejects.toThrow();
		expect(habitCreate).not.toHaveBeenCalled();
	});

	it("rejects an unauthenticated caller", async () => {
		await expect(
			caller(null).habit.create({ name: "Run", icon: "Footprints" }),
		).rejects.toThrow();
		expect(habitCreate).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// habit.toggleCompletion
// ---------------------------------------------------------------------------

describe("habit.toggleCompletion", () => {
	const HABIT_ID = "habit-1";
	const ISO_DAY = "2025-03-20";
	// UTC-midnight Date corresponding to 2025-03-20.
	const UTC_DAY = new Date("2025-03-20T00:00:00.000Z");

	beforeEach(() => {
		// Default: habit is owned by "user-a".
		habitFindFirst.mockResolvedValue({ id: HABIT_ID });
		habitCompletionUpsert.mockResolvedValue({});
		habitCompletionDeleteMany.mockResolvedValue({ count: 1 });
	});

	it("done:true — verifies ownership with findFirst scoped to userId", async () => {
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: ISO_DAY,
			done: true,
		});

		expect(habitFindFirst).toHaveBeenCalledTimes(1);
		expect(habitFindFirst).toHaveBeenCalledWith({
			where: { id: HABIT_ID, userId: "user-a" },
			select: { id: true },
		});
	});

	it("done:true — calls upsert with the correct compound selector and UTC-midnight day", async () => {
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: ISO_DAY,
			done: true,
		});

		expect(habitCompletionUpsert).toHaveBeenCalledTimes(1);
		expect(habitCompletionUpsert).toHaveBeenCalledWith({
			where: { habitId_day: { habitId: HABIT_ID, day: UTC_DAY } },
			create: { habitId: HABIT_ID, day: UTC_DAY },
			update: {},
		});
		expect(habitCompletionDeleteMany).not.toHaveBeenCalled();
	});

	it("done:false — calls deleteMany with the correct where clause and UTC-midnight day", async () => {
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: ISO_DAY,
			done: false,
		});

		expect(habitCompletionDeleteMany).toHaveBeenCalledTimes(1);
		expect(habitCompletionDeleteMany).toHaveBeenCalledWith({
			where: { habitId: HABIT_ID, day: UTC_DAY },
		});
		expect(habitCompletionUpsert).not.toHaveBeenCalled();
	});

	it("ownership no-op: findFirst returns null (another user's habit) — no write happens", async () => {
		habitFindFirst.mockResolvedValue(null);

		// Should resolve without throwing.
		await expect(
			caller("user-b").habit.toggleCompletion({
				habitId: HABIT_ID,
				day: ISO_DAY,
				done: true,
			}),
		).resolves.toBeUndefined();

		expect(habitCompletionUpsert).not.toHaveBeenCalled();
		expect(habitCompletionDeleteMany).not.toHaveBeenCalled();
	});

	it("idempotency: a second done:true still calls upsert — update:{} makes it safe", async () => {
		// First tap.
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: ISO_DAY,
			done: true,
		});
		// Second tap (double-tap).
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: ISO_DAY,
			done: true,
		});

		// Upsert called twice — both invocations use the same where/create/update
		// shape; the second is a no-op on the DB side because of @@unique.
		expect(habitCompletionUpsert).toHaveBeenCalledTimes(2);
	});

	it("UTC day parse: the stored Date is exactly UTC midnight for the ISO input", async () => {
		await caller("user-a").habit.toggleCompletion({
			habitId: HABIT_ID,
			day: "2025-12-31",
			done: true,
		});

		const expectedDay = new Date("2025-12-31T00:00:00.000Z");
		const { where } = habitCompletionUpsert.mock.calls[0][0];
		expect(where.habitId_day.day).toEqual(expectedDay);
		// Confirm UTC parts (not local — the round-trip relies on UTC).
		expect(where.habitId_day.day.toISOString().slice(0, 10)).toBe("2025-12-31");
	});

	it("rejects an unauthenticated caller — no Prisma calls", async () => {
		await expect(
			caller(null).habit.toggleCompletion({
				habitId: HABIT_ID,
				day: ISO_DAY,
				done: true,
			}),
		).rejects.toThrow();

		expect(habitFindFirst).not.toHaveBeenCalled();
		expect(habitCompletionUpsert).not.toHaveBeenCalled();
		expect(habitCompletionDeleteMany).not.toHaveBeenCalled();
	});

	it("rejects an invalid day format (not YYYY-MM-DD)", async () => {
		await expect(
			caller("user-a").habit.toggleCompletion({
				habitId: HABIT_ID,
				day: "20-03-2025", // wrong format
				done: true,
			}),
		).rejects.toThrow();

		expect(habitFindFirst).not.toHaveBeenCalled();
		expect(habitCompletionUpsert).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// habit.update
// ---------------------------------------------------------------------------

describe("habit.update", () => {
	beforeEach(() => {
		habitUpdateMany.mockResolvedValue({ count: 1 });
	});

	it("calls updateMany with where pinning id and userId", async () => {
		await caller("user-a").habit.update({
			id: "h1",
			name: "Read",
			icon: "BookOpen",
		});

		expect(habitUpdateMany).toHaveBeenCalledTimes(1);
		expect(habitUpdateMany).toHaveBeenCalledWith({
			where: { id: "h1", userId: "user-a" },
			data: { name: "Read", icon: "BookOpen" },
		});
	});

	it("color is absent from data — immutable post-create", async () => {
		await caller("user-a").habit.update({
			id: "h1",
			name: "Read",
			icon: "BookOpen",
		});

		const { data } = habitUpdateMany.mock.calls[0][0];
		expect(data).not.toHaveProperty("color");
	});

	it("trims whitespace from the name before persisting", async () => {
		await caller("user-a").habit.update({
			id: "h1",
			name: "  Run  ",
			icon: "Footprints",
		});

		const { data } = habitUpdateMany.mock.calls[0][0];
		expect(data.name).toBe("Run");
	});

	it("no-op when updateMany matches 0 rows (another user's id) — no throw", async () => {
		habitUpdateMany.mockResolvedValue({ count: 0 });

		// Should resolve without throwing.
		await expect(
			caller("user-b").habit.update({
				id: "h1",
				name: "Read",
				icon: "BookOpen",
			}),
		).resolves.toBeUndefined();
	});

	it("rejects an empty name after trimming", async () => {
		await expect(
			caller("user-a").habit.update({
				id: "h1",
				name: "   ",
				icon: "BookOpen",
			}),
		).rejects.toThrow();
		expect(habitUpdateMany).not.toHaveBeenCalled();
	});

	it("rejects a name exceeding 60 characters", async () => {
		await expect(
			caller("user-a").habit.update({
				id: "h1",
				name: "A".repeat(61),
				icon: "BookOpen",
			}),
		).rejects.toThrow();
		expect(habitUpdateMany).not.toHaveBeenCalled();
	});

	it("rejects an icon outside the curated set", async () => {
		await expect(
			caller("user-a").habit.update({
				id: "h1",
				name: "Read",
				// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test validation
				icon: "NotAnIcon" as any,
			}),
		).rejects.toThrow();
		expect(habitUpdateMany).not.toHaveBeenCalled();
	});

	it("rejects an unauthenticated caller — no Prisma calls", async () => {
		await expect(
			caller(null).habit.update({ id: "h1", name: "Read", icon: "BookOpen" }),
		).rejects.toThrow();
		expect(habitUpdateMany).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// habit.delete
// ---------------------------------------------------------------------------

describe("habit.delete", () => {
	beforeEach(() => {
		habitDeleteMany.mockResolvedValue({ count: 1 });
	});

	it("calls deleteMany with where pinning id and userId", async () => {
		await caller("user-a").habit.delete({ id: "h1" });

		expect(habitDeleteMany).toHaveBeenCalledTimes(1);
		expect(habitDeleteMany).toHaveBeenCalledWith({
			where: { id: "h1", userId: "user-a" },
		});
	});

	it("no-op when deleteMany matches 0 rows (another user's id) — no throw", async () => {
		habitDeleteMany.mockResolvedValue({ count: 0 });

		// Should resolve without throwing.
		await expect(
			caller("user-b").habit.delete({ id: "h1" }),
		).resolves.toBeUndefined();
	});

	it("rejects an unauthenticated caller — no Prisma calls", async () => {
		await expect(caller(null).habit.delete({ id: "h1" })).rejects.toThrow();
		expect(habitDeleteMany).not.toHaveBeenCalled();
	});
});
