/**
 * RestTimerBar — fixed bottom countdown shown after checking off a set
 * (PRD locked decision 6: pure client state, no persistence).
 *
 * Self-contained: the parent mounts it with `key={nonce}` so checking
 * another set remounts it and the countdown restarts. Internal state is one
 * object (endsAt + total for the progress denominator); the 250 ms interval
 * is the legitimate `useEffect` timer case. Hitting zero (or Skip) calls
 * `onClose`, which unmounts the bar.
 */

import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import { formatDuration } from "#/domain";

interface RestTimerBarProps {
	/** Initial countdown length in seconds (> 0). */
	totalSeconds: number;
	/** Called when the countdown ends or the user skips. */
	onClose: () => void;
}

export function RestTimerBar({ totalSeconds, onClose }: RestTimerBarProps) {
	// One state object: the absolute end timestamp plus the (extendable)
	// total used as the progress denominator.
	const [timer, setTimer] = useState(() => ({
		endsAt: Date.now() + totalSeconds * 1000,
		total: totalSeconds,
	}));
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(id);
	}, []);

	const remainingMs = timer.endsAt - now;
	const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
	const done = remainingMs <= 0;

	// Auto-dismiss on zero. Effect (not render-time call): closing mutates the
	// parent's state, which React forbids during another component's render.
	useEffect(() => {
		if (done) onClose();
	}, [done, onClose]);

	return (
		<div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="text-muted-foreground text-xs">
							<Trans>Rest</Trans>
						</span>
						<span className="font-medium font-mono text-lg tabular-nums">
							{formatDuration(remainingSeconds)}
						</span>
					</div>
					<Button
						variant="outline"
						className="h-11"
						onClick={() =>
							setTimer((prev) => ({
								endsAt: prev.endsAt + 30_000,
								total: prev.total + 30,
							}))
						}
					>
						+30s
					</Button>
					<Button variant="ghost" className="h-11" onClick={onClose}>
						<Trans>Skip</Trans>
					</Button>
				</div>
				<Progress
					value={Math.min(
						100,
						Math.max(0, (remainingMs / (timer.total * 1000)) * 100),
					)}
				/>
			</div>
		</div>
	);
}
