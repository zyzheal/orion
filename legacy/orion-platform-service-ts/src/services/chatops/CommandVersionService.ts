/**
 * Command Version Service
 *
 * Manages ChatOps command version history, rollback, and tagging
 */

import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';

export interface CommandVersion {
  id: string;
  command_id: string;
  version: number;
  command_text: string;
  parameters: Record<string, unknown>;
  description: string;
  changelog: string;
  created_by: string;
  created_at: Date;
  is_current: boolean;
  tags?: string[];
}

export interface CreateCommandVersionInput {
  command_id: string;
  command_text: string;
  parameters?: Record<string, unknown>;
  description?: string;
  changelog?: string;
  created_by?: string;
}

export class CommandVersionService {
  constructor(private pool: DatabasePool) {}

  async getVersionsByCommand(commandId: string): Promise<CommandVersion[]> {
    const versions = await this.pool.query(
      `SELECT * FROM chatops_command_versions
       WHERE command_id = $1
       ORDER BY version DESC`,
      [commandId]
    );

    const results: CommandVersion[] = [];
    for (const v of versions.rows) {
      const tags = await this.pool.query(
        'SELECT tag_name FROM chatops_command_tags WHERE command_version_id = $1',
        [v.id]
      );
      results.push({
        ...v,
        tags: tags.rows.map((r: any) => r.tag_name),
      });
    }
    return results;
  }

  async getAllVersions(page = 1, perPage = 20): Promise<{ versions: CommandVersion[]; total: number }> {
    const offset = (page - 1) * perPage;

    const totalResult = await this.pool.query('SELECT COUNT(*) FROM chatops_command_versions');
    const total = parseInt(totalResult.rows[0].count, 10);

    const versions = await this.pool.query(
      `SELECT cv.*,
              COALESCE(ARRAY_AGG(DISTINCT ct.tag_name) FILTER (WHERE ct.tag_name IS NOT NULL), ARRAY[]::text[]) as tags
       FROM chatops_command_versions cv
       LEFT JOIN chatops_command_tags ct ON cv.id = ct.command_version_id
       GROUP BY cv.id
       ORDER BY cv.created_at DESC
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    );

    return { versions: versions.rows, total };
  }

  async createVersion(input: CreateCommandVersionInput): Promise<CommandVersion> {
    const id = uuidv4();
    const now = new Date();

    // Get next version number
    const maxResult = await this.pool.query(
      'SELECT COALESCE(MAX(version), 0) as max_ver FROM chatops_command_versions WHERE command_id = $1',
      [input.command_id]
    );
    const nextVersion = (maxResult.rows[0]?.max_ver || 0) + 1;

    // Mark previous current as not current
    await this.pool.query(
      `UPDATE chatops_command_versions SET is_current = false WHERE command_id = $1 AND is_current = true`,
      [input.command_id]
    );

    await this.pool.query(
      `INSERT INTO chatops_command_versions
       (id, command_id, version, command_text, parameters, description, changelog, created_by, created_at, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [id, input.command_id, nextVersion, input.command_text,
       input.parameters ? JSON.stringify(input.parameters) : null,
       input.description || '', input.changelog || '',
       input.created_by || 'system', now]
    );

    return {
      id,
      command_id: input.command_id,
      version: nextVersion,
      command_text: input.command_text,
      parameters: input.parameters || {},
      description: input.description || '',
      changelog: input.changelog || '',
      created_by: input.created_by || 'system',
      created_at: now,
      is_current: true,
      tags: [],
    };
  }

  async rollbackToVersion(commandId: string, version: number): Promise<CommandVersion | null> {
    const target = await this.pool.query(
      'SELECT * FROM chatops_command_versions WHERE command_id = $1 AND version = $2',
      [commandId, version]
    );

    if (!target.rows[0]) return null;

    const oldVersion = target.rows[0];

    // Create a new version with the old command text
    const newVersion = await this.createVersion({
      command_id: commandId,
      command_text: oldVersion.command_text,
      parameters: oldVersion.parameters,
      description: `Rollback to v${version}`,
      changelog: `Rolled back from v${version}`,
    });

    return newVersion;
  }

  async addTag(versionId: string, tagName: string, createdBy?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO chatops_command_tags (id, command_version_id, tag_name, created_by)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), versionId, tagName, createdBy || 'system']
    );
  }

  async removeTag(versionId: string, tagName: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM chatops_command_tags WHERE command_version_id = $1 AND tag_name = $2',
      [versionId, tagName]
    );
  }

  async deleteVersion(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM chatops_command_versions WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
