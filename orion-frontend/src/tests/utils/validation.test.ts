import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isStrongPassword,
  isValidUsername,
  isNotEmpty,
  isValidLength,
} from '@/utils/validation';

describe('validation utils', () => {
  describe('isValidEmail', () => {
    it('should validate email correctly', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate phone correctly', () => {
      expect(isValidPhone('13800138000')).toBe(true);
      expect(isValidPhone('19876543210')).toBe(true);
      expect(isValidPhone('12345678901')).toBe(false);
      expect(isValidPhone('01234567890')).toBe(false);
      expect(isValidPhone('123456789')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate URL correctly', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://example.com')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate password strength correctly', () => {
      expect(isStrongPassword('Password123')).toBe(true);
      expect(isStrongPassword('Abc12345')).toBe(true);
      expect(isStrongPassword('short1')).toBe(false);
      expect(isStrongPassword('allletters')).toBe(false);
      expect(isStrongPassword('12345678')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate username correctly', () => {
      expect(isValidUsername('admin')).toBe(true);
      expect(isValidUsername('user_123')).toBe(true);
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('thisisaverylongusername')).toBe(false);
      expect(isValidUsername('user@name')).toBe(false);
    });
  });

  describe('isNotEmpty', () => {
    it('should check if value is not empty', () => {
      expect(isNotEmpty('hello')).toBe(true);
      expect(isNotEmpty('  ')).toBe(false);
      expect(isNotEmpty([1, 2, 3])).toBe(true);
      expect(isNotEmpty([])).toBe(false);
      expect(isNotEmpty({ a: 1 })).toBe(true);
      expect(isNotEmpty({})).toBe(false);
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(undefined)).toBe(false);
      expect(isNotEmpty(0)).toBe(true);
    });
  });

  describe('isValidLength', () => {
    it('should validate string length correctly', () => {
      expect(isValidLength('hello', 1, 10)).toBe(true);
      expect(isValidLength('hi', 3, 10)).toBe(false);
      expect(isValidLength('very long string', 1, 5)).toBe(false);
      expect(isValidLength('  trimmed  ', 1, 15)).toBe(true);
    });
  });
});
