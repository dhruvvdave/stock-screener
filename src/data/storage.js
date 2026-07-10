// The app went through a couple of names before landing on Markr, and
// localStorage keys from those eras ("tickerly_", "mktscan_") are still out
// in the wild. Move any legacy values over once, then clean up.
const LEGACY_KEYS = {
  tickerly_stocks:       "markr_stocks",
  tickerly_watchlist:    "markr_watchlist",
  tickerly_price_alerts: "markr_price_alerts",
  tickerly_portfolio:    "markr_portfolio",
  tickerly_currency:     "markr_currency",
  mktscan_openai_key:    "markr_openai_key",
};

export function migrateLegacyStorageKeys() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage unavailable (private mode, disabled) — nothing to migrate
  }
}
