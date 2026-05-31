/**
 * Test utilities for components that consume Lingui translations and LocaleContext.
 *
 * Usage:
 *
 *   renderWithI18n("en", "EUR", <MyComponent />)
 *
 * This wraps the element in both `I18nProvider` (with the compiled en/de catalog
 * activated for the given locale) and `LocaleContext.Provider`, matching the
 * production setup in `src/i18n/provider.tsx`.
 *
 * Pattern: import `render` from here instead of from `@testing-library/react`
 * for any component test that uses `<Trans>`, `useLingui()`, or `useFormat()`.
 */

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";
import { LocaleContext } from "#/i18n/locale-context";
import { messages as deMessages } from "#/locales/de/messages";
import { messages as enMessages } from "#/locales/en/messages";

const CATALOGS = { en: enMessages, de: deMessages } as const;

function buildI18n(locale: SupportedLocale) {
	const i18n = setupI18n();
	i18n.load(CATALOGS);
	i18n.activate(locale);
	return i18n;
}

/**
 * Render `node` wrapped in both Lingui `I18nProvider` (with the correct catalog
 * activated) and `LocaleContext.Provider`.
 */
export function renderWithI18n(
	locale: SupportedLocale,
	currency: SupportedCurrency,
	node: ReactElement,
) {
	const i18n = buildI18n(locale);
	return render(
		<I18nProvider i18n={i18n}>
			<LocaleContext.Provider
				value={{ locale, currency, setPreferences: () => {} }}
			>
				{node}
			</LocaleContext.Provider>
		</I18nProvider>,
	);
}
