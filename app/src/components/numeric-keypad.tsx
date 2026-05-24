/**
 * NumericKeypad — a custom on-screen keypad for entering an amount.
 *
 * Deliberately not the OS keyboard (PRODUCT.md): we only need digits, a
 * single decimal point and backspace, and the OS keyboard fights us with
 * autocorrect and a buried decimal key. This component is pure UI — it owns
 * no amount state; it reports key presses to its parent, which holds the
 * amount string and decides what is valid.
 *
 * Keys are shadcn `Button`s (per project convention: no hand-rolled
 * controls). The grid is thumb-sized and full-width so it sits at the bottom
 * of the spend sheet.
 */

import { Delete } from "lucide-react";
import { Button } from "#/components/ui/button";

export type KeypadKey =
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "."
	| "backspace";

const DIGIT_KEYS: KeypadKey[] = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
];

export function NumericKeypad({
	onKey,
}: {
	onKey: (key: KeypadKey) => void;
}) {
	return (
		<div className="grid grid-cols-3 gap-2">
			{DIGIT_KEYS.map((key) => (
				<Button
					key={key}
					type="button"
					variant="ghost"
					className="h-14 font-medium text-2xl"
					onClick={() => onKey(key)}
				>
					{key}
				</Button>
			))}
			<Button
				type="button"
				variant="ghost"
				className="h-14 font-medium text-2xl"
				onClick={() => onKey(".")}
				aria-label="Decimal point"
			>
				.
			</Button>
			<Button
				type="button"
				variant="ghost"
				className="h-14 font-medium text-2xl"
				onClick={() => onKey("0")}
			>
				0
			</Button>
			<Button
				type="button"
				variant="ghost"
				className="h-14"
				onClick={() => onKey("backspace")}
				aria-label="Backspace"
			>
				<Delete className="size-6" />
			</Button>
		</div>
	);
}
