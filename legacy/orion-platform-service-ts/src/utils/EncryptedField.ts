/**
 * EncryptedField - Field-level encryption helper
 *
 * Wraps a named field with encrypt/decrypt/isEncrypted operations,
 * delegating to the underlying AES-256-GCM encryption utility.
 *
 * Usage:
 *   const emailField = new EncryptedField('email');
 *   const encrypted = emailField.encrypt('user@example.com');
 *   const decrypted = emailField.decrypt(encrypted);
 *   emailField.isEncrypted(encrypted); // true
 */

import { encryptValue, decryptValue, isEncrypted as checkIsEncrypted } from './encryption';

export class EncryptedField {
  readonly fieldName: string;
  readonly encryptionKey?: string;

  constructor(fieldName: string, encryptionKey?: string) {
    this.fieldName = fieldName;
    this.encryptionKey = encryptionKey;
  }

  /**
   * Encrypt a plain-text value.
   * Returns the original value unchanged if it is already encrypted or falsy.
   */
  encrypt(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    if (checkIsEncrypted(value)) {
      return value;
    }
    return encryptValue(value);
  }

  /**
   * Decrypt an encrypted value back to plain text.
   * Returns the original value unchanged if it is not encrypted or falsy.
   */
  decrypt(encryptedValue: string | null | undefined): string | null | undefined {
    if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
      return encryptedValue;
    }
    if (!checkIsEncrypted(encryptedValue)) {
      return encryptedValue;
    }
    return decryptValue(encryptedValue);
  }

  /**
   * Check whether a value is already in encrypted form.
   */
  isEncrypted(value: string | null | undefined): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    return checkIsEncrypted(value);
  }
}

export default EncryptedField;
