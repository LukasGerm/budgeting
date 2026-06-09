/**
 * React hooks for the live workout (workout tracker slice 3).
 *
 * Server state lives in the single `workout.active` TanStack Query entry —
 * loader-prefetched on /workouts and /workouts/active, read with
 * `useSuspenseQuery` (the `use-habits.ts` / `use-routines.ts` pattern).
 *
 * Mutations invalidate `workout.active`; `useUpdateSet` additionally applies
 * an optimistic cache patch (the `useToggleCompletion` pattern) so checking
 * a set off — the highest-frequency interaction mid-workout — flips
 * instantly instead of waiting a network roundtrip.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Exercise } from "#/hooks/use-exercises";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

/** The matching set from the last finished workout — the "last time" hint. */
export interface PreviousSet {
	weightGrams: number | null;
	reps: number | null;
}

/** Wire shape of one set inside `workout.active`. */
export interface ActiveWorkoutSet {
	id: string;
	setNumber: number;
	weightGrams: number | null;
	reps: number | null;
	completed: boolean;
	previous: PreviousSet | null;
}

/** Wire shape of one exercise inside `workout.active` (position order). */
export interface ActiveWorkoutExercise {
	id: string;
	exerciseId: string;
	/** Library name — NOT translated (PRD). */
	name: string;
	muscleGroup: Exercise["muscleGroup"];
	position: number;
	restSeconds: number;
	sets: ActiveWorkoutSet[];
}

/** Wire shape of `workout.active` (when non-null). */
export interface ActiveWorkout {
	id: string;
	name: string;
	startedAt: Date;
	exercises: ActiveWorkoutExercise[];
}

/** Partial-update payload for one set (see `workout.updateSet`). */
export interface UpdateSetInput {
	setId: string;
	weightGrams?: number | null;
	reps?: number | null;
	completed?: boolean;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The caller's active (unfinished) workout, or null. */
export function useActiveWorkout(): ActiveWorkout | null {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(trpc.workout.active.queryOptions());
	return data;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Invalidate the active-workout entry — every workout mutation reconciles here. */
function useInvalidateActive() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries(trpc.workout.active.queryFilter());
}

/**
 * Invalidate everything a finish/discard changes: the active workout (gone),
 * the finished-workout history (hub recents + /workouts/history), and every
 * per-exercise progress entry (a finish adds chart points; `pathFilter`
 * matches all exerciseId inputs).
 */
function useInvalidateWorkoutLifecycle() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries(trpc.workout.active.queryFilter());
		queryClient.invalidateQueries(trpc.workout.history.pathFilter());
		queryClient.invalidateQueries(trpc.workout.exerciseProgress.pathFilter());
	};
}

/**
 * Mutation: start a workout (from a routine or empty). Resolves with `{ id }`;
 * the active-workout entry is invalidated so the /workouts/active loader (or
 * the hub banner) fetches the full shape.
 */
export function useStartWorkout() {
	const trpc = useTRPC();
	const invalidate = useInvalidateActive();
	return useMutation({
		mutationKey: trpc.workout.start.mutationKey(),
		mutationFn: (input: { routineId?: string; name?: string }) =>
			trpcClient.workout.start.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: finish the active workout (drops incomplete sets server-side).
 * Invalidates history/progress too — the workout just became history. */
export function useFinishWorkout() {
	const trpc = useTRPC();
	const invalidate = useInvalidateWorkoutLifecycle();
	return useMutation({
		mutationKey: trpc.workout.finish.mutationKey(),
		mutationFn: (input: { id: string }) =>
			trpcClient.workout.finish.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: discard (hard-delete) the active workout. History/progress are
 * invalidated too, keeping the lifecycle symmetric with finish. */
export function useDiscardWorkout() {
	const trpc = useTRPC();
	const invalidate = useInvalidateWorkoutLifecycle();
	return useMutation({
		mutationKey: trpc.workout.discard.mutationKey(),
		mutationFn: (input: { id: string }) =>
			trpcClient.workout.discard.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: append an exercise (with prefilled default sets) to the workout. */
export function useAddWorkoutExercise() {
	const trpc = useTRPC();
	const invalidate = useInvalidateActive();
	return useMutation({
		mutationKey: trpc.workout.addExercise.mutationKey(),
		mutationFn: (input: { workoutId: string; exerciseId: string }) =>
			trpcClient.workout.addExercise.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: remove an exercise (and its sets) from the workout. */
export function useRemoveWorkoutExercise() {
	const trpc = useTRPC();
	const invalidate = useInvalidateActive();
	return useMutation({
		mutationKey: trpc.workout.removeExercise.mutationKey(),
		mutationFn: (input: { workoutExerciseId: string }) =>
			trpcClient.workout.removeExercise.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: append a set to an exercise (copies the last set's values). */
export function useAddSet() {
	const trpc = useTRPC();
	const invalidate = useInvalidateActive();
	return useMutation({
		mutationKey: trpc.workout.addSet.mutationKey(),
		mutationFn: (input: { workoutExerciseId: string }) =>
			trpcClient.workout.addSet.mutate(input),
		onSuccess: invalidate,
	});
}

/** Mutation: delete a set (server renumbers the exercise's remaining sets). */
export function useDeleteSet() {
	const trpc = useTRPC();
	const invalidate = useInvalidateActive();
	return useMutation({
		mutationKey: trpc.workout.deleteSet.mutationKey(),
		mutationFn: (input: { setId: string }) =>
			trpcClient.workout.deleteSet.mutate(input),
		onSuccess: invalidate,
	});
}

/**
 * Mutation: partial-update one set, optimistically.
 *
 * Pattern (from `useToggleCompletion`):
 *   1. `onMutate` — cancel in-flight refetches, snapshot the cache, patch the
 *      set in place so the check-off / typed value lands instantly.
 *   2. `onError` — restore the snapshot.
 *   3. `onSettled` — invalidate to reconcile with server truth.
 */
export function useUpdateSet() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: trpc.workout.updateSet.mutationKey(),
		mutationFn: (input: UpdateSetInput) =>
			trpcClient.workout.updateSet.mutate(input),

		onMutate: async (variables) => {
			await queryClient.cancelQueries(trpc.workout.active.queryFilter());
			const prev = queryClient.getQueryData(trpc.workout.active.queryKey());

			queryClient.setQueryData(
				trpc.workout.active.queryKey(),
				(old: ActiveWorkout | null | undefined) => {
					if (!old) return old;
					return {
						...old,
						exercises: old.exercises.map((exercise) => ({
							...exercise,
							sets: exercise.sets.map((set) => {
								if (set.id !== variables.setId) return set;
								return {
									...set,
									...(variables.weightGrams !== undefined && {
										weightGrams: variables.weightGrams,
									}),
									...(variables.reps !== undefined && { reps: variables.reps }),
									...(variables.completed !== undefined && {
										completed: variables.completed,
									}),
								};
							}),
						})),
					};
				},
			);

			return { prev };
		},

		onError: (_err, _vars, ctx) => {
			if (ctx?.prev !== undefined) {
				queryClient.setQueryData(trpc.workout.active.queryKey(), ctx.prev);
			}
		},

		onSettled: () => {
			queryClient.invalidateQueries(trpc.workout.active.queryFilter());
		},
	});
}
