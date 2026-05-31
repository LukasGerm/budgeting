/**
 * BottomNav — the persistent tab bar for authenticated screens.
 *
 * Rendered once by the `_authed` layout so it appears on every authed page
 * (Home / Dashboard / History / Habits) without each route re-declaring it.
 * It's a `fixed bottom-0` bar; the layout pads its content with `pb-16` so
 * nothing hides behind it, and the FAB (in `SpendSheet`) sits above it.
 *
 * Active state comes from TanStack Router's `Link` — we read `isActive` from
 * its render-prop and colour the active tab `text-foreground` against the
 * muted rest. `activeOptions={{ exact: true }}` on Home keeps it from staying
 * lit on `/history` and `/habits` (every path is a prefix of `/`).
 *
 * Settings is no longer a bottom tab — it's reachable via the gear in the
 * top app-bar rendered by the `_authed` layout.
 *
 * Labels are wrapped in `<Trans>` so Lingui can translate them and extract
 * them into message catalogs. The icon's `aria-label` mirrors the translated
 * label text via the same `<Trans>`.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Clock, Home, LayoutDashboard } from "lucide-react";
import { cn } from "#/lib/utils";

interface NavTab {
	to: string;
	icon: LucideIcon;
	exact: boolean;
	label: React.ReactNode;
	ariaLabel: string;
}

export function BottomNav() {
	const { t } = useLingui();

	const tabs: NavTab[] = [
		{
			to: "/",
			icon: Home,
			exact: true,
			label: <Trans>Home</Trans>,
			ariaLabel: t`Home`,
		},
		{
			to: "/dashboard",
			icon: LayoutDashboard,
			exact: false,
			label: <Trans>Dashboard</Trans>,
			ariaLabel: t`Dashboard`,
		},
		{
			to: "/history",
			icon: Clock,
			exact: false,
			label: <Trans>History</Trans>,
			ariaLabel: t`History`,
		},
		{
			to: "/habits",
			icon: CalendarCheck,
			exact: false,
			label: <Trans>Habits</Trans>,
			ariaLabel: t`Habits`,
		},
	];

	return (
		<nav
			aria-label={t`Primary navigation`}
			// `pb-[env(safe-area-inset-bottom)]` lets the bar's background fill the
			// iOS home-indicator area while the tab items sit above it.
			className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
		>
			<ul className="mx-auto flex max-w-md items-stretch justify-around">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<li key={tab.to} className="flex-1">
							<Link
								to={tab.to}
								activeOptions={{ exact: tab.exact }}
								className="flex flex-col items-center gap-1 py-2 text-muted-foreground text-xs transition-colors data-[status=active]:text-foreground"
								aria-label={tab.ariaLabel}
							>
								{({ isActive }) => (
									<>
										<Icon
											className={cn("size-5", isActive && "text-foreground")}
											aria-hidden="true"
										/>
										<span>{tab.label}</span>
									</>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
