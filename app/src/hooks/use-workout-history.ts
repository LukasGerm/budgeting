/**
 * React hooks for finished-workout history and per-exercise progress
 * (workout tracker slice 4).
 *
 * History is one cursor-paginated tRPC infinite query (`workout.history`,
 * pages of 20, the workout id is the cursor). The hub's "Recent workouts"
 * section and the /workouts/history list share that single cache entry —
 * `workoutHistoryQueryOptions` is exported so route loaders can
 * `ensureInfiniteQueryData` the exact same options the hooks read.
 *
 * Detail (`workout.get`) and progress (`workout.exerciseProgress`) are plain
 * suspense queries, loader-prefetched on their routes (the `use-routines.ts`
 * pattern).
 */

import {
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { Exercise } from "#/hooks/use-exercises";
import { useTRPC } from "#/integrations/trpc/react";
import type { TRPCRouter } from "#/integrations/trpc/router";

/** Wire shape of one `workout.history` row (history card summary). */
export interface WorkoutHistoryItem {
	id: string;
	name: string;
	startedAt: Date;
	finishedAt: Date;
	/** Exercise names in position order — for the card preview line. */
	exerciseNames: string[];
	totalSets: number;
	volumeGrams: number;
}

/** Wire shape of one set inside `workout.get` (completed sets only). */
export interface WorkoutDetailSet {
	id: string;
	setNumber: number;
	weightGrams: number | null;
	reps: number | null;
}

/** Wire shape of one exercise inside `workout.get` (position order). */
export interface WorkoutDetailExercise {
	id: string;
	exerciseId: string;
	/** Library name — NOT translated (PRD). */
	name: string;
	muscleGroup: Exercise["muscleGroup"];
	sets: WorkoutDetailSet[];
}

/** Wire shape of `workout.get` — one finished workout, read-only. */
export interface WorkoutDetail {
	id: string;
	name: string;
	startedAt: Date;
	finishedAt: Date;
	exercises: WorkoutDetailExercise[];
}

/** One finished session of an exercise (chronological chart point). */
export interface ExerciseProgressPoint {
	workoutId: string;
	finishedAt: Date;
	/** Heaviest set of that session (grams; 0 for bodyweight-only). */
	bestSetWeightGrams: number;
	/** Reps of that heaviest set. */
	bestSetReps: number;
	/** This exercise's volume in that session only. */
	volumeGrams: number;
}

/** Wire shape of `workout.exerciseProgress`. */
export interface ExerciseProgress {
	exercise: Pick<Exercise, "id" | "name" | "muscleGroup" | "equipment">;
	/** Oldest → newest — chart-ready. */
	points: ExerciseProgressPoint[];
	/** Heaviest set ever (grams) — null when no sessions yet. */
	prWeightGrams: number | null;
	/** Max Epley 1RM estimate over all sets — null when no sessions yet. */
	bestEst1RmGrams: number | null;
}

/**
 * The one infinite-query options object for `workout.history` — used by the
 * hooks below *and* by route loaders (`ensureInfiniteQueryData`), so both
 * sides address the identical cache entry.
 */
export function workoutHistoryQueryOptions(trpc: TRPCOptionsProxy<TRPCRouter>) {
	return trpc.workout.history.infiniteQueryOptions(
		{},
		{ getNextPageParam: (page) => page.nextCursor },
	);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Paged finished-workout history (flattened items + load-more controls). */
export function useWorkoutHistory(): {
	items: WorkoutHistoryItem[];
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => void;
} {
	const trpc = useTRPC();
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
		useSuspenseInfiniteQuery(workoutHistoryQueryOptions(trpc));
	return {
		items: data.pages.flatMap((page) => page.items),
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage: () => {
			fetchNextPage();
		},
	};
}

/** The hub's "Recent workouts": the newest `limit` finished workouts,
 * read from the history query's first page (shared cache entry). */
export function useRecentWorkouts(limit = 3): WorkoutHistoryItem[] {
	const trpc = useTRPC();
	const { data } = useSuspenseInfiniteQuery(workoutHistoryQueryOptions(trpc));
	return (data.pages[0]?.items ?? []).slice(0, limit);
}

/** Full read-only detail of one finished workout (loader-prefetched). */
export function useWorkoutDetail(id: string): WorkoutDetail {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(trpc.workout.get.queryOptions({ id }));
	return data;
}

/** Per-exercise progress: chart points + PR / est-1RM headline stats. */
export function useExerciseProgress(exerciseId: string): ExerciseProgress {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(
		trpc.workout.exerciseProgress.queryOptions({ exerciseId }),
	);
	return data;
}
