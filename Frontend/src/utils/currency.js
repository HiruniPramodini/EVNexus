/**
 * Currency localization and formatting utility for EVNexus.
 * Standardizes monetary amounts to Sri Lankan Rupees (LKR) with format:
 * 'LKR 1,250.00'
 */

export const DEFAULT_CURRENCY = 'LKR';

/**
 * Formats a numeric monetary value into consistent Sri Lankan Rupee display.
 * Example: formatLKR(1250) => "LKR 1,250.00"
 * Example: formatLKR(-45.5) => "-LKR 45.50"
 * 
 * @param {number|string} amount - The amount to format
 * @param {object} [options]
 * @param {boolean} [options.showSymbol=true] - Whether to prepend "LKR "
 * @param {number} [options.decimals=2] - Number of fraction digits
 * @returns {string}
 */
export function formatLKR(amount, options = {}) {
  const { showSymbol = true, decimals = 2 } = options;
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  
  if (isNaN(num)) {
    return showSymbol ? 'LKR 0.00' : '0.00';
  }

  const isNegative = num < 0;
  const absValue = Math.abs(num);
  const formattedNumber = absValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  if (!showSymbol) {
    return isNegative ? `-${formattedNumber}` : formattedNumber;
  }

  return isNegative ? `-LKR ${formattedNumber}` : `LKR ${formattedNumber}`;
}

/**
 * Formats a currency amount, defaulting and normalizing to LKR.
 * 
 * @param {number|string} amount 
 * @param {string} [currency='LKR'] 
 * @param {object} [options]
 * @returns {string}
 */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY, options = {}) {
  return formatLKR(amount, options);
}
