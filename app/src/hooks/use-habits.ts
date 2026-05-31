/**
 * React hooks for habits.
 *
 * Reads go through `useTRPC()` + `useSuspenseQuery` so the SSR-prefetched cache
 * entry is hit and the component rehydrates without a loading flash.
 *
 * Day-format contract:
 *   The server returns `completionDays` as ISO calendar date strings
 *   `"YYYY-MM-DD"` (derived from `@db.Date` UTC parts). The domain functions
 *   (`currentStreak`, `buildHeatmap`) consume `dayKey` strings — a local-parts
 *   format: `"<year>-<month0>-<date>"` with 0-indexed month.
 *
 *   Helpers:
 *   - `isoDayToDayKey(iso)` — converts `"YYYY-MM-DD"` → dayKey string by
 *     parsing the ISO parts as local (the client owns the day boundary, so
 *     local parts are correct here). Example: "2025-03-20" → "2025-2-20".
 *   - `localDateToIsoDay(d)` — converts a local `Date` to `"YYYY-MM-DD"` for
 *     the `toggleCompletion` wire (slice 5). Zero-pads month + day.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { HabitIconName } from "#/components/habits/habit-icons";
import { buildHeatmap, currentStreak, type HeatmapCell } from "#/domain";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

/**
 * Number of week columns to show in the heatmap (~4 months, fits phone width).
 * Exported so tests can reference it without hardcoding the same magic number.
 */
export const HEATMAP_WEEK_COUNT = 18;

/** Client-side habit shape (wire createdAt deserialized to Date by superjson). */
export interface Habit {
	id: string;
	name: string;
	icon: string;
	color: string;
	createdAt: Date;
	/**
	 * Completion days as ISO `"YYYY-MM-DD"` strings (wire format from `list`).
	 */
	completionDays: string[];
}

/** Habit augmented with server-derived streak and heatmap grid. */
export interface HabitWithStats extends Habit {
	/** Current consecutive-done streak ending today (provisional today). */
	streak: number;
	/** Pre-built heatmap grid for rendering — week columns, Sunday index 0. */
	heatmap: { weeks: HeatmapCell[][] };
	/** Whether today has been completed. Derived from completionDays at load time. */
	todayDone: boolean;
}

// ---------------------------------------------------------------------------
// Day-format helpers — convert between wire ISO strings and domain dayKey.
// ---------------------------------------------------------------------------

/**
 * Convert an ISO calendar date string `"YYYY-MM-DD"` to a local-parts `dayKey`
 * string `"<year>-<month0>-<date>"`.
 *
 * The ISO parts are treated as local (the client owns the day boundary), so
 * `"2025-03-20"` → `"2025-2-20"` (0-indexed month, no zero-padding on day).
 */
export function isoDayToDayKey(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	// m is 1-indexed from ISO; dayKey uses 0-indexed month.
	return `${y}-${m - 1}-${d}`;
}

/**
 * Convert a local `Date` to an ISO calendar date string `"YYYY-MM-DD"`.
 * Used when supplying `day` to `toggleCompletion` (slice 5).
 */
export function localDateToIsoDay(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * All habits for the authenticated user, ordered oldest-first.
 * Accepts a loader-provided `now` (startOfDay) so SSR and client hydration
 * agree on "today" for streak + heatmap derivation. Pass the value returned by
 * `Route.useLoaderData()` directly — do NOT derive a fresh `new Date()` here.
 */
export function useHabits(now: Date): HabitWithStats[] {
	const trpc = useTRPC();
	const { data: rows } = useSuspenseQuery(trpc.habit.list.queryOptions());

	// Derive streak + heatmap for each habit. `now` is loader-stable so SSR and
	// client produce the same grid and streak on first hydration. Memoised over
	// (rows, now) so it only reruns when the query data or `now` changes.
	return useMemo(() => {
		const todayIso = localDateToIsoDay(now);
		return rows.map((row) => {
			const dayKeys = row.completionDays.map(isoDayToDayKey);
			const streak = currentStreak(dayKeys, now);
			const heatmap = buildHeatmap(dayKeys, now, HEATMAP_WEEK_COUNT);
			const todayDone = row.completionDays.includes(todayIso);
			return {
				id: row.id,
				name: row.name,
				icon: row.icon,
				color: row.color,
				createdAt: row.createdAt,
				completionDays: row.completionDays,
				streak,
				heatmap,
				todayDone,
			};
		});
	}, [rows, now]);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mutation: create a new habit, then refresh the list. */
export function useCreateHabit() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.habit.create.mutationKey(),
		mutationFn: (input: { name: string; icon: HabitIconName }) =>
			trpcClient.habit.create.mutate(input),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.habit.list.queryFilter()),
	});
}

/** Mutation: update a habit's name + icon, then refresh the list. */
export function useUpdateHabit() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.habit.update.mutationKey(),
		mutationFn: (input: { id: string; name: string; icon: HabitIconName }) =>
			trpcClient.habit.update.mutate(input),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.habit.list.queryFilter()),
	});
}

/** Mutation: hard-delete a habit and cascade its completions, then refresh the list. */
export function useDeleteHabit() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.habit.delete.mutationKey(),
		mutationFn: (input: { id: string }) =>
			trpcClient.habit.delete.mutate(input),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.habit.list.queryFilter()),
	});
}

/**
 * Mutation: toggle a completion for a given habit + local calendar day.
 *
 * This is the codebase's FIRST optimistic mutation. Pattern:
 *   1. `onMutate` — cancel in-flight refetches, snapshot the current cache,
 *      then write the optimistic update immediately so the UI flips on tap.
 *   2. `onError`  — restore the snapshot so the UI reverts on a network error.
 *   3. `onSettled`— invalidate to reconcile with server truth regardless of
 *      success or failure (covers race-condition double-taps too).
 *
 * Cache shape mutated: `habit.list` returns `{ completionDays: string[] }[]`
 * (ISO "YYYY-MM-DD" strings). We add/remove the `day` string in place, which
 * causes `useHabits`'s `useMemo([rows, now])` to recompute — the `data`
 * reference changes after `setQueryData`, so the memo re-runs and both the
 * cell state (done/missed) and the 🔥 streak flip instantly.
 */
export function useToggleCompletion() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: trpc.habit.toggleCompletion.mutationKey(),
		mutationFn: (input: { habitId: string; day: string; done: boolean }) =>
			trpcClient.habit.toggleCompletion.mutate(input),

		/**
		 * Optimistic update: flip the completion set immediately before the server
		 * responds. Returns the previous cache snapshot as context so `onError` can
		 * roll back.
		 */
		onMutate: async (variables) => {
			// Cancel any outgoing refetches so they don't overwrite the optimistic update.
			await queryClient.cancelQueries(trpc.habit.list.queryFilter());

			// Snapshot the current cache value for rollback on error.
			const prev = queryClient.getQueryData(trpc.habit.list.queryKey());

			// Optimistically update the cache: add or remove the day from the
			// matching habit's completionDays array.
			queryClient.setQueryData(
				trpc.habit.list.queryKey(),
				(old: Habit[] | undefined) => {
					if (!old) return old;
					return old.map((habit) => {
						if (habit.id !== variables.habitId) return habit;
						const days = habit.completionDays;
						const updated = variables.done
							? // Add day (deduplicated — don't push a duplicate on double-tap).
								days.includes(variables.day)
								? days
								: [...days, variables.day]
							: // Remove day.
								days.filter((d) => d !== variables.day);
						return { ...habit, completionDays: updated };
					});
				},
			);

			return { prev };
		},

		/** On error: restore the snapshot so the UI reverts cleanly. */
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev !== undefined) {
				queryClient.setQueryData(trpc.habit.list.queryKey(), ctx.prev);
			}
		},

		/** On settle: always reconcile with server truth. */
		onSettled: () => {
			queryClient.invalidateQueries(trpc.habit.list.queryFilter());
		},
	});
}
