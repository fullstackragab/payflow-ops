/**
 * Currency formatting utilities.
 *
 * Production rationale:
 * - Always use Intl.NumberFormat for locale-aware formatting.
 * - Store amounts in minor units (cents) to avoid floating point errors.
 * - Support multiple currencies since payment systems are often multi-currency.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale = 'en-US'): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format minor units (cents) to display currency.
 * @param minorUnits - Amount in minor units (e.g., 1000 cents)
 * @param currency - ISO 4217 currency code (e.g., 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 */
export function formatCurrency(
  minorUnits: number,
  currency: string,
  locale = 'en-US'
): string {
  const majorUnits = minorUnits / 100;
  return getFormatter(currency, locale).format(majorUnits);
}

/**
 * Format currency without symbol (for tables/alignment).
 */
export function formatCurrencyValue(minorUnits: number): string {
  const majorUnits = minorUnits / 100;
  return majorUnits.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Get currency symbol.
 */
export function getCurrencySymbol(currency: string, locale = 'en-US'): string {
  return (0).toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).replace(/\d/g, '').trim();
}

/**
 * Parse display string back to minor units.
 * Use with caution - prefer keeping data in minor units throughout.
 */
export function parseCurrencyToMinorUnits(displayValue: string): number {
  const cleaned = displayValue.replace(/[^0-9.-]/g, '');
  const majorUnits = parseFloat(cleaned);
  if (isNaN(majorUnits)) return 0;
  return Math.round(majorUnits * 100);
}

/**
 * Format large numbers with abbreviations (K, M, B).
 * Used for dashboard KPIs.
 */
export function formatCompactCurrency(
  minorUnits: number,
  currency: string
): string {
  const majorUnits = minorUnits / 100;
  const symbol = getCurrencySymbol(currency);

  if (majorUnits >= 1_000_000_000) {
    return `${symbol}${(majorUnits / 1_000_000_000).toFixed(1)}B`;
  }
  if (majorUnits >= 1_000_000) {
    return `${symbol}${(majorUnits / 1_000_000).toFixed(1)}M`;
  }
  if (majorUnits >= 1_000) {
    return `${symbol}${(majorUnits / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(minorUnits, currency);
}
