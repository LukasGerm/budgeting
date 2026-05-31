---
name: sheet-component-pattern
description: The vaul Drawer "sheet" create/edit form pattern (SpendSheet, HabitSheet) and its local-state conventions
metadata:
  type: project
---

Bottom-sheet form pattern (src/components/spend-sheet.tsx, src/components/habits/habit-sheet.tsx).

A shadcn `Drawer` (vaul, direction bottom) owns `open` state and the in-progress form fields. Conventions:
- Default trigger is a FAB: `<Button size="icon" className="fixed right-6 bottom-20 z-40 size-16 rounded-full shadow-lg">` with `<Plus className="size-7" />` and an `aria-label`. HabitSheet additionally accepts an optional `trigger` prop (used for the empty-state "Create your first habit" button) and an optional `habit` prop reserved for slice-7 edit reuse.
- `handleOpenChange(next)` resets fields when `next === false` (closing) — for SpendSheet via a reducer `reset`; for HabitSheet by resetting name/icon to empty (create) or original values (edit).
- Submit is guarded by `canSubmit && !isPending`; on success close+reset+toast; on error keep open with values intact and `toast.error("Couldn't save that. Check your connection.")`.
- Inner content wrapped in `<div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-8">` with a `DrawerHeader p-0`, `DrawerTitle`, and an `sr-only` `DrawerDescription`.

**Local-state count:** SpendSheet uses `useState(open)` + a `useReducer` for the multi-field form. HabitSheet uses 3 `useState`s (open, name, icon) — at the upper edge of the ≤3 guideline but ACCEPTABLE for a 2-field form; don't flag. If a sheet grows past this, consolidate fields into a reducer like EntryForm does. No `useEffect` in these — reset is event-driven via onOpenChange, which is correct.

**Icon ToggleGroup (HabitSheet):** `ToggleGroup type="single"` whose `value` is `HabitIconName | ""`; `onValueChange` ignores the empty deselect (`if (v) setIcon(...)`) so an icon can't be un-picked into an invalid state. Icons come from `HABIT_ICON_NAMES`/`HABIT_ICON_COMPONENTS` in src/components/habits/habit-icons.tsx (curated lucide set; doubles as the z.enum source for the `create` procedure, with `resolveHabitIcon` providing a safe fallback for unknown stored names).

**Slice 7 — controlled-open + edit reuse (HabitSheet):** the sheet now optionally takes `open`/`onOpenChange` (controlled mode, renders no trigger) and `habit?` (edit mode: pre-fills name+icon from `useState(existingHabit?.name ?? "")` initializers, swaps title/submit to "Edit habit"/"Save changes", routes submit to `useUpdateHabit`). `color` is intentionally NOT editable. HabitCard renders ONE controlled HabitSheet per card (`<HabitSheet habit={habit} open={editing} onOpenChange={setEditing} />`), so the sheet is bound to a single habit, never swapped across habits.

**STALE-PREFILL PITFALL (recurring thing to check on edit-sheets):** the prefill uses plain `useState(prop)` initializers, which run only on FIRST mount. After a successful edit, `handleOpenChange(false)` reruns `setName(existingHabit?.name)` while the prop is still the OLD value (cache not yet re-rendered), so local state resets to stale; the later invalidate→refetch updates the `habit` prop but the `useState` does NOT re-sync. Net effect: reopen shows the pre-edit name/icon, and a no-touch reopen+Save re-persists the stale values, REVERTING the prior edit (data correctness, not just cosmetic). Correct fixes: remount the sheet on each open (`key={\`${habit.id}-${editing}\`}` or key by habit.id) so initializers re-run, or re-seed name/icon from the prop when the sheet transitions to open. Do NOT accept a `useEffect([habit]) → setState` sync — prefer the key/remount approach. Flag this whenever a controlled edit form derives initial values via useState initializers and resets on close.

See [[trpc-router-conventions]] for the useCreateHabit/useUpdateHabit/useDeleteHabit write hooks (all plain invalidate-on-success, no optimism — only useToggleCompletion is optimistic; see [[optimistic-mutation-pattern]]).
