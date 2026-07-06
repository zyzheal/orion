/**
 * @module fallback
 * Unified FallbackStorageService + PostgreSQL repository
 *
 * Usage:
 *   import { FallbackStorageService, FallbackStorageRepository } from '@/services/fallback';
 */

export { SimpleFallbackStorage, type FallbackStorageOptions } from './FallbackStorageService';
export { FallbackStorageRepository, type FallbackStorageRow } from '../../repositories/FallbackStorageRepository';
