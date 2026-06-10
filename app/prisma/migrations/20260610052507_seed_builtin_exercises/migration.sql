-- Data migration: the built-in exercise library (54 rows, "userId" IS NULL).
--
-- Production runs migrations only (`prisma migrate deploy` via the
-- deploy-prisma workflow) — `prisma db seed` never runs there — so the
-- built-ins ship as a migration. prisma/seed.ts keeps the same list for
-- local convenience; the two must stay in sync.
--
-- Idempotency: the NOT EXISTS guard skips any name already present among
-- built-ins (case-insensitive), so databases that were already seeded by
-- prisma/seed.ts (random cuid ids) are left untouched. The guard is scoped
-- to "userId" IS NULL on purpose: a user's custom exercise with the same
-- name must not block inserting the global built-in.
INSERT INTO "exercise" ("id", "userId", "name", "muscleGroup", "equipment")
SELECT v.id, NULL, v.name, v.muscle_group::"MuscleGroup", v.equipment::"Equipment"
FROM (
	VALUES
		-- Chest
		('builtin-bench-press', 'Bench Press', 'CHEST', 'BARBELL'),
		('builtin-incline-bench-press', 'Incline Bench Press', 'CHEST', 'BARBELL'),
		('builtin-dumbbell-bench-press', 'Dumbbell Bench Press', 'CHEST', 'DUMBBELL'),
		('builtin-incline-dumbbell-press', 'Incline Dumbbell Press', 'CHEST', 'DUMBBELL'),
		('builtin-dumbbell-fly', 'Dumbbell Fly', 'CHEST', 'DUMBBELL'),
		('builtin-cable-fly', 'Cable Fly', 'CHEST', 'CABLE'),
		('builtin-chest-press-machine', 'Chest Press Machine', 'CHEST', 'MACHINE'),
		('builtin-push-up', 'Push Up', 'CHEST', 'BODYWEIGHT'),
		('builtin-dip', 'Dip', 'CHEST', 'BODYWEIGHT'),
		-- Back
		('builtin-deadlift', 'Deadlift', 'BACK', 'BARBELL'),
		('builtin-barbell-row', 'Barbell Row', 'BACK', 'BARBELL'),
		('builtin-pull-up', 'Pull Up', 'BACK', 'BODYWEIGHT'),
		('builtin-chin-up', 'Chin Up', 'BACK', 'BODYWEIGHT'),
		('builtin-lat-pulldown', 'Lat Pulldown', 'BACK', 'CABLE'),
		('builtin-seated-cable-row', 'Seated Cable Row', 'BACK', 'CABLE'),
		('builtin-dumbbell-row', 'Dumbbell Row', 'BACK', 'DUMBBELL'),
		('builtin-t-bar-row', 'T-Bar Row', 'BACK', 'MACHINE'),
		('builtin-back-extension', 'Back Extension', 'BACK', 'BODYWEIGHT'),
		-- Legs
		('builtin-squat', 'Squat', 'LEGS', 'BARBELL'),
		('builtin-front-squat', 'Front Squat', 'LEGS', 'BARBELL'),
		('builtin-romanian-deadlift', 'Romanian Deadlift', 'LEGS', 'BARBELL'),
		('builtin-hip-thrust', 'Hip Thrust', 'LEGS', 'BARBELL'),
		('builtin-leg-press', 'Leg Press', 'LEGS', 'MACHINE'),
		('builtin-leg-extension', 'Leg Extension', 'LEGS', 'MACHINE'),
		('builtin-leg-curl', 'Leg Curl', 'LEGS', 'MACHINE'),
		('builtin-calf-raise', 'Calf Raise', 'LEGS', 'MACHINE'),
		('builtin-bulgarian-split-squat', 'Bulgarian Split Squat', 'LEGS', 'DUMBBELL'),
		('builtin-walking-lunge', 'Walking Lunge', 'LEGS', 'DUMBBELL'),
		-- Shoulders
		('builtin-overhead-press', 'Overhead Press', 'SHOULDERS', 'BARBELL'),
		('builtin-dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'SHOULDERS', 'DUMBBELL'),
		('builtin-arnold-press', 'Arnold Press', 'SHOULDERS', 'DUMBBELL'),
		('builtin-lateral-raise', 'Lateral Raise', 'SHOULDERS', 'DUMBBELL'),
		('builtin-front-raise', 'Front Raise', 'SHOULDERS', 'DUMBBELL'),
		('builtin-rear-delt-fly', 'Rear Delt Fly', 'SHOULDERS', 'DUMBBELL'),
		('builtin-shrug', 'Shrug', 'SHOULDERS', 'DUMBBELL'),
		('builtin-face-pull', 'Face Pull', 'SHOULDERS', 'CABLE'),
		('builtin-cable-lateral-raise', 'Cable Lateral Raise', 'SHOULDERS', 'CABLE'),
		-- Arms
		('builtin-bicep-curl', 'Bicep Curl', 'ARMS', 'DUMBBELL'),
		('builtin-hammer-curl', 'Hammer Curl', 'ARMS', 'DUMBBELL'),
		('builtin-barbell-curl', 'Barbell Curl', 'ARMS', 'BARBELL'),
		('builtin-preacher-curl', 'Preacher Curl', 'ARMS', 'MACHINE'),
		('builtin-cable-curl', 'Cable Curl', 'ARMS', 'CABLE'),
		('builtin-tricep-pushdown', 'Tricep Pushdown', 'ARMS', 'CABLE'),
		('builtin-overhead-tricep-extension', 'Overhead Tricep Extension', 'ARMS', 'DUMBBELL'),
		('builtin-skull-crusher', 'Skull Crusher', 'ARMS', 'BARBELL'),
		('builtin-close-grip-bench-press', 'Close-Grip Bench Press', 'ARMS', 'BARBELL'),
		-- Core
		('builtin-plank', 'Plank', 'CORE', 'BODYWEIGHT'),
		('builtin-side-plank', 'Side Plank', 'CORE', 'BODYWEIGHT'),
		('builtin-crunch', 'Crunch', 'CORE', 'BODYWEIGHT'),
		('builtin-sit-up', 'Sit Up', 'CORE', 'BODYWEIGHT'),
		('builtin-hanging-leg-raise', 'Hanging Leg Raise', 'CORE', 'BODYWEIGHT'),
		('builtin-ab-wheel-rollout', 'Ab Wheel Rollout', 'CORE', 'BODYWEIGHT'),
		('builtin-russian-twist', 'Russian Twist', 'CORE', 'DUMBBELL'),
		('builtin-cable-crunch', 'Cable Crunch', 'CORE', 'CABLE')
) AS v(id, name, muscle_group, equipment)
WHERE NOT EXISTS (
	SELECT 1
	FROM "exercise" e
	WHERE e."userId" IS NULL
		AND lower(e."name") = lower(v.name)
);
