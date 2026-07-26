/**
 * MonitoringRepository stub.
 */

import { DatabasePool } from '../database';

export class MonitoringRepository {
  constructor(readonly pool: DatabasePool) {}

  async findAll(): Promise<unknown[]> { return []; }
  async findById(_id: string): Promise<unknown | null> { return null; }
  async create(data: unknown): Promise<unknown> { return data; }
  async update(id: string, data: unknown): Promise<unknown | null> { return { id, ...(data as object) }; }
  async delete(_id: string): Promise<boolean> { return true; }
}
