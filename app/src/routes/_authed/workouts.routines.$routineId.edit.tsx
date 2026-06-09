/**
 * Edit-routine route — the routine builder pre-filled from `routine.get`.
 *
 * The loader prefetches both `routine.get { id }` (the draft's initial
 * values) and `exercise.list` (the picker), so the first paint is fully
 * server-rendered. `routine.get` throws NOT_FOUND for a routine the caller
 * doesn't own — that surfaces through the route error boundary.
 *
 * Save calls `routine.update` (transactional replace of the exercise list);
 * the hook invalidates `routine.list` + this routine's `routine.get`, and on
 * success we navigate back to /workouts.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import type { RoutineDraft } from "#/components/workouts/routine-form";
import { RoutineForm } from "#/components/workouts/routine-form";
import { useRoutine, useUpdateRoutine } from "#/hooks/use-routines";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute(
	"/_authed/workouts/routines/$routineId/edit",
)({
	loader: async ({ context, params }) => {
		await withLoginRedirect(() =>
			Promise.all([
				context.queryClient.ensureQueryData(
					context.trpc.routine.get.queryOptions({ id: params.routineId }),
				),
				context.queryClient.ensureQueryData(
					context.trpc.exercise.list.queryOptions(),
				),
			]),
		);
	},
	component: EditRoutinePage,
});

function EditRoutinePage() {
	const { routineId } = Route.useParams();
	const navigate = useNavigate();
	const routine = useRoutine(routineId);
	const updateRoutine = useUpdateRoutine();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

	// Wire detail → builder draft. The draft is RoutineForm's *initial* state
	// only; edits live inside the form until Save.
	const initial: RoutineDraft = {
		name: routine.name,
		description: routine.description ?? "",
		exercises: routine.exercises.map((e) => ({
			exerciseId: e.exerciseId,
			name: e.name,
			muscleGroup: e.muscleGroup,
			equipment: e.equipment,
			targetSets: e.targetSets,
			targetReps: e.targetReps,
			restSeconds: e.restSeconds,
		})),
	};

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					className="-ml-3 size-11 shrink-0"
					asChild
				>
					<Link to="/workouts" aria-label={t`Back to workouts`}>
						<ChevronLeft className="size-5" />
					</Link>
				</Button>
				<h1 className="font-medium text-lg">
					<Trans>Edit plan</Trans>
				</h1>
			</header>

			<RoutineForm
				key={routineId}
				initial={initial}
				submitLabel={t`Save changes`}
				submittingLabel={t`Saving…`}
				isPending={updateRoutine.isPending}
				onSubmit={(input) =>
					updateRoutine.mutate(
						{ id: routineId, ...input },
						{
							onSuccess: () => {
								toast(t`Plan updated`);
								navigate({ to: "/workouts" });
							},
							onError: (e) => {
								toast.error(
									getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"),
								);
							},
						},
					)
				}
			/>
		</div>
	);
}
