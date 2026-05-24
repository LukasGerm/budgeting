/**
 * BottomNav — the persistent tab bar for authenticated screens.
 *
 * Rendered once by the `_authed` layout so it appears on every authed page
 * (Home / History / Settings) without each route re-declaring it. It's a
 * `fixed bottom-0` bar; the layout pads its content with `pb-16` so nothing
 * hides behind it, and the FAB (in `SpendSheet`) sits above it.
 *
 * Active state comes from TanStack Router's `Link` — we read `isActive` from
 * its render-prop and colour the active tab `text-foreground` against the
 * muted rest. `activeOptions={{ exact: true }}` on Home keeps it from staying
 * lit on `/history` and `/settings` (every path is a prefix of `/`).
 */

import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Clock, Home, Settings } from "lucide-react";
import { cn } from "#/lib/utils";

interface NavTab {
	to: string;
	label: string;
	icon: LucideIcon;
	exact: boolean;
}

const TABS: readonly NavTab[] = [
	{ to: "/", label: "Home", icon: Home, exact: true },
	{ to: "/history", label: "History", icon: Clock, exact: false },
	{ to: "/settings", label: "Settings", icon: Settings, exact: false },
];

export function BottomNav() {
	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
		>
			<ul className="mx-auto flex max-w-md items-stretch justify-around">
				{TABS.map((tab) => {
					const Icon = tab.icon;
					return (
						<li key={tab.to} className="flex-1">
							<Link
								to={tab.to}
								activeOptions={{ exact: tab.exact }}
								className="flex flex-col items-center gap-1 py-2 text-muted-foreground text-xs transition-colors data-[status=active]:text-foreground"
								aria-label={tab.label}
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
