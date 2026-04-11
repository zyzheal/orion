import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatDateTime,
  formatDate,
  formatPercent,
  formatNumber,
} from '@/utils/format';

describe('format utils', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });
  });

  describe('formatDateTime', () => {
    it('should format date time correctly', () => {
      const date = new Date('2024-01-15 10:30:45');
      expect(formatDateTime(date)).toBe('2024-01-15 10:30:45');
      expect(formatDateTime(date, 'YYYY-MM-DD')).toBe('2024-01-15');
      expect(formatDateTime(date, 'HH:mm:ss')).toBe('10:30:45');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('2024-01-15');
    });
  });

  describe('formatPercent', () => {
    it('should format percent correctly', () => {
      expect(formatPercent(0.75)).toBe('75.0%');
      expect(formatPercent(0.756, 2)).toBe('75.60%');
      expect(formatPercent(1)).toBe('100.0%');
    });
  });

  describe('formatNumber', () => {
    it('should format number with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(1234567890)).toBe('1,234,567,890');
    });
  });
});
