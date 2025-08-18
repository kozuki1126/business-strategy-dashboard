import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  calculatePercentageChange,
  isValidEmail,
  safeJsonParse,
} from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format currency in JPY', () => {
      expect(formatCurrency(1000)).toBe('￥1,000');
      expect(formatCurrency(1234567)).toBe('￥1,234,567');
    });

    it('should handle zero and negative values', () => {
      expect(formatCurrency(0)).toBe('￥0');
      expect(formatCurrency(-1000)).toBe('-￥1,000');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with default decimals', () => {
      expect(formatPercentage(5.123)).toBe('5.1%');
    });

    it('should format percentage with custom decimals', () => {
      expect(formatPercentage(5.123, 2)).toBe('5.12%');
      expect(formatPercentage(5.123, 0)).toBe('5%');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate positive percentage change', () => {
      expect(calculatePercentageChange(110, 100)).toBe(10);
    });

    it('should calculate negative percentage change', () => {
      expect(calculatePercentageChange(90, 100)).toBe(-10);
    });

    it('should handle zero previous value', () => {
      expect(calculatePercentageChange(100, 0)).toBe(0);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.jp')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const obj = { test: 'value' };
      expect(safeJsonParse(JSON.stringify(obj), {})).toEqual(obj);
    });

    it('should return fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid json', { fallback: true })).toEqual({ fallback: true });
    });
  });
});