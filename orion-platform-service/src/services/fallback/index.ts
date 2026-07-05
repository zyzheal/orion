/**
 * @module fallback
 * Unified FallbackStorageService + PostgreSQL repository
 *
 * Usage:
 *   import { FallbackStorageService, FallbackStorageRepository } from '@/services/fallback';
 */

export { FallbackStorageService, type FallbackStorageOptions } from './FallbackStorageService';
export { FallbackStorageRepository, type FallbackStorageRow } from '../../repositories/FallbackStorageRepository';
