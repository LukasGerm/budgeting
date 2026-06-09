/**
 * React hooks for the workout tracker's exercise library.
 *
 * Reads go through `useTRPC()` + `useSuspenseQuery` so the SSR-prefetched
 * cache entry (loader `ensureQueryData` on `/workouts`) is hit and the
 * component rehydrates without a loading flash — same pattern as
 * `use-habits.ts`.
 *
 * Exercise names are NOT translated (PRD locked decision): render `name`
 * verbatim. `muscleGroup` / `equipment` are stable enum strings — UI labels
 * for them are translated at the component level, not here.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

/** Client-side exercise shape (wire format from `exercise.list`). */
export interface Exercise {
	id: string;
	name: string;
	muscleGroup: "CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE";
	equipment: "BARBELL" | "DUMBBELL" | "CABLE" | "MACHINE" | "BODYWEIGHT";
	/** True for the caller's own custom exercises, false for built-ins. */
	isCustom: boolean;
}

/**
 * All exercises visible to the user (built-ins + own customs), ordered by
 * muscle group then name — the order the server returns is rendered as-is.
 */
export function useExercises(): Exercise[] {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(trpc.exercise.list.queryOptions());
	return data;
}

/**
 * Mutation: create a custom exercise, then refresh the library list.
 * Resolves with the created exercise (wire shape above) so callers — e.g. the
 * routine builder's picker — can immediately add it to whatever they're
 * building.
 */
export function useCreateExercise() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.exercise.create.mutationKey(),
		mutationFn: (input: {
			name: string;
			muscleGroup: Exercise["muscleGroup"];
			equipment: Exercise["equipment"];
		}) => trpcClient.exercise.create.mutate(input),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.exercise.list.queryFilter()),
	});
}
