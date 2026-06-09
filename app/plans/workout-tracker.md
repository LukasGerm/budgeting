# Workout Tracker (Hevy-style) — PRD & Implementation Plan

Status: planned 2026-06-09. Reference implementation: `/Users/lukasgermerott/dev/newapp` (Next.js + SQLite "IronLog" app) — we copy its **domain model and UX flows**, not its code or styling. Everything is rebuilt with this app's stack: TanStack Start, tRPC, Prisma/Postgres, TanStack Query, shadcn/ui, Lingui, Recharts.

## Product summary

A gym workout tracker inside the budgeting PWA, as a new top-level tab:

- **Plan creation**: reusable routines ("Push Day A") composed of exercises with target sets, rep range, and rest time.
- **Workout logging**: start a workout from a routine (or empty), log weight × reps per set, check sets off, rest timer, finish/discard. Shows last session's numbers per set for progressive overload.
- **Progress tracking**: per-exercise charts (best set weight + session volume over time), PR (heaviest weight), estimated 1RM, workout history.
- **Exercise library**: ~50 seeded built-in exercises across 6 muscle groups (Chest, Back, Legs, Shoulders, Arms, Core) + user-created custom exercises.

## Locked decisions

1. **Navigation: 5th bottom tab "Workouts"** (lucide `Dumbbell` icon, route `/workouts`).
   - 5 tabs is the iOS-native tab-bar maximum; everything stays one tap away.
   - To fit 5 tabs on small screens: shrink tab labels from `text-xs` to `text-[10px]` (native iOS tab label size), add `min-w-0` + `truncate max-w-full px-0.5` on the label span so long German labels ("Gewohnheiten") can never break the layout.
   - The whole workout domain lives behind this one tab; sub-screens are interior routes.
   - **The live-workout screen is full-screen**: the `_authed` layout hides BottomNav + the top app-bar on `/workouts/active` (same mechanism as `/onboarding`) so logging gets the whole viewport and the user is in "focus mode". A "Finish"/back affordance is always visible there.
2. **Weight unit**: kg only, stored as **integer grams** (`weightGrams`) following the `amountCents` convention. UI shows kg with up to 2 decimals (e.g. 82.5), accepts decimal input (locale-aware display via `useFormat`-style helpers; input can be plain `inputMode="decimal"`).
3. **Exercise names are NOT translated** — they're data, not UI chrome (gym vocabulary is English-first; Hevy users search English names). All UI chrome IS translated (Lingui, EN+DE).
4. **Built-in exercise library lives in the DB** with `userId = null`; seeded idempotently (upsert by name) from `prisma/seed.ts`. Custom exercises have `userId` set. `exercise.list` returns built-ins + own customs.
5. **One active workout at a time** per user (a workout with `finishedAt = null`). Starting a new one while one is active → UI asks resume or discard. The hub shows a prominent "resume" banner; the bottom-nav Workouts tab does NOT need a live indicator (the hub banner suffices for v1).
6. **Server-authoritative state, SSR-first** (matches the app's server-first architecture; no offline support). Every set edit/check commits via tRPC mutation with TanStack Query cache updates (optimistic where it helps responsiveness, e.g. set check-off). Rest timer is pure client state (no persistence; abandoning the page just clears it).
7. **Est. 1RM** uses the Epley formula: `weight × (1 + reps/30)`, computed in a pure domain module (`src/domain/workout.ts`) with unit tests, like `src/domain/habit.ts`.
8. **Finish semantics** (copied from reference): finishing saves only completed sets (incomplete rows are dropped); a workout with 0 completed sets can only be discarded, not finished. Discard deletes the workout row entirely.
9. **Previous-performance prefill**: when starting from a routine (or adding an exercise), each set row shows "last time: 80 kg × 8" pulled from the most recent *finished* workout containing that exercise (matched by set number), and pre-fills weight/reps inputs with those values.

## Data model (Prisma)

All user data cascades on user delete; every query in tRPC is pinned to `ctx.userId` (built-in exercises are readable by all, writable by none).

```prisma
model Exercise {
  id          String   @id @default(cuid())
  userId      String?  // null = built-in
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  muscleGroup String   // CHEST | BACK | LEGS | SHOULDERS | ARMS | CORE (enum)
  equipment   String   // BARBELL | DUMBBELL | CABLE | MACHINE | BODYWEIGHT (enum)
  createdAt   DateTime @default(now())
  @@unique([userId, name])
  @@index([userId])
}

model Routine {
  id          String            @id @default(cuid())
  userId      String
  name        String
  description String?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  exercises   RoutineExercise[]
  @@index([userId, createdAt])
}

model RoutineExercise {
  id          String   @id @default(cuid())
  routineId   String   // cascade from Routine
  exerciseId  String   // Restrict delete (can't delete an exercise used in a routine)
  position    Int
  targetSets  Int      // 1..12
  targetReps  String   // free text rep range: "8-12", "5"
  restSeconds Int      // default 120
}

model Workout {
  id         String            @id @default(cuid())
  userId     String
  routineId  String?           // SetNull on routine delete
  name       String
  startedAt  DateTime          @default(now())
  finishedAt DateTime?
  exercises  WorkoutExercise[]
  @@index([userId, startedAt])
  @@index([userId, finishedAt])
}

model WorkoutExercise {
  id          String       @id @default(cuid())
  workoutId   String       // cascade
  exerciseId  String       // Restrict
  position    Int
  restSeconds Int          @default(120)
  sets        WorkoutSet[]
}

model WorkoutSet {
  id                String    @id @default(cuid())
  workoutExerciseId String    // cascade
  setNumber         Int
  weightGrams       Int?      // null = bodyweight/not entered
  reps              Int?
  completed         Boolean   @default(false)
  completedAt       DateTime?
}
```

(Exact enum representation — Prisma enum vs string — implementer's choice, but be consistent with how the schema already models `Expense.kind`.)

## tRPC surface (`workoutRouter` + `exerciseRouter` + `routineRouter`, composed in `router.ts`)

- `exercise.list` — built-ins + own; `exercise.create { name, muscleGroup, equipment }`
- `routine.list` (with exercise summaries), `routine.get`, `routine.create`, `routine.update`, `routine.delete` — create/update take the full ordered exercise array and write transactionally
- `workout.active` — the unfinished workout (full detail) or null
- `workout.start { routineId? }` — errors with a typed code if one is already active; copies routine exercises → workout exercises, creates target-set rows prefilled from previous performance
- `workout.finish { id }`, `workout.discard { id }`
- `workout.addExercise`, `workout.removeExercise`, `workout.addSet`, `workout.deleteSet`, `workout.updateSet { weightGrams?, reps?, completed? }`
- `workout.history { cursor? }` — finished workouts, newest first, with summary (duration, sets, volume); `workout.get { id }` — full detail
- `workout.exerciseProgress { exerciseId }` — per finished session: date, best set (weight, reps), total volume; plus PR + est. 1RM (1RM math in domain module, callable from server + client)

Input validation with zod everywhere (reps 0–100, weight 0–2000 kg, names 1–80 chars, etc.), following the existing routers' style and `appErrorCode` error convention.

## Screens & routes (all under `_authed`)

| Route | Screen |
| --- | --- |
| `/workouts` | **Hub**: resume-active banner → routines list (card per routine: name, exercise preview, Start button, overflow menu edit/delete) → "Start empty workout" → recent finished workouts (last 3, link to history) |
| `/workouts/routines/new`, `/workouts/routines/$routineId/edit` | **Routine builder**: name, description, ordered exercise list (target sets stepper, target reps text, rest seconds select), reorder via up/down buttons, remove, add via **exercise picker drawer** (shadcn Drawer: search input + muscle-group filter chips + "create custom exercise" inline) |
| `/workouts/active` | **Live workout** (full-screen, nav hidden): sticky header (name, elapsed time ticker, completed/total sets, volume); per-exercise cards with set rows `Set # · last time · weight input · reps input · check`; swipe-free simple buttons (add set, remove set via row overflow or long-press-free delete button); add exercise (picker drawer); footer Finish (AlertDialog confirm) / Discard (AlertDialog confirm); **rest-timer bottom bar** (starts on set check if restSeconds > 0; countdown, +30s, skip) |
| `/workouts/history` | Finished workouts list (date, name, duration, sets, volume), infinite/paged |
| `/workouts/history/$workoutId` | Read-only workout detail: per-exercise set log |
| `/workouts/exercises/$exerciseId` | **Exercise progress**: PR badge, est-1RM, two Recharts line charts (best-set weight over time, session volume over time) using the `ChartContainer` + mounted-gate pattern from `src/components/dashboard/`, session log list |

Mobile UX requirements: touch targets ≥ 44px, number inputs `inputMode="decimal"` / `"numeric"`, drawers (not centered dialogs) for pickers on mobile, completed set rows visually distinct, layout respects the `_authed` flex/scroll convention and safe-area insets.

## Vertical slices

Each slice goes through implement → review → fix → re-review before the next starts (per CLAUDE.md loop). Browser verification of the whole feature happens after the last slice.

### Slice 1 — Foundation: schema, seed, nav, hub skeleton
- Prisma models + migration (`pnpm db:migrate`), seed ~50 built-in exercises (idempotent upsert) in `prisma/seed.ts`, run seed.
- `exerciseRouter` (`list`, `create`) + zod schemas; compose in `router.ts`.
- 5th bottom-nav tab (Dumbbell, `<Trans>Workouts</Trans>`) + the label-size/truncation changes from locked decision 1.
- `/workouts` route with loader-prefetched empty hub (empty states for routines + recent workouts, dead "Start empty workout" button is OK this slice).
- i18n: new strings through `<Trans>`/`t`; run extract+compile with DE translations.

### Slice 2 — Routine builder
- `routineRouter` CRUD (transactional create/update with ordered exercises).
- Routine builder screens (`new` + `$routineId/edit`), exercise picker drawer (search, muscle filter, create-custom inline), reorder/remove, target sets/reps/rest.
- Hub lists routines with edit/delete (AlertDialog confirm on delete).
- Unit tests for any non-trivial domain logic; i18n extract+compile.

### Slice 3 — Live workout logging
- `workout.active/start/finish/discard/addExercise/removeExercise/addSet/deleteSet/updateSet` + previous-performance prefill logic.
- `/workouts/active` full-screen screen incl. elapsed ticker, rest-timer bar, set logging with optimistic check-off; nav/app-bar hidden on this route.
- Hub: Start buttons live, resume banner, already-active handling (resume-or-discard prompt).
- Domain module `src/domain/workout.ts` (volume, est-1RM, duration formatting) + unit tests; i18n extract+compile.

### Slice 4 — History & progress
- `workout.history/get/exerciseProgress`.
- History list + detail screens; exercise progress screen with 2 Recharts charts, PR + est-1RM cards; exercises tappable from routine builder picker, history detail, and live workout → progress screen.
- Hub: recent workouts section live.
- i18n extract+compile; full DE pass over the whole feature.

### Final — Browser verification (whole plan)
End-to-end in Chrome at mobile viewport: seed visible → create routine → start workout → log sets (check prefill from previous session by doing two workouts) → rest timer → finish → history shows it → progress chart renders → nav fits with 5 tabs in EN and DE → live workout hides nav.

## Engineering notes for implementers

- Run `pnpm exec tsc --noEmit` — `pnpm build/check/test` do NOT fully typecheck.
- Postgres runs in the `budgeting-postgres` container on port 5433 (`docker start budgeting-postgres` if down); restart `pnpm dev` after migrations.
- Lingui extract/compile silently no-ops on Node < 22.18 — use the repo's wrapper scripts / correct Node (`.nvmrc` = 22.22.3).
- Biome (`pnpm check`) for lint/format; tabs + double quotes; `import type` separate (verbatimModuleSyntax).
- Match existing patterns: loader `ensureQueryData` + `useSuspenseQuery` hooks (see `src/routes/_authed/habits.tsx`, `src/hooks/use-habits.ts`), `protectedProcedure` + userId pinning, shadcn components only (`pnpm dlx shadcn@latest add <component>` for missing ones), dark-only theme, `#/` import alias.
