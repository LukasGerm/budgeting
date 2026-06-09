/**
 * StartConflictDialog — shown when the user hits a Start button while a
 * workout is already active (PRD locked decision 5: one active workout at a
 * time → ask resume or discard-and-start-new).
 *
 * Controlled AlertDialog shared by the hub's "Start empty workout" button
 * and each RoutineCard's Start button; the caller owns `open` and supplies
 * the two outcomes.
 */

import { Trans } from "@lingui/react/macro";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";

interface StartConflictDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Navigate to the running workout. */
	onResume: () => void;
	/** Discard the active workout, then start the new one. */
	onDiscardAndStart: () => void;
}

export function StartConflictDialog({
	open,
	onOpenChange,
	onResume,
	onDiscardAndStart,
}: StartConflictDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						<Trans>You have a workout in progress</Trans>
					</AlertDialogTitle>
					<AlertDialogDescription>
						<Trans>
							Resume it, or discard it and start this one instead. Discarding
							deletes everything you logged in the running workout.
						</Trans>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>
						<Trans>Cancel</Trans>
					</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={onDiscardAndStart}>
						<Trans>Discard and start new</Trans>
					</AlertDialogAction>
					<AlertDialogAction onClick={onResume}>
						<Trans>Resume</Trans>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
