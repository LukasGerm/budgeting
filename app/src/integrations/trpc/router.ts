import { setCookie } from "@tanstack/react-start/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { HABIT_ICON_NAMES } from "#/components/habits/habit-icons";
import { prisma } from "#/db";
import {
	bestEpley1RmGrams,
	bestSet,
	getCurrentCycle,
	getRecentCycles,
	HABIT_COLOR_PALETTE,
	MAX_REPS,
	MAX_WEIGHT_GRAMS,
	pickHabitColor,
	STREAK_WINDOW_DAYS,
	workoutVolumeGrams,
} from "#/domain";
import { EntryKind, Equipment, MuscleGroup } from "#/generated/prisma/enums";
import {
	CURRENCY_COOKIE,
	LOCALE_COOKIE,
	SUPPORTED_CURRENCIES,
	SUPPORTED_LOCALES,
} from "#/i18n/config";
import { createTRPCRouter, protectedProcedure } from "./init";

/** Wire `kind` ("spend"|"adjustment") → Prisma `EntryKind`. */
function toPrismaKind(kind: "spend" | "adjustment"): EntryKind {
	return kind === "adjustment" ? EntryKind.ADJUSTMENT : EntryKind.SPEND;
}

/** Prisma `EntryKind` → wire `kind` ("spend"|"adjustment"). */
function toWireKind(kind: EntryKind): "spend" | "adjustment" {
	return kind === EntryKind.ADJUSTMENT ? "adjustment" : "spend";
}

/**
 * Budget procedures — scoped to the authenticated caller. The single
 * `Budget` row per user is keyed by userId, so a missing row means
 * "user hasn't onboarded yet".
 */
const budgetRouter = {
	get: protectedProcedure.query(async ({ ctx }) => {
		const row = await prisma.budget.findUnique({
			where: { userId: ctx.userId },
		});
		if (!row) return null;
		return {
			monthlyAmountCents: row.monthlyAmountCents,
			anchorDay: row.anchorDay,
			updatedAt: row.updatedAt,
		};
	}),

	set: protectedProcedure
		.input(
			z.object({
				monthlyAmountCents: z.number().int().nonnegative("BUDGET_NOT_POSITIVE"),
				anchorDay: z
					.number()
					.int()
					.min(1, "ANCHOR_OUT_OF_RANGE")
					.max(31, "ANCHOR_OUT_OF_RANGE"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const row = await prisma.budget.upsert({
				where: { userId: ctx.userId },
				create: {
					userId: ctx.userId,
					monthlyAmountCents: input.monthlyAmountCents,
					anchorDay: input.anchorDay,
				},
				update: {
					monthlyAmountCents: input.monthlyAmountCents,
					anchorDay: input.anchorDay,
				},
			});
			return {
				monthlyAmountCents: row.monthlyAmountCents,
				anchorDay: row.anchorDay,
				updatedAt: row.updatedAt,
			};
		}),
} satisfies TRPCRouterRecord;

/**
 * Expense procedures — scoped to the authenticated caller.
 *
 * The current cycle is a *local* notion (PRODUCT.md: the server never
 * computes "today"). So `listForCurrentCycle` takes the caller's local `now`
 * and reuses the pure domain `getCurrentCycle` to bound the query. The anchor
 * day comes from the user's budget; with no budget there is no cycle, so we
 * return an empty list.
 *
 * `update` edits the amount and note of an existing expense in place;
 * `createdAt` is never touched (no backdating), so an edited entry stays in
 * its original cycle. `delete` removes a single expense. Both are scoped to
 * the caller: the `where` filter pins both `id` and `userId`, so a request for
 * another user's row matches zero records (a no-op) rather than mutating it.
 */
const expenseRouter = {
	add: protectedProcedure
		.input(
			z
				.object({
					kind: z.enum(["spend", "adjustment"]).default("spend"),
					amountCents: z.number().int(),
					note: z.string().trim().max(280, "NOTE_TOO_LONG").optional(),
				})
				.superRefine((val, ctx) => {
					// A spend is money out: it must be strictly positive. An adjustment
					// carries a signed amount (top-up negative, set-aside positive) and
					// only has to be non-zero — a zero adjustment is meaningless.
					if (val.kind === "spend" && val.amountCents <= 0) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["amountCents"],
							message: "SPEND_NOT_POSITIVE",
						});
					}
					if (val.kind === "adjustment" && val.amountCents === 0) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["amountCents"],
							message: "ADJUSTMENT_ZERO",
						});
					}
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const row = await prisma.expense.create({
				data: {
					userId: ctx.userId,
					kind: toPrismaKind(input.kind),
					amountCents: input.amountCents,
					note: input.note && input.note.length > 0 ? input.note : null,
				},
			});
			return {
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			};
		}),

	listForCurrentCycle: protectedProcedure
		.input(z.object({ now: z.date() }))
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			const cycle = getCurrentCycle(input.now, budget.anchorDay);
			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: cycle.start, lt: cycle.end },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	// Entries spanning the most recent `count` cycles, for the cross-cycle
	// monthly-trend chart. Like `listForCurrentCycle`, the cycle span is a *local*
	// notion: it takes the caller's local `now` and the user's anchor day, reuses
	// the pure domain `getRecentCycles` to enumerate the window, then bounds one
	// `findMany` to `[oldest cycle start, current cycle end)`. The client bins the
	// rows back into cycles via `cycleTotals` (the server never computes "today").
	// No budget → no cycles → an empty list.
	listForCycles: protectedProcedure
		.input(
			z.object({ now: z.date(), count: z.number().int().min(1).default(6) }),
		)
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			// Newest → oldest. The span is the oldest cycle's start up to (but not
			// including) the current cycle's end — half-open, matching the cycles.
			const cycles = getRecentCycles(input.now, budget.anchorDay, input.count);
			const oldestStart = cycles[cycles.length - 1].start;
			const currentEnd = cycles[0].end;

			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: oldestStart, lt: currentEnd },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	// Raw entries for the streak engine's bounded lookback window, ending at the
	// caller's local `now`. The client bins these into local-midnight days and
	// computes the streaks (the server never computes "today"). The lower bound
	// is generous by a couple of days so a timezone offset between the server
	// `now` and the client's local day can't clip the window the client walks.
	listForStreak: protectedProcedure
		.input(z.object({ now: z.date() }))
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			const windowStart = new Date(
				input.now.getFullYear(),
				input.now.getMonth(),
				input.now.getDate() - (STREAK_WINDOW_DAYS + 2),
			);
			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: windowStart },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				// Signed: an adjustment's stored amount can be negative (a top-up), so
				// `update` accepts any non-zero integer. `kind` is immutable and so is
				// absent here — an entry never changes between spend and adjustment.
				amountCents: z
					.number()
					.int()
					.refine((n) => n !== 0, "AMOUNT_ZERO"),
				note: z.string().trim().max(280, "NOTE_TOO_LONG").optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Edit amount + note in place, scoped to the caller via `id` + `userId`
			// (another user's row matches nothing, so it's a no-op). `createdAt` is
			// deliberately absent from `data` — an edit never re-dates an entry.
			await prisma.expense.updateMany({
				where: { id: input.id, userId: ctx.userId },
				data: {
					amountCents: input.amountCents,
					note: input.note && input.note.length > 0 ? input.note : null,
				},
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Hard delete, scoped to the caller via `id` + `userId` (another
			// user's row matches nothing, so it's a no-op rather than an error).
			await prisma.expense.deleteMany({
				where: { id: input.id, userId: ctx.userId },
			});
		}),
} satisfies TRPCRouterRecord;

/**
 * Habit procedures — scoped to the authenticated caller.
 *
 * Wire contract for completion days:
 *   `HabitCompletion.day` is a `@db.Date` column; Prisma returns it as a
 *   UTC-midnight `Date`. We map it to an ISO calendar date string
 *   `"YYYY-MM-DD"` using UTC parts (toISOString().slice(0,10)) so the result
 *   is timezone-agnostic. Never apply local-parts `dayKey()` to a value from
 *   this column — in timezones west of UTC it would shift the day back by one.
 *
 *   The `use-habits` hook converts between this ISO wire format and the
 *   local-parts `dayKey` strings that the domain functions consume. Slices 4+
 *   do that conversion; in this slice completionDays flows through as-is.
 *
 * `list` takes no `now` input — it returns the full completion set so the
 * client can compute accurate streaks beyond any visible window, and because
 * "today" is a client concern (the server never computes it).
 */
const habitRouter = {
	/**
	 * Return all habits for the caller, ordered by createdAt ascending (stable
	 * creation order), each with its full completion day set as ISO strings.
	 *
	 * Completion days: `row.day.toISOString().slice(0, 10)` → `"YYYY-MM-DD"`.
	 * The client converts ISO → dayKey at the hook boundary (slice 4).
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await prisma.habit.findMany({
			where: { userId: ctx.userId },
			orderBy: { createdAt: "asc" },
			include: { completions: true },
		});
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			icon: row.icon,
			color: row.color,
			createdAt: row.createdAt,
			completionDays: row.completions.map((c) =>
				c.day.toISOString().slice(0, 10),
			),
		}));
	}),

	/**
	 * Create a new habit for the caller. Color is auto-assigned server-side via
	 * `pickHabitColor` over the caller's existing habit colors, so the client
	 * never needs to supply or know about colors.
	 *
	 * Returns the created habit in the same wire shape as a `list` row (with an
	 * empty `completionDays`).
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.trim()
					.min(1, "HABIT_NAME_REQUIRED")
					.max(60, "HABIT_NAME_TOO_LONG"),
				icon: z.enum(HABIT_ICON_NAMES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Fetch the caller's existing colors to pick a distinct one.
			const existing = await prisma.habit.findMany({
				where: { userId: ctx.userId },
				select: { color: true },
			});
			const usedColors = existing.map((h) => h.color);
			const color = pickHabitColor(HABIT_COLOR_PALETTE, usedColors);

			const row = await prisma.habit.create({
				data: {
					userId: ctx.userId,
					name: input.name,
					icon: input.icon,
					color,
				},
			});
			return {
				id: row.id,
				name: row.name,
				icon: row.icon,
				color: row.color,
				createdAt: row.createdAt,
				completionDays: [] as string[],
			};
		}),

	/**
	 * Rename / re-icon a caller-owned habit in place. Ownership is pinned in
	 * `where` (`id` + `userId`), so a request for another user's habit matches
	 * zero rows and is a no-op (no throw). `color` is deliberately absent from
	 * `data` — color is immutable post-create (mirrors the deliberate absence of
	 * `createdAt` in `expense.update`).
	 */
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z
					.string()
					.trim()
					.min(1, "HABIT_NAME_REQUIRED")
					.max(60, "HABIT_NAME_TOO_LONG"),
				icon: z.enum(HABIT_ICON_NAMES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Edit name + icon in place, scoped to the caller via `id` + `userId`
			// (another user's habit matches nothing, so it's a no-op). `color` is
			// deliberately absent — a habit's color is immutable post-create.
			await prisma.habit.updateMany({
				where: { id: input.id, userId: ctx.userId },
				data: { name: input.name, icon: input.icon },
			});
		}),

	/**
	 * Hard-delete a caller-owned habit. Ownership is pinned in `where` (`id` +
	 * `userId`), so a request for another user's habit is a no-op (no throw).
	 * `HabitCompletion` rows cascade-delete via the `onDelete: Cascade` FK, so
	 * no manual completion cleanup is needed.
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Hard delete, scoped to the caller via `id` + `userId` (another
			// user's habit matches nothing, so it's a no-op rather than an error).
			// Completion rows cascade-delete automatically via the FK constraint.
			await prisma.habit.deleteMany({
				where: { id: input.id, userId: ctx.userId },
			});
		}),

	/**
	 * Toggle a completion for a given habit + local calendar day.
	 *
	 * Ownership gate (security boundary): the caller must own the habit. Because
	 * `HabitCompletion` has no `userId` column of its own, ownership is verified
	 * by looking up the parent habit row. A request for another user's `habitId`
	 * resolves `owned = null` and returns early — no write happens. This mirrors
	 * the expense `updateMany`/`deleteMany` ownership pattern, adapted for the
	 * case where the owned-id lives on the parent model.
	 *
	 * Idempotency:
	 *   - `done: true`  → upsert on the `@@unique([habitId, day])` constraint;
	 *     `update: {}` means a second tap is a no-op, not an error.
	 *   - `done: false` → `deleteMany` so a missing row is a no-op (not an error).
	 *
	 * Day handling: `day` arrives as an ISO calendar date `"YYYY-MM-DD"` (the
	 * client's local day). We parse it as UTC midnight (`T00:00:00.000Z`) so the
	 * stored `@db.Date` value round-trips byte-for-byte with the UTC-parts
	 * mapping in `list` (`c.day.toISOString().slice(0, 10)`). No local timezone
	 * math is applied on the server — the day is an opaque label the client owns.
	 */
	toggleCompletion: protectedProcedure
		.input(
			z.object({
				habitId: z.string(),
				/** ISO calendar date "YYYY-MM-DD" — the client's local day. */
				day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				done: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Ownership gate: verify the habit belongs to the caller before writing.
			const owned = await prisma.habit.findFirst({
				where: { id: input.habitId, userId: ctx.userId },
				select: { id: true },
			});
			if (!owned) {
				// Another user's habit (or non-existent) — return without writing.
				return;
			}

			// Parse the ISO day string as a UTC-midnight Date. Storing at UTC midnight
			// ensures `toISOString().slice(0, 10)` in `list` round-trips to the same
			// "YYYY-MM-DD" string the client supplied.
			const day = new Date(`${input.day}T00:00:00.000Z`);

			if (input.done) {
				// Upsert: idempotent against the @@unique([habitId, day]) constraint.
				// `update: {}` means a second tap on an already-done day is a no-op.
				await prisma.habitCompletion.upsert({
					where: { habitId_day: { habitId: input.habitId, day } },
					create: { habitId: input.habitId, day },
					update: {},
				});
			} else {
				// Delete: deleteMany so a missing row is a no-op, not a throw.
				await prisma.habitCompletion.deleteMany({
					where: { habitId: input.habitId, day },
				});
			}
		}),
} satisfies TRPCRouterRecord;

/**
 * Exercise procedures — the workout tracker's exercise library.
 *
 * Two kinds of rows share the `exercise` table: built-ins (`userId = null`,
 * seeded from `prisma/seed.ts`, readable by everyone, writable by no one) and
 * the caller's custom exercises (`userId = ctx.userId`). `list` returns both;
 * `create` always writes a custom row pinned to the caller.
 *
 * Exercise names are NOT translated (PRD locked decision): they're data, not
 * UI chrome — the wire `name` is rendered verbatim.
 */
const exerciseRouter = {
	/**
	 * All exercises visible to the caller: built-ins + own customs, ordered by
	 * muscle group (enum declaration order: CHEST → BACK → LEGS → SHOULDERS →
	 * ARMS → CORE, Postgres orders enums by declaration), then name.
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await prisma.exercise.findMany({
			where: { OR: [{ userId: null }, { userId: ctx.userId }] },
			orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
		});
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			muscleGroup: row.muscleGroup,
			equipment: row.equipment,
			/** True for the caller's own custom exercises, false for built-ins. */
			isCustom: row.userId !== null,
		}));
	}),

	/**
	 * Create a custom exercise for the caller. The name must be unique across
	 * everything the caller can see (built-ins + own customs, case-insensitive)
	 * so the library never shows two entries with the same name; a clash throws
	 * CONFLICT with the typed `EXERCISE_NAME_TAKEN` code.
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z
					.string()
					.trim()
					.min(1, "EXERCISE_NAME_REQUIRED")
					.max(80, "EXERCISE_NAME_TOO_LONG"),
				muscleGroup: z.enum(MuscleGroup),
				equipment: z.enum(Equipment),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Uniqueness gate across the caller's visible library. The DB's
			// @@unique([userId, name]) only covers exact-case dupes within one
			// userId (and not built-ins, since NULLs are distinct in Postgres
			// unique indexes), so the user-facing rule lives here.
			const clash = await prisma.exercise.findFirst({
				where: {
					OR: [{ userId: null }, { userId: ctx.userId }],
					name: { equals: input.name, mode: "insensitive" },
				},
				select: { id: true },
			});
			if (clash) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "EXERCISE_NAME_TAKEN",
				});
			}

			const row = await prisma.exercise.create({
				data: {
					userId: ctx.userId,
					name: input.name,
					muscleGroup: input.muscleGroup,
					equipment: input.equipment,
				},
			});
			return {
				id: row.id,
				name: row.name,
				muscleGroup: row.muscleGroup,
				equipment: row.equipment,
				isCustom: true,
			};
		}),
} satisfies TRPCRouterRecord;

/**
 * Shared shape of one routine-exercise entry as the client sends it.
 * The array index is the position — the server writes `position: index`,
 * so the wire carries no explicit position field.
 */
const routineExerciseInput = z.object({
	exerciseId: z.string(),
	targetSets: z.number().int().min(1).max(12),
	/** Free-text rep target, e.g. "8-12" or "5". */
	targetReps: z.string().trim().min(1).max(20),
	restSeconds: z.number().int().min(0).max(600),
});

/** Shared create/update payload fields for a routine. */
const routineFields = {
	name: z
		.string()
		.trim()
		.min(1, "ROUTINE_NAME_REQUIRED")
		.max(80, "ROUTINE_NAME_TOO_LONG"),
	description: z.string().trim().max(280, "NOTE_TOO_LONG").optional(),
	exercises: z
		.array(routineExerciseInput)
		.min(1, "ROUTINE_NO_EXERCISES")
		.max(20),
};

/**
 * Ownership/visibility gate for routine writes: every referenced exercise must
 * be visible to the caller (built-in `userId = null` or the caller's own
 * custom). Without this, a caller could attach another user's custom exercise
 * to their routine by guessing its id.
 */
async function assertExercisesVisible(
	userId: string,
	exerciseIds: string[],
): Promise<void> {
	const unique = [...new Set(exerciseIds)];
	const visible = await prisma.exercise.count({
		where: {
			id: { in: unique },
			OR: [{ userId: null }, { userId }],
		},
	});
	if (visible !== unique.length) {
		throw new TRPCError({ code: "NOT_FOUND", message: "EXERCISE_NOT_FOUND" });
	}
}

/**
 * Routine procedures — reusable workout plans, scoped to the caller.
 *
 * `create`/`update` take the full ordered exercise array; the array index
 * becomes `RoutineExercise.position`. `update` replaces the exercise rows
 * wholesale (nested `deleteMany` + `create` inside one `update` call, which
 * Prisma runs in a single transaction) — safe because nothing references
 * `RoutineExercise` rows: workouts copy values at start time and
 * `Workout.routineId` is `SetNull` on routine delete.
 */
const routineRouter = {
	/**
	 * The caller's routines, newest first, each with a display summary:
	 * exercise names in position order, exercise count, and the total number
	 * of target sets across all exercises.
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await prisma.routine.findMany({
			where: { userId: ctx.userId },
			orderBy: { createdAt: "desc" },
			include: {
				exercises: {
					orderBy: { position: "asc" },
					include: { exercise: { select: { name: true } } },
				},
			},
		});
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			/** Exercise names in position order — for the card preview line. */
			exerciseNames: row.exercises.map((e) => e.exercise.name),
			exerciseCount: row.exercises.length,
			totalTargetSets: row.exercises.reduce((sum, e) => sum + e.targetSets, 0),
		}));
	}),

	/**
	 * Full routine detail for the edit screen: ordered exercises with the
	 * library data (name/muscleGroup/equipment) joined in. NOT_FOUND with the
	 * typed `ROUTINE_NOT_FOUND` code when the routine isn't the caller's.
	 */
	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const row = await prisma.routine.findFirst({
				where: { id: input.id, userId: ctx.userId },
				include: {
					exercises: {
						orderBy: { position: "asc" },
						include: { exercise: true },
					},
				},
			});
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "ROUTINE_NOT_FOUND",
				});
			}
			return {
				id: row.id,
				name: row.name,
				description: row.description,
				exercises: row.exercises.map((e) => ({
					exerciseId: e.exerciseId,
					name: e.exercise.name,
					muscleGroup: e.exercise.muscleGroup,
					equipment: e.exercise.equipment,
					targetSets: e.targetSets,
					targetReps: e.targetReps,
					restSeconds: e.restSeconds,
				})),
			};
		}),

	/**
	 * Create a routine with its ordered exercises in one atomic nested write.
	 * Returns the new routine's id so the client can navigate or invalidate.
	 */
	create: protectedProcedure
		.input(z.object(routineFields))
		.mutation(async ({ ctx, input }) => {
			await assertExercisesVisible(
				ctx.userId,
				input.exercises.map((e) => e.exerciseId),
			);
			const row = await prisma.routine.create({
				data: {
					userId: ctx.userId,
					name: input.name,
					description:
						input.description && input.description.length > 0
							? input.description
							: null,
					exercises: {
						create: input.exercises.map((e, index) => ({
							exerciseId: e.exerciseId,
							position: index,
							targetSets: e.targetSets,
							targetReps: e.targetReps,
							restSeconds: e.restSeconds,
						})),
					},
				},
			});
			return { id: row.id };
		}),

	/**
	 * Replace a routine's fields and its full exercise list. Ownership is
	 * checked up front (NOT_FOUND for another user's routine); the nested
	 * `deleteMany` + `create` runs inside the single `update` statement, so the
	 * replacement is transactional.
	 */
	update: protectedProcedure
		.input(z.object({ id: z.string(), ...routineFields }))
		.mutation(async ({ ctx, input }) => {
			const owned = await prisma.routine.findFirst({
				where: { id: input.id, userId: ctx.userId },
				select: { id: true },
			});
			if (!owned) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "ROUTINE_NOT_FOUND",
				});
			}
			await assertExercisesVisible(
				ctx.userId,
				input.exercises.map((e) => e.exerciseId),
			);
			await prisma.routine.update({
				where: { id: input.id },
				data: {
					name: input.name,
					description:
						input.description && input.description.length > 0
							? input.description
							: null,
					exercises: {
						deleteMany: {},
						create: input.exercises.map((e, index) => ({
							exerciseId: e.exerciseId,
							position: index,
							targetSets: e.targetSets,
							targetReps: e.targetReps,
							restSeconds: e.restSeconds,
						})),
					},
				},
			});
		}),

	/**
	 * Hard-delete a caller-owned routine. `RoutineExercise` rows cascade;
	 * `Workout.routineId` is `SetNull`, so past workouts survive. Pinned to
	 * `id` + `userId` so another user's routine is a no-op, not an error.
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await prisma.routine.deleteMany({
				where: { id: input.id, userId: ctx.userId },
			});
		}),
} satisfies TRPCRouterRecord;

/**
 * Per-set values from the most recent finished workout, keyed by
 * exerciseId → setNumber. Drives the "last time: 80 kg × 8" hints and the
 * prefill on `start`/`addExercise` (PRD locked decision 9).
 */
type PreviousSetMap = Map<
	string,
	Map<number, { weightGrams: number | null; reps: number | null }>
>;

/**
 * For each exercise id, load the sets of the caller's most recent *finished*
 * workout containing that exercise. Only completed sets count (finish deletes
 * incomplete ones anyway; the filter guards legacy/edge rows). One small query
 * per exercise — a workout holds at most ~20, so no N+1 concern at this scale.
 */
async function previousSetsByExercise(
	userId: string,
	exerciseIds: string[],
): Promise<PreviousSetMap> {
	const unique = [...new Set(exerciseIds)];
	const entries = await Promise.all(
		unique.map(async (exerciseId) => {
			const last = await prisma.workoutExercise.findFirst({
				where: { exerciseId, workout: { userId, finishedAt: { not: null } } },
				orderBy: { workout: { finishedAt: "desc" } },
				include: {
					sets: { where: { completed: true }, orderBy: { setNumber: "asc" } },
				},
			});
			if (!last) return null;
			const bySetNumber = new Map(
				last.sets.map((s) => [
					s.setNumber,
					{ weightGrams: s.weightGrams, reps: s.reps },
				]),
			);
			return [exerciseId, bySetNumber] as const;
		}),
	);
	return new Map(entries.filter((e) => e !== null));
}

/** How many sets a freshly added (non-routine) exercise starts with. */
const DEFAULT_SET_COUNT = 3;
/** Page size of `workout.history` (cursor pagination). */
const HISTORY_PAGE_SIZE = 20;
/** Rest seconds for an exercise added mid-workout (matches the schema default). */
const DEFAULT_REST_SECONDS = 120;

/**
 * Workout procedures — live workout logging, scoped to the caller.
 *
 * Invariants:
 * - At most one *active* workout (`finishedAt = null`) per user, enforced in
 *   `start` (application-level; no DB constraint).
 * - Every mutation is pinned to `ctx.userId` via relation joins; rows that
 *   aren't the caller's match nothing and the call is a no-op (the
 *   `updateMany`/`deleteMany` convention) or a typed NOT_FOUND where the UI
 *   needs to react.
 * - Set/exercise mutations only touch the *active* workout (`finishedAt:
 *   null` in the join) — finished workouts are immutable history.
 * - Finish semantics (PRD locked decision 8): only completed sets are saved.
 *   `finish` deletes incomplete sets, drops exercises left with no sets, and
 *   renumbers the surviving sets 1..n so history (and future previous-set
 *   matching) sees a dense set list.
 */
const workoutRouter = {
	/**
	 * The caller's active workout in full detail, or null. Exercises come in
	 * position order, sets in setNumber order; each set carries `previous` —
	 * the matching-setNumber set from the most recent finished workout
	 * containing that exercise (or null).
	 */
	active: protectedProcedure.query(async ({ ctx }) => {
		const row = await prisma.workout.findFirst({
			where: { userId: ctx.userId, finishedAt: null },
			include: {
				exercises: {
					orderBy: { position: "asc" },
					include: {
						exercise: { select: { name: true, muscleGroup: true } },
						sets: { orderBy: { setNumber: "asc" } },
					},
				},
			},
		});
		if (!row) return null;

		const previous = await previousSetsByExercise(
			ctx.userId,
			row.exercises.map((e) => e.exerciseId),
		);
		return {
			id: row.id,
			name: row.name,
			startedAt: row.startedAt,
			exercises: row.exercises.map((e) => ({
				id: e.id,
				exerciseId: e.exerciseId,
				name: e.exercise.name,
				muscleGroup: e.exercise.muscleGroup,
				position: e.position,
				restSeconds: e.restSeconds,
				sets: e.sets.map((s) => ({
					id: s.id,
					setNumber: s.setNumber,
					weightGrams: s.weightGrams,
					reps: s.reps,
					completed: s.completed,
					/** Last finished session's matching set — null if none. */
					previous: previous.get(e.exerciseId)?.get(s.setNumber) ?? null,
				})),
			})),
		};
	}),

	/**
	 * Start a workout. CONFLICT (`WORKOUT_ALREADY_ACTIVE`) if one is active.
	 *
	 * With `routineId`: copies the routine's exercises (position, restSeconds)
	 * into WorkoutExercise rows and creates `targetSets` WorkoutSet rows each,
	 * prefilled from the previous finished performance (matching setNumber).
	 * The workout takes the routine's name. The nested create is one atomic
	 * statement.
	 *
	 * Without: an empty workout named by the client (translated default) or
	 * "Workout". Returns `{ id }` — the client invalidates `workout.active`
	 * and navigates; the /workouts/active loader fetches the full shape.
	 */
	start: protectedProcedure
		.input(
			z.object({
				routineId: z.string().optional(),
				/** Display name for an empty workout; ignored when routineId is set. */
				name: z.string().trim().min(1).max(80).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await prisma.workout.findFirst({
				where: { userId: ctx.userId, finishedAt: null },
				select: { id: true },
			});
			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "WORKOUT_ALREADY_ACTIVE",
				});
			}

			if (!input.routineId) {
				const row = await prisma.workout.create({
					data: { userId: ctx.userId, name: input.name ?? "Workout" },
				});
				return { id: row.id };
			}

			const routine = await prisma.routine.findFirst({
				where: { id: input.routineId, userId: ctx.userId },
				include: { exercises: { orderBy: { position: "asc" } } },
			});
			if (!routine) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "ROUTINE_NOT_FOUND",
				});
			}

			const previous = await previousSetsByExercise(
				ctx.userId,
				routine.exercises.map((e) => e.exerciseId),
			);
			const row = await prisma.workout.create({
				data: {
					userId: ctx.userId,
					routineId: routine.id,
					name: routine.name,
					exercises: {
						create: routine.exercises.map((e, index) => ({
							exerciseId: e.exerciseId,
							position: index,
							restSeconds: e.restSeconds,
							sets: {
								create: Array.from({ length: e.targetSets }, (_, i) => {
									const prev = previous.get(e.exerciseId)?.get(i + 1);
									return {
										setNumber: i + 1,
										weightGrams: prev?.weightGrams ?? null,
										reps: prev?.reps ?? null,
									};
								}),
							},
						})),
					},
				},
			});
			return { id: row.id };
		}),

	/**
	 * Finish the active workout: requires ≥1 completed set (BAD_REQUEST
	 * `WORKOUT_NO_COMPLETED_SETS` otherwise), stamps `finishedAt`, deletes
	 * incomplete sets, drops exercises left empty, and renumbers surviving
	 * sets densely — all in one transaction.
	 */
	finish: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const workout = await prisma.workout.findFirst({
				where: { id: input.id, userId: ctx.userId, finishedAt: null },
				include: { exercises: { include: { sets: true } } },
			});
			if (!workout) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "WORKOUT_NOT_FOUND",
				});
			}

			const hasCompleted = workout.exercises.some((e) =>
				e.sets.some((s) => s.completed),
			);
			if (!hasCompleted) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "WORKOUT_NO_COMPLETED_SETS",
				});
			}

			await prisma.$transaction(async (tx) => {
				// Only completed sets are saved (PRD locked decision 8).
				await tx.workoutSet.deleteMany({
					where: {
						workoutExercise: { workoutId: workout.id },
						completed: false,
					},
				});
				// Exercises whose every set was incomplete are now empty — drop them
				// so history never shows a zero-set exercise.
				await tx.workoutExercise.deleteMany({
					where: { workoutId: workout.id, sets: { none: {} } },
				});
				// Renumber the survivors 1..n so previous-set matching and the
				// history display see a dense list.
				for (const exercise of workout.exercises) {
					const kept = exercise.sets
						.filter((s) => s.completed)
						.sort((a, b) => a.setNumber - b.setNumber);
					await Promise.all(
						kept.flatMap((s, i) =>
							s.setNumber === i + 1
								? []
								: [
										tx.workoutSet.update({
											where: { id: s.id },
											data: { setNumber: i + 1 },
										}),
									],
						),
					);
				}
				await tx.workout.update({
					where: { id: workout.id },
					data: { finishedAt: new Date() },
				});
			});
		}),

	/**
	 * Discard the active workout entirely — the workout row plus its exercises
	 * and sets (cascade). Pinned to `id` + `userId` + active, so anything else
	 * is a no-op. Finished workouts can't be discarded (history is immutable).
	 */
	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await prisma.workout.deleteMany({
				where: { id: input.id, userId: ctx.userId, finishedAt: null },
			});
		}),

	/**
	 * Append an exercise to the active workout at the next position with
	 * DEFAULT_SET_COUNT sets, prefilled from the previous finished performance.
	 */
	addExercise: protectedProcedure
		.input(z.object({ workoutId: z.string(), exerciseId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const workout = await prisma.workout.findFirst({
				where: { id: input.workoutId, userId: ctx.userId, finishedAt: null },
				include: { exercises: { select: { position: true } } },
			});
			if (!workout) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "WORKOUT_NOT_FOUND",
				});
			}
			await assertExercisesVisible(ctx.userId, [input.exerciseId]);

			const previous = await previousSetsByExercise(ctx.userId, [
				input.exerciseId,
			]);
			const position =
				workout.exercises.reduce((max, e) => Math.max(max, e.position), -1) + 1;
			await prisma.workoutExercise.create({
				data: {
					workoutId: workout.id,
					exerciseId: input.exerciseId,
					position,
					restSeconds: DEFAULT_REST_SECONDS,
					sets: {
						create: Array.from({ length: DEFAULT_SET_COUNT }, (_, i) => {
							const prev = previous.get(input.exerciseId)?.get(i + 1);
							return {
								setNumber: i + 1,
								weightGrams: prev?.weightGrams ?? null,
								reps: prev?.reps ?? null,
							};
						}),
					},
				},
			});
		}),

	/**
	 * Remove an exercise (and its sets, cascade) from the active workout.
	 * Ownership pinned via the relation join — another user's row (or a
	 * finished workout's) matches nothing and the call is a no-op.
	 */
	removeExercise: protectedProcedure
		.input(z.object({ workoutExerciseId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await prisma.workoutExercise.deleteMany({
				where: {
					id: input.workoutExerciseId,
					workout: { userId: ctx.userId, finishedAt: null },
				},
			});
		}),

	/**
	 * Append a set to an exercise of the active workout, copying the current
	 * last set's weight/reps (the usual next-set starting point). No-op when
	 * the exercise isn't the caller's active workout's.
	 */
	addSet: protectedProcedure
		.input(z.object({ workoutExerciseId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const owner = await prisma.workoutExercise.findFirst({
				where: {
					id: input.workoutExerciseId,
					workout: { userId: ctx.userId, finishedAt: null },
				},
				include: { sets: { orderBy: { setNumber: "desc" }, take: 1 } },
			});
			if (!owner) return;
			const last = owner.sets[0];
			await prisma.workoutSet.create({
				data: {
					workoutExerciseId: owner.id,
					setNumber: (last?.setNumber ?? 0) + 1,
					weightGrams: last?.weightGrams ?? null,
					reps: last?.reps ?? null,
				},
			});
		}),

	/**
	 * Delete a set from the active workout and renumber the exercise's
	 * remaining sets 1..n transactionally. No-op for rows that aren't the
	 * caller's active workout's.
	 */
	deleteSet: protectedProcedure
		.input(z.object({ setId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const set = await prisma.workoutSet.findFirst({
				where: {
					id: input.setId,
					workoutExercise: {
						workout: { userId: ctx.userId, finishedAt: null },
					},
				},
				select: { id: true, workoutExerciseId: true },
			});
			if (!set) return;

			await prisma.$transaction(async (tx) => {
				await tx.workoutSet.delete({ where: { id: set.id } });
				const remaining = await tx.workoutSet.findMany({
					where: { workoutExerciseId: set.workoutExerciseId },
					orderBy: { setNumber: "asc" },
					select: { id: true, setNumber: true },
				});
				await Promise.all(
					remaining.flatMap((s, i) =>
						s.setNumber === i + 1
							? []
							: [
									tx.workoutSet.update({
										where: { id: s.id },
										data: { setNumber: i + 1 },
									}),
								],
					),
				);
			});
		}),

	/**
	 * Finished workouts, newest first, cursor-paginated (the workout id is the
	 * cursor; `finishedAt desc, id desc` keeps the order stable across equal
	 * timestamps). Each row carries the history-card summary: exercise names in
	 * position order, total set count, and total volume. Finished workouts only
	 * contain completed sets (finish deletes the rest), so the counts are the
	 * saved sets.
	 */
	history: protectedProcedure
		.input(z.object({ cursor: z.string().nullish() }))
		.query(async ({ ctx, input }) => {
			const rows = await prisma.workout.findMany({
				where: { userId: ctx.userId, finishedAt: { not: null } },
				orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
				take: HISTORY_PAGE_SIZE + 1,
				...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
				include: {
					exercises: {
						orderBy: { position: "asc" },
						include: {
							exercise: { select: { name: true } },
							sets: {
								select: { weightGrams: true, reps: true, completed: true },
							},
						},
					},
				},
			});

			const hasMore = rows.length > HISTORY_PAGE_SIZE;
			const page = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
			return {
				items: page.map((row) => {
					const sets = row.exercises.flatMap((e) => e.sets);
					return {
						id: row.id,
						name: row.name,
						startedAt: row.startedAt,
						// Non-null by the where filter; coalesce keeps the type honest.
						finishedAt: row.finishedAt ?? row.startedAt,
						/** Exercise names in position order — for the card preview line. */
						exerciseNames: row.exercises.map((e) => e.exercise.name),
						totalSets: sets.length,
						volumeGrams: workoutVolumeGrams(sets),
					};
				}),
				nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
			};
		}),

	/**
	 * Full detail of one *finished* workout for the read-only history screen.
	 * Typed NOT_FOUND for anything else — another user's workout, a non-existent
	 * id, or a still-active workout (which lives on /workouts/active instead).
	 */
	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const row = await prisma.workout.findFirst({
				where: { id: input.id, userId: ctx.userId, finishedAt: { not: null } },
				include: {
					exercises: {
						orderBy: { position: "asc" },
						include: {
							exercise: { select: { name: true, muscleGroup: true } },
							sets: { orderBy: { setNumber: "asc" } },
						},
					},
				},
			});
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "WORKOUT_NOT_FOUND",
				});
			}
			return {
				id: row.id,
				name: row.name,
				startedAt: row.startedAt,
				finishedAt: row.finishedAt ?? row.startedAt,
				exercises: row.exercises.map((e) => ({
					id: e.id,
					exerciseId: e.exerciseId,
					name: e.exercise.name,
					muscleGroup: e.exercise.muscleGroup,
					sets: e.sets.map((s) => ({
						id: s.id,
						setNumber: s.setNumber,
						weightGrams: s.weightGrams,
						reps: s.reps,
					})),
				})),
			};
		}),

	/**
	 * Per-exercise progress over the caller's finished workouts containing the
	 * exercise, chronological (oldest → newest, chart-ready). One point per
	 * finished workout: the best set (heaviest weight, ties by reps — see
	 * `bestSet`) and the exercise's own volume in that session. Headline stats:
	 * `prWeightGrams` (heaviest set ever) and `bestEst1RmGrams` (max Epley over
	 * all sets) — both null when there are no sessions yet.
	 *
	 * NOT_FOUND when the exercise isn't visible to the caller (not a built-in
	 * and not their own custom).
	 */
	exerciseProgress: protectedProcedure
		.input(z.object({ exerciseId: z.string() }))
		.query(async ({ ctx, input }) => {
			const exercise = await prisma.exercise.findFirst({
				where: {
					id: input.exerciseId,
					OR: [{ userId: null }, { userId: ctx.userId }],
				},
				select: { id: true, name: true, muscleGroup: true, equipment: true },
			});
			if (!exercise) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "EXERCISE_NOT_FOUND",
				});
			}

			const rows = await prisma.workoutExercise.findMany({
				where: {
					exerciseId: exercise.id,
					workout: { userId: ctx.userId, finishedAt: { not: null } },
				},
				orderBy: [{ workout: { finishedAt: "asc" } }, { workoutId: "asc" }],
				include: {
					workout: { select: { id: true, finishedAt: true } },
					sets: { select: { weightGrams: true, reps: true, completed: true } },
				},
			});

			// One point per workout. A workout normally holds an exercise once, but
			// the schema doesn't forbid duplicates — merge their sets defensively.
			const byWorkout = new Map<
				string,
				{
					finishedAt: Date;
					sets: {
						weightGrams: number | null;
						reps: number | null;
						completed: boolean;
					}[];
				}
			>();
			for (const row of rows) {
				const existing = byWorkout.get(row.workout.id);
				if (existing) {
					existing.sets.push(...row.sets);
				} else {
					byWorkout.set(row.workout.id, {
						finishedAt: row.workout.finishedAt ?? new Date(0),
						sets: [...row.sets],
					});
				}
			}

			const allSets = rows.flatMap((row) => row.sets);
			const points = [...byWorkout.entries()].map(([workoutId, session]) => {
				const best = bestSet(session.sets);
				return {
					workoutId,
					finishedAt: session.finishedAt,
					bestSetWeightGrams: best?.weightGrams ?? 0,
					/** Reps of that best (heaviest) set. */
					bestSetReps: best?.reps ?? 0,
					/** This exercise's volume in that session only. */
					volumeGrams: workoutVolumeGrams(session.sets),
				};
			});

			const pr = bestSet(allSets);
			const est1Rm = bestEpley1RmGrams(allSets);
			return {
				exercise,
				points,
				/** Heaviest set ever (grams) — null when no sessions yet. */
				prWeightGrams: pr ? pr.weightGrams : null,
				/** Max Epley estimate over all sets — null when no sessions yet. */
				bestEst1RmGrams: points.length > 0 ? est1Rm : null,
			};
		}),

	/**
	 * Partial update of one set of the active workout. `weightGrams`/`reps`
	 * accept null to clear a field; `completed: true` stamps `completedAt`,
	 * false clears it. No-op for rows that aren't the caller's active
	 * workout's (the updateMany convention, adapted because the owned id
	 * lives two joins up).
	 */
	updateSet: protectedProcedure
		.input(
			z.object({
				setId: z.string(),
				weightGrams: z
					.number()
					.int()
					.min(0)
					.max(MAX_WEIGHT_GRAMS)
					.nullable()
					.optional(),
				reps: z.number().int().min(0).max(MAX_REPS).nullable().optional(),
				completed: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const set = await prisma.workoutSet.findFirst({
				where: {
					id: input.setId,
					workoutExercise: {
						workout: { userId: ctx.userId, finishedAt: null },
					},
				},
				select: { id: true },
			});
			if (!set) return;

			const data: {
				weightGrams?: number | null;
				reps?: number | null;
				completed?: boolean;
				completedAt?: Date | null;
			} = {};
			if (input.weightGrams !== undefined) data.weightGrams = input.weightGrams;
			if (input.reps !== undefined) data.reps = input.reps;
			if (input.completed !== undefined) {
				data.completed = input.completed;
				data.completedAt = input.completed ? new Date() : null;
			}
			if (Object.keys(data).length === 0) return;

			await prisma.workoutSet.update({ where: { id: set.id }, data });
		}),
} satisfies TRPCRouterRecord;

/**
 * User preference procedures — language + currency persistence (Module G).
 *
 * `setPreferences` writes the user's language and currency to the DB and also
 * sets the SSR fast-path cookies so the next hard navigation picks them up
 * without needing to hit the DB. The cookies are set via the TanStack Start
 * server helper which is available because tRPC procedures run inside the
 * request's AsyncLocalStorage scope.
 *
 * No cookie-cache is configured on the Better Auth session, so the DB write is
 * immediately reflected in the next `getSession` call — no stale-cache risk.
 */
const userRouter = {
	setPreferences: protectedProcedure
		.input(
			z.object({
				language: z.enum(SUPPORTED_LOCALES).optional(),
				currency: z.enum(SUPPORTED_CURRENCIES).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { language, currency } = input;

			// Only update whichever fields were supplied.
			const data: { language?: string; currency?: string } = {};
			if (language !== undefined) data.language = language;
			if (currency !== undefined) data.currency = currency;

			if (Object.keys(data).length === 0) return;

			// (a) Write the DB columns — immediately visible on the next getSession
			//     call because there is no Better Auth cookie-cache.
			await prisma.user.update({
				where: { id: ctx.userId },
				data,
			});

			// (b) Set the SSR fast-path cookies so the next server-rendered page
			//     uses the new values without a DB read (cookie is read in
			//     getResolvedPrefs as the second-precedence source after userPref).
			const cookieOptions = {
				path: "/",
				sameSite: "lax" as const,
				maxAge: 60 * 60 * 24 * 365, // 1 year
			};
			if (language !== undefined) {
				setCookie(LOCALE_COOKIE, language, cookieOptions);
			}
			if (currency !== undefined) {
				setCookie(CURRENCY_COOKIE, currency, cookieOptions);
			}
		}),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
	user: userRouter,
	budget: budgetRouter,
	expense: expenseRouter,
	habit: habitRouter,
	exercise: exerciseRouter,
	routine: routineRouter,
	workout: workoutRouter,
});
export type TRPCRouter = typeof trpcRouter;
