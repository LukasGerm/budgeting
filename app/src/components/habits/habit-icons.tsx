/**
 * Curated habit icon registry.
 *
 * `HABIT_ICON_NAMES` — a plain string tuple usable as a zod enum source.
 * Importing this file in server code is safe: lucide-react renders in SSR.
 *
 * `HABIT_ICON_COMPONENTS` — a name → React component map for rendering.
 *
 * `resolveHabitIcon(name)` — returns the component for `name`, falling back
 * to `CalendarCheck` so an unknown stored name never crashes a card.
 */

import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	Brain,
	CalendarCheck,
	Cigarette,
	Code2,
	Coffee,
	Droplet,
	Dumbbell,
	Footprints,
	HeartPulse,
	Languages,
	Leaf,
	Moon,
	Music,
	PenLine,
	Pill,
	Sun,
} from "lucide-react";

export const HABIT_ICON_NAMES = [
	"BookOpen",
	"Brain",
	"Cigarette",
	"Code2",
	"Coffee",
	"Droplet",
	"Dumbbell",
	"Footprints",
	"HeartPulse",
	"Languages",
	"Leaf",
	"Moon",
	"Music",
	"PenLine",
	"Pill",
	"Sun",
] as const;

export type HabitIconName = (typeof HABIT_ICON_NAMES)[number];

export const HABIT_ICON_COMPONENTS: Record<HabitIconName, LucideIcon> = {
	BookOpen,
	Brain,
	Cigarette,
	Code2,
	Coffee,
	Droplet,
	Dumbbell,
	Footprints,
	HeartPulse,
	Languages,
	Leaf,
	Moon,
	Music,
	PenLine,
	Pill,
	Sun,
};

/** Resolve a stored icon name to a lucide component, with a safe fallback. */
export function resolveHabitIcon(name: string): LucideIcon {
	if (name in HABIT_ICON_COMPONENTS) {
		return HABIT_ICON_COMPONENTS[name as HabitIconName];
	}
	return CalendarCheck;
}
