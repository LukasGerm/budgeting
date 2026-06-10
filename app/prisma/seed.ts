/**
 * Seed: built-in exercise library for the workout tracker.
 *
 * Built-in exercises carry `userId = null` and are readable by every user
 * (see `exercise.list`); custom exercises created in-app carry a userId.
 *
 * Idempotency note: the schema's `@@unique([userId, name])` does NOT dedupe
 * rows with a NULL userId (Postgres treats NULLs as distinct in unique
 * indexes), so we can't `upsert` on that key for built-ins. Instead we read
 * the existing built-in names once and `createMany` only the missing ones —
 * running the seed twice inserts nothing the second time.
 *
 * Exercise names are deliberately NOT translated (PRD locked decision 3):
 * they're data, not UI chrome.
 *
 * Production note: deploys never run this seed — the canonical source for
 * built-ins in deployed environments is the data migration
 * `prisma/migrations/20260610052507_seed_builtin_exercises`. Keep the list
 * below in sync with that migration's VALUES when adding built-ins.
 */

import { prisma } from "../src/db";
import type { Equipment, MuscleGroup } from "../src/generated/prisma/enums";

interface BuiltInExercise {
	name: string;
	muscleGroup: MuscleGroup;
	equipment: Equipment;
}

const BUILT_IN_EXERCISES: BuiltInExercise[] = [
	// ── Chest ────────────────────────────────────────────────────────────────
	{ name: "Bench Press", muscleGroup: "CHEST", equipment: "BARBELL" },
	{ name: "Incline Bench Press", muscleGroup: "CHEST", equipment: "BARBELL" },
	{ name: "Dumbbell Bench Press", muscleGroup: "CHEST", equipment: "DUMBBELL" },
	{
		name: "Incline Dumbbell Press",
		muscleGroup: "CHEST",
		equipment: "DUMBBELL",
	},
	{ name: "Dumbbell Fly", muscleGroup: "CHEST", equipment: "DUMBBELL" },
	{ name: "Cable Fly", muscleGroup: "CHEST", equipment: "CABLE" },
	{ name: "Chest Press Machine", muscleGroup: "CHEST", equipment: "MACHINE" },
	{ name: "Push Up", muscleGroup: "CHEST", equipment: "BODYWEIGHT" },
	{ name: "Dip", muscleGroup: "CHEST", equipment: "BODYWEIGHT" },

	// ── Back ─────────────────────────────────────────────────────────────────
	{ name: "Deadlift", muscleGroup: "BACK", equipment: "BARBELL" },
	{ name: "Barbell Row", muscleGroup: "BACK", equipment: "BARBELL" },
	{ name: "Pull Up", muscleGroup: "BACK", equipment: "BODYWEIGHT" },
	{ name: "Chin Up", muscleGroup: "BACK", equipment: "BODYWEIGHT" },
	{ name: "Lat Pulldown", muscleGroup: "BACK", equipment: "CABLE" },
	{ name: "Seated Cable Row", muscleGroup: "BACK", equipment: "CABLE" },
	{ name: "Dumbbell Row", muscleGroup: "BACK", equipment: "DUMBBELL" },
	{ name: "T-Bar Row", muscleGroup: "BACK", equipment: "MACHINE" },
	{ name: "Back Extension", muscleGroup: "BACK", equipment: "BODYWEIGHT" },

	// ── Legs ─────────────────────────────────────────────────────────────────
	{ name: "Squat", muscleGroup: "LEGS", equipment: "BARBELL" },
	{ name: "Front Squat", muscleGroup: "LEGS", equipment: "BARBELL" },
	{ name: "Romanian Deadlift", muscleGroup: "LEGS", equipment: "BARBELL" },
	{ name: "Hip Thrust", muscleGroup: "LEGS", equipment: "BARBELL" },
	{ name: "Leg Press", muscleGroup: "LEGS", equipment: "MACHINE" },
	{ name: "Leg Extension", muscleGroup: "LEGS", equipment: "MACHINE" },
	{ name: "Leg Curl", muscleGroup: "LEGS", equipment: "MACHINE" },
	{ name: "Calf Raise", muscleGroup: "LEGS", equipment: "MACHINE" },
	{
		name: "Bulgarian Split Squat",
		muscleGroup: "LEGS",
		equipment: "DUMBBELL",
	},
	{ name: "Walking Lunge", muscleGroup: "LEGS", equipment: "DUMBBELL" },

	// ── Shoulders ────────────────────────────────────────────────────────────
	{ name: "Overhead Press", muscleGroup: "SHOULDERS", equipment: "BARBELL" },
	{
		name: "Dumbbell Shoulder Press",
		muscleGroup: "SHOULDERS",
		equipment: "DUMBBELL",
	},
	{ name: "Arnold Press", muscleGroup: "SHOULDERS", equipment: "DUMBBELL" },
	{ name: "Lateral Raise", muscleGroup: "SHOULDERS", equipment: "DUMBBELL" },
	{ name: "Front Raise", muscleGroup: "SHOULDERS", equipment: "DUMBBELL" },
	{ name: "Rear Delt Fly", muscleGroup: "SHOULDERS", equipment: "DUMBBELL" },
	{ name: "Shrug", muscleGroup: "SHOULDERS", equipment: "DUMBBELL" },
	{ name: "Face Pull", muscleGroup: "SHOULDERS", equipment: "CABLE" },
	{
		name: "Cable Lateral Raise",
		muscleGroup: "SHOULDERS",
		equipment: "CABLE",
	},

	// ── Arms ─────────────────────────────────────────────────────────────────
	{ name: "Bicep Curl", muscleGroup: "ARMS", equipment: "DUMBBELL" },
	{ name: "Hammer Curl", muscleGroup: "ARMS", equipment: "DUMBBELL" },
	{ name: "Barbell Curl", muscleGroup: "ARMS", equipment: "BARBELL" },
	{ name: "Preacher Curl", muscleGroup: "ARMS", equipment: "MACHINE" },
	{ name: "Cable Curl", muscleGroup: "ARMS", equipment: "CABLE" },
	{ name: "Tricep Pushdown", muscleGroup: "ARMS", equipment: "CABLE" },
	{
		name: "Overhead Tricep Extension",
		muscleGroup: "ARMS",
		equipment: "DUMBBELL",
	},
	{ name: "Skull Crusher", muscleGroup: "ARMS", equipment: "BARBELL" },
	{
		name: "Close-Grip Bench Press",
		muscleGroup: "ARMS",
		equipment: "BARBELL",
	},

	// ── Core ─────────────────────────────────────────────────────────────────
	{ name: "Plank", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Side Plank", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Crunch", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Sit Up", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Hanging Leg Raise", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Ab Wheel Rollout", muscleGroup: "CORE", equipment: "BODYWEIGHT" },
	{ name: "Russian Twist", muscleGroup: "CORE", equipment: "DUMBBELL" },
	{ name: "Cable Crunch", muscleGroup: "CORE", equipment: "CABLE" },
];

async function main() {
	// Existing built-in names (userId null) — used to skip already-seeded rows.
	const existing = await prisma.exercise.findMany({
		where: { userId: null },
		select: { name: true },
	});
	const existingNames = new Set(existing.map((e) => e.name));

	const missing = BUILT_IN_EXERCISES.filter(
		(e) => !existingNames.has(e.name),
	).map((e) => ({ ...e, userId: null }));

	if (missing.length === 0) {
		console.log(
			`Built-in exercises already seeded (${existingNames.size} present). Nothing to do.`,
		);
		return;
	}

	const { count } = await prisma.exercise.createMany({ data: missing });
	console.log(
		`Seeded ${count} built-in exercises (${existingNames.size} were already present).`,
	);
}

main()
	.catch((e) => {
		console.error("Error seeding database:", e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
