const DEFAULT_CURRENCY = 'KES';

export function formatMoney(amountInMinorUnits: number, currency = DEFAULT_CURRENCY) {
  const normalizedCurrency = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountInMinorUnits / 100);
  } catch {
    return `${normalizedCurrency} ${(amountInMinorUnits / 100).toFixed(2)}`;
  }
}
