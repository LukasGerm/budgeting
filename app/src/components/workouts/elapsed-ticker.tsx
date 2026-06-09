/**
 * ElapsedTicker — live "time since startedAt" readout (m:ss / h:mm:ss).
 *
 * Deliberately a tiny leaf component: the 1 s interval only re-renders this
 * span, not the whole live-workout screen. The interval is a legitimate
 * `useEffect` (external timer system) with a clear cleanup.
 *
 * `suppressHydrationWarning` because the server-rendered second count is a
 * beat older than the client's first render — the text reconciles on the
 * first tick.
 */

import { useEffect, useState } from "react";
import { formatDuration } from "#/domain";

export function ElapsedTicker({ startedAt }: { startedAt: Date }) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const elapsedSeconds = Math.floor((now - startedAt.getTime()) / 1000);
	return <span suppressHydrationWarning>{formatDuration(elapsedSeconds)}</span>;
}
