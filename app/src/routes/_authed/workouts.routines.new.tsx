/**
 * New-routine route — the routine builder with a blank draft.
 *
 * The loader prefetches `exercise.list` so the picker drawer opens instantly
 * with SSR-warmed data (same `ensureQueryData` + suspense-hook pattern as the
 * hub). Save calls `routine.create`; the hook invalidates `routine.list`, and
 * on success we navigate back to /workouts where the new plan appears.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { RoutineForm } from "#/components/workouts/routine-form";
import { useCreateRoutine } from "#/hooks/use-routines";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/workouts/routines/new")({
	loader: async ({ context }) => {
		await withLoginRedirect(() =>
			context.queryClient.ensureQueryData(
				context.trpc.exercise.list.queryOptions(),
			),
		);
	},
	component: NewRoutinePage,
});

function NewRoutinePage() {
	const navigate = useNavigate();
	const createRoutine = useCreateRoutine();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

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
					<Trans>New plan</Trans>
				</h1>
			</header>

			<RoutineForm
				submitLabel={t`Create plan`}
				submittingLabel={t`Creating…`}
				isPending={createRoutine.isPending}
				onSubmit={(input) =>
					createRoutine.mutate(input, {
						onSuccess: () => {
							toast(t`Plan created`);
							navigate({ to: "/workouts" });
						},
						onError: (e) => {
							toast.error(
								getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"),
							);
						},
					})
				}
			/>
		</div>
	);
}
