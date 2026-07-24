import { getPool } from "../utils/database";
import type {
  Skill,
  SkillVersion,
  SkillRating,
  CreateSkillInput,
  UpdateSkillInput,
  CreateVersionInput,
  RateSkillInput,
  SkillListParams,
  PaginatedResult,
} from "../types/skill";

function rowToSkill(row: Record<string, unknown>): Skill {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    author: row.author as string,
    repository_url: (row.repository_url as string) ?? null,
    documentation_url: (row.documentation_url as string) ?? null,
    icon_url: (row.icon_url as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    is_public: (row.is_public as boolean) ?? true,
    is_verified: (row.is_verified as boolean) ?? false,
    status: (row.status as "active" | "deprecated" | "archived") ?? "active",
    total_installs: (row.total_installs as number) ?? 0,
    average_rating: Number(row.average_rating ?? 0),
    rating_count: (row.rating_count as number) ?? 0,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function rowToVersion(row: Record<string, unknown>): SkillVersion {
  return {
    id: row.id as string,
    skill_id: row.skill_id as string,
    version: row.version as string,
    changelog: (row.changelog as string) ?? null,
    manifest: (row.manifest as Record<string, unknown>) ?? {},
    download_url: (row.download_url as string) ?? null,
    checksum: (row.checksum as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToRating(row: Record<string, unknown>): SkillRating {
  return {
    id: row.id as string,
    skill_id: row.skill_id as string,
    user_id: row.user_id as string,
    score: row.score as number,
    comment: (row.comment as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

export class SkillRepository {
  async list(params: SkillListParams): Promise<PaginatedResult<Skill>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;
    const sortField = params.sort ?? "created_at";
    const sortOrder = params.order ?? "desc";

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(params.category);
      paramIndex++;
    }
    if (params.author) {
      conditions.push(`author = $${paramIndex}`);
      values.push(params.author);
      paramIndex++;
    }
    if (params.is_public !== undefined) {
      conditions.push(`is_public = $${paramIndex}`);
      values.push(params.is_public);
      paramIndex++;
    }
    if (params.is_verified !== undefined) {
      conditions.push(`is_verified = $${paramIndex}`);
      values.push(params.is_verified);
      paramIndex++;
    }
    if (params.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }
    if (params.tags && params.tags.length > 0) {
      conditions.push(`tags && $${paramIndex}`);
      values.push(params.tags);
      paramIndex++;
    }
    if (params.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${params.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM skills ${whereClause}`;
    const countResult = await getPool().query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM skills ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataResult = await getPool().query(dataQuery, [...values, limit, offset]);

    return {
      data: dataResult.rows.map(rowToSkill),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Skill | null> {
    const result = await getPool().query("SELECT * FROM skills WHERE id = $1", [id]);
    return result.rows.length > 0 ? rowToSkill(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<Skill | null> {
    const result = await getPool().query("SELECT * FROM skills WHERE name = $1", [name]);
    return result.rows.length > 0 ? rowToSkill(result.rows[0]) : null;
  }

  async create(input: CreateSkillInput): Promise<Skill> {
    const query = `
      INSERT INTO skills (name, description, category, author, repository_url,
        documentation_url, icon_url, tags, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await getPool().query(query, [
      input.name,
      input.description,
      input.category,
      input.author,
      input.repository_url ?? null,
      input.documentation_url ?? null,
      input.icon_url ?? null,
      input.tags ?? [],
      input.is_public ?? true,
    ]);
    return rowToSkill(result.rows[0]);
  }

  async update(id: string, input: UpdateSkillInput): Promise<Skill | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      category: input.category,
      repository_url: input.repository_url,
      documentation_url: input.documentation_url,
      icon_url: input.icon_url,
      tags: input.tags,
      is_public: input.is_public,
      status: input.status,
    };

    for (const [field, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        if (field === "tags" && Array.isArray(value)) {
          fields.push(`${field} = $${paramIndex}::text[]`);
        } else {
          fields.push(`${field} = $${paramIndex}`);
        }
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE skills SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const result = await getPool().query(query, values);
    return result.rows.length > 0 ? rowToSkill(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await getPool().query("DELETE FROM skills WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementInstallCount(id: string): Promise<number> {
    const result = await getPool().query(
      "UPDATE skills SET total_installs = total_installs + 1 WHERE id = $1 RETURNING total_installs",
      [id],
    );
    return result.rows.length > 0 ? (result.rows[0].total_installs as number) : 0;
  }

  async decrementInstallCount(id: string): Promise<number> {
    const result = await getPool().query(
      "UPDATE skills SET total_installs = GREATEST(total_installs - 1, 0) WHERE id = $1 RETURNING total_installs",
      [id],
    );
    return result.rows.length > 0 ? (result.rows[0].total_installs as number) : 0;
  }

  async recordInstall(install: {
    skill_id: string;
    version?: string;
    installed_by?: string;
  }): Promise<Skill | null> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO skill_installs (skill_id, version, installed_by) VALUES ($1, $2, $3)",
        [install.skill_id, install.version ?? null, install.installed_by ?? null],
      );

      const updateResult = await client.query(
        "UPDATE skills SET total_installs = total_installs + 1 WHERE id = $1 RETURNING *",
        [install.skill_id],
      );

      await client.query("COMMIT");

      return updateResult.rows.length > 0 ? rowToSkill(updateResult.rows[0]) : null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async recordUninstall(uninstall: {
    skill_id: string;
    installed_by?: string;
  }): Promise<Skill | null> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "DELETE FROM skill_installs WHERE ctid = (SELECT ctid FROM skill_installs WHERE skill_id = $1 AND installed_by = $2 LIMIT 1)",
        [uninstall.skill_id, uninstall.installed_by ?? null],
      );

      const updateResult = await client.query(
        "UPDATE skills SET total_installs = GREATEST(total_installs - 1, 0) WHERE id = $1 RETURNING *",
        [uninstall.skill_id],
      );

      await client.query("COMMIT");

      return updateResult.rows.length > 0 ? rowToSkill(updateResult.rows[0]) : null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listVersions(skillId: string): Promise<PaginatedResult<SkillVersion>> {
    const result = await getPool().query(
      "SELECT * FROM skill_versions WHERE skill_id = $1 ORDER BY created_at DESC",
      [skillId],
    );
    return {
      data: result.rows.map(rowToVersion),
      total: result.rows.length,
      page: 1,
      limit: result.rows.length,
      total_pages: 1,
    };
  }

  async findVersionById(versionId: string): Promise<SkillVersion | null> {
    const result = await getPool().query("SELECT * FROM skill_versions WHERE id = $1", [versionId]);
    return result.rows.length > 0 ? rowToVersion(result.rows[0]) : null;
  }

  async createVersion(skillId: string, input: CreateVersionInput): Promise<SkillVersion> {
    const query = `
      INSERT INTO skill_versions (skill_id, version, changelog, manifest, download_url, checksum)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await getPool().query(query, [
      skillId,
      input.version,
      input.changelog ?? null,
      input.manifest ?? {},
      input.download_url ?? null,
      input.checksum ?? null,
    ]);
    return rowToVersion(result.rows[0]);
  }

  async addRating(skillId: string, input: RateSkillInput): Promise<SkillRating> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const upsertQuery = `
        INSERT INTO skill_ratings (skill_id, user_id, score, comment, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (skill_id, user_id)
        DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = NOW()
        RETURNING *
      `;
      const ratingResult = await client.query(upsertQuery, [
        skillId,
        input.user_id,
        input.score,
        input.comment ?? null,
      ]);

      const statsQuery = `
        UPDATE skills
        SET average_rating = COALESCE((SELECT AVG(score)::numeric(3,2) FROM skill_ratings WHERE skill_id = $1), 0),
            rating_count = (SELECT COUNT(*) FROM skill_ratings WHERE skill_id = $1)
        WHERE id = $1
      `;
      await client.query(statsQuery, [skillId]);

      await client.query("COMMIT");

      return rowToRating(ratingResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getRating(skillId: string, userId: string): Promise<SkillRating | null> {
    const result = await getPool().query(
      "SELECT * FROM skill_ratings WHERE skill_id = $1 AND user_id = $2",
      [skillId, userId],
    );
    return result.rows.length > 0 ? rowToRating(result.rows[0]) : null;
  }
}
