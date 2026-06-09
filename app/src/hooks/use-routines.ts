/**
 * React hooks for workout routines (reusable plans).
 *
 * Reads go through `useTRPC()` + `useSuspenseQuery` so the SSR-prefetched
 * cache entries (loader `ensureQueryData` on `/workouts` and the edit route)
 * are hit and components rehydrate without a loading flash — same pattern as
 * `use-habits.ts` / `use-exercises.ts`.
 *
 * Mutations invalidate `routine.list` (the hub) and, for update/delete, the
 * affected `routine.get` entry so a re-opened edit screen refetches fresh data.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Exercise } from "#/hooks/use-exercises";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

/** One exercise entry as `routine.create` / `routine.update` consume it.
 * Array order is the position — there is no explicit position field. */
export interface RoutineExerciseInput {
	exerciseId: string;
	/** 1–12 */
	targetSets: number;
	/** Free-text rep target, 1–20 chars, e.g. "8-12" or "5". */
	targetReps: string;
	/** 0–600 */
	restSeconds: number;
}

/** Wire shape of one `routine.list` row. */
export interface RoutineSummary {
	id: string;
	name: string;
	description: string | null;
	/** Exercise names in position order — for the card preview line. */
	exerciseNames: string[];
	exerciseCount: number;
	totalTargetSets: number;
}

/** Wire shape of one ordered exercise inside `routine.get`. */
export interface RoutineDetailExercise extends RoutineExerciseInput {
	/** Library data joined in — names are NOT translated (PRD). */
	name: string;
	muscleGroup: Exercise["muscleGroup"];
	equipment: Exercise["equipment"];
}

/** Wire shape of `routine.get`. */
export interface RoutineDetail {
	id: string;
	name: string;
	description: string | null;
	exercises: RoutineDetailExercise[];
}

/** Create/update payload (id added separately for update). */
export interface RoutineInput {
	name: string;
	description?: string;
	exercises: RoutineExerciseInput[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The caller's routines, newest first, with display summaries. */
export function useRoutines(): RoutineSummary[] {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(trpc.routine.list.queryOptions());
	return data;
}

/** Full detail of one caller-owned routine (loader-prefetched on the edit route). */
export function useRoutine(id: string): RoutineDetail {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(trpc.routine.get.queryOptions({ id }));
	return data;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mutation: create a routine, then refresh the hub list. */
export function useCreateRoutine() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.routine.create.mutationKey(),
		mutationFn: (input: RoutineInput) =>
			trpcClient.routine.create.mutate(input),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.routine.list.queryFilter()),
	});
}

/** Mutation: replace a routine's fields + exercise list, then refresh list + detail. */
export function useUpdateRoutine() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.routine.update.mutationKey(),
		mutationFn: (input: RoutineInput & { id: string }) =>
			trpcClient.routine.update.mutate(input),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries(trpc.routine.list.queryFilter());
			queryClient.invalidateQueries(
				trpc.routine.get.queryFilter({ id: variables.id }),
			);
		},
	});
}

/** Mutation: hard-delete a routine, then refresh list + drop its detail entry. */
export function useDeleteRoutine() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.routine.delete.mutationKey(),
		mutationFn: (input: { id: string }) =>
			trpcClient.routine.delete.mutate(input),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries(trpc.routine.list.queryFilter());
			// The detail entry is gone server-side — remove it rather than refetch
			// (a refetch would just NOT_FOUND).
			queryClient.removeQueries(
				trpc.routine.get.queryFilter({ id: variables.id }),
			);
		},
	});
}
