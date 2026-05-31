/**
 * Locale context — carries `{ locale, currency, setPreferences }` through the
 * React tree.
 *
 * Separate from the Lingui I18nProvider so format functions can read locale
 * and currency independently (locale drives string translation; currency drives
 * money display).
 *
 * Issue 02 adds `setPreferences` so components can trigger an instant switch
 * without a navigation. The provider holds client state seeded from the server-
 * resolved props so SSR and the first client render are identical.
 */

import { createContext, useContext } from "react";
import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";

export interface LocaleContextValue {
	locale: SupportedLocale;
	currency: SupportedCurrency;
	/**
	 * Instantly switch locale and/or currency.
	 *
	 * - Updates client state → re-renders all `<Trans>` + `useFormat()` consumers.
	 * - Sets `document.documentElement.lang` (the shell `<html lang>` attribute
	 *   lives outside the React tree and must be updated imperatively).
	 * - Fires the `user.setPreferences` tRPC mutation in the background so the
	 *   choice is persisted to the DB and the SSR cookies are kept in sync.
	 */
	setPreferences: (next: {
		locale?: SupportedLocale;
		currency?: SupportedCurrency;
	}) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({
	locale: "en",
	currency: "EUR",
	// Safe no-op default — the real setter is provided by I18nSetupProvider.
	setPreferences: () => {},
});

export function useLocaleContext(): LocaleContextValue {
	return useContext(LocaleContext);
}
