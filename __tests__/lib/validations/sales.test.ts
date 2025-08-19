import { 
  validateSalesForm, 
  validateField, 
  formatDate, 
  getTodayString,
  formatCurrency,
  parseCurrency 
} from '@/lib/validations/sales';
import { SalesInputForm } from '@/types/database.types';

describe('Sales Validation', () => {
  describe('validateSalesForm', () => {
    const validFormData: SalesInputForm = {
      date: '2025-08-19',
      store_id: 'store-1',
      department: 'electronics',
      product_category: 'premium',
      revenue_ex_tax: 100000,
      footfall: 100,
      transactions: 50,
      discounts: 5000,
      notes: 'Test notes',
    };

    it('should pass validation for valid data', () => {
      const errors = validateSalesForm(validFormData);
      expect(errors).toHaveLength(0);
    });

    it('should require date field', () => {
      const data = { ...validFormData, date: '' };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'date',
          code: 'REQUIRED',
        })
      );
    });

    it('should validate date format', () => {
      const data = { ...validFormData, date: '2025/08/19' };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'date',
          code: 'INVALID_FORMAT',
        })
      );
    });

    it('should reject future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const data = { ...validFormData, date: formatDate(futureDate) };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'date',
          code: 'FUTURE_DATE',
        })
      );
    });

    it('should require store_id field', () => {
      const data = { ...validFormData, store_id: '' };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'store_id',
          code: 'REQUIRED',
        })
      );
    });

    it('should require department field', () => {
      const data = { ...validFormData, department: '' };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'department',
          code: 'REQUIRED',
        })
      );
    });

    it('should require product_category field', () => {
      const data = { ...validFormData, product_category: '' };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'product_category',
          code: 'REQUIRED',
        })
      );
    });

    it('should require revenue_ex_tax field', () => {
      const data = { ...validFormData };
      delete (data as any).revenue_ex_tax;
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'revenue_ex_tax',
          code: 'REQUIRED',
        })
      );
    });

    it('should validate negative revenue', () => {
      const data = { ...validFormData, revenue_ex_tax: -1000 };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'revenue_ex_tax',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should validate maximum revenue', () => {
      const data = { ...validFormData, revenue_ex_tax: 2000000000 };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'revenue_ex_tax',
          code: 'MAX_VALUE',
        })
      );
    });

    it('should validate negative footfall', () => {
      const data = { ...validFormData, footfall: -10 };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'footfall',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should validate transactions vs footfall consistency', () => {
      const data = { ...validFormData, footfall: 50, transactions: 100 };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'transactions',
          code: 'INCONSISTENT_DATA',
        })
      );
    });

    it('should validate discounts vs revenue consistency', () => {
      const data = { ...validFormData, revenue_ex_tax: 50000, discounts: 60000 };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'discounts',
          code: 'INCONSISTENT_DATA',
        })
      );
    });

    it('should validate notes length', () => {
      const longNotes = 'a'.repeat(1001);
      const data = { ...validFormData, notes: longNotes };
      const errors = validateSalesForm(data);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'notes',
          code: 'MAX_LENGTH',
        })
      );
    });

    it('should allow optional fields to be undefined', () => {
      const data = {
        date: '2025-08-19',
        store_id: 'store-1',
        department: 'electronics',
        product_category: 'premium',
        revenue_ex_tax: 100000,
      };
      const errors = validateSalesForm(data);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateField', () => {
    it('should validate single field', () => {
      const error = validateField('date', '');
      expect(error).toEqual(
        expect.objectContaining({
          field: 'date',
          code: 'REQUIRED',
        })
      );
    });

    it('should return null for valid field', () => {
      const error = validateField('date', '2025-08-19');
      expect(error).toBeNull();
    });
  });

  describe('Utility functions', () => {
    describe('formatDate', () => {
      it('should format date correctly', () => {
        const date = new Date('2025-08-19T10:00:00Z');
        expect(formatDate(date)).toBe('2025-08-19');
      });
    });

    describe('getTodayString', () => {
      it('should return today in YYYY-MM-DD format', () => {
        const today = getTodayString();
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('formatCurrency', () => {
      it('should format currency in Japanese yen', () => {
        expect(formatCurrency(100000)).toBe('￥100,000');
      });

      it('should handle zero', () => {
        expect(formatCurrency(0)).toBe('￥0');
      });

      it('should handle decimal values', () => {
        expect(formatCurrency(123.45)).toBe('￥123');
      });
    });

    describe('parseCurrency', () => {
      it('should parse currency string', () => {
        expect(parseCurrency('100,000')).toBe(100000);
      });

      it('should handle yen symbol', () => {
        expect(parseCurrency('￥100,000')).toBe(100000);
        expect(parseCurrency('円100,000')).toBe(100000);
      });

      it('should handle decimal values', () => {
        expect(parseCurrency('123.45')).toBe(123.45);
      });

      it('should handle invalid input', () => {
        expect(parseCurrency('abc')).toBe(0);
        expect(parseCurrency('')).toBe(0);
      });
    });
  });
});