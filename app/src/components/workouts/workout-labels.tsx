/**
 * Translated UI labels for the workout tracker's stable enum strings.
 *
 * Exercise *names* are NOT translated (PRD locked decision) — but the muscle
 * group and equipment enums are UI chrome, so their labels go through Lingui.
 * Components call `useWorkoutLabels()` and index with the wire enum value.
 */

import { useLingui } from "@lingui/react/macro";
import type { Exercise } from "#/hooks/use-exercises";

export type MuscleGroup = Exercise["muscleGroup"];
export type EquipmentKind = Exercise["equipment"];

/** All muscle groups in library display order (matches the Prisma enum). */
export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
	"CHEST",
	"BACK",
	"LEGS",
	"SHOULDERS",
	"ARMS",
	"CORE",
];

/** All equipment kinds (matches the Prisma enum). */
export const EQUIPMENT_KINDS: readonly EquipmentKind[] = [
	"BARBELL",
	"DUMBBELL",
	"CABLE",
	"MACHINE",
	"BODYWEIGHT",
];

/** Translated label maps for muscle groups and equipment kinds. */
export function useWorkoutLabels(): {
	muscleGroup: Record<MuscleGroup, string>;
	equipment: Record<EquipmentKind, string>;
} {
	const { t } = useLingui();
	return {
		muscleGroup: {
			CHEST: t`Chest`,
			BACK: t`Back`,
			LEGS: t`Legs`,
			SHOULDERS: t`Shoulders`,
			ARMS: t`Arms`,
			CORE: t`Core`,
		},
		equipment: {
			BARBELL: t`Barbell`,
			DUMBBELL: t`Dumbbell`,
			CABLE: t`Cable`,
			MACHINE: t`Machine`,
			BODYWEIGHT: t`Bodyweight`,
		},
	};
}
