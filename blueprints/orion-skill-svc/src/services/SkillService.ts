import { SkillRepository } from "./SkillRepository";
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

export class SkillService {
  private repository: SkillRepository;

  constructor() {
    this.repository = new SkillRepository();
  }

  async listSkills(params: SkillListParams): Promise<PaginatedResult<Skill>> {
    return this.repository.list(params);
  }

  async getSkillById(id: string): Promise<Skill> {
    const skill = await this.repository.findById(id);
    if (!skill) {
      throw new Error(`Skill with id ${id} not found`);
    }
    return skill;
  }

  async createSkill(input: CreateSkillInput): Promise<Skill> {
    const existing = await this.repository.findByName(input.name);
    if (existing) {
      throw new Error(`Skill with name '${input.name}' already exists`);
    }
    return this.repository.create(input);
  }

  async updateSkill(id: string, input: UpdateSkillInput): Promise<Skill> {
    const skill = await this.repository.findById(id);
    if (!skill) {
      throw new Error(`Skill with id ${id} not found`);
    }

    if (input.name && input.name !== skill.name) {
      const existing = await this.repository.findByName(input.name);
      if (existing) {
        throw new Error(`Skill with name '${input.name}' already exists`);
      }
    }

    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new Error(`Failed to update skill with id ${id}`);
    }
    return updated;
  }

  async deleteSkill(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error(`Skill with id ${id} not found`);
    }
  }

  async listVersions(skillId: string): Promise<PaginatedResult<SkillVersion>> {
    await this.getSkillById(skillId);
    return this.repository.listVersions(skillId);
  }

  async createVersion(skillId: string, input: CreateVersionInput): Promise<SkillVersion> {
    await this.getSkillById(skillId);

    const versions = await this.repository.listVersions(skillId);
    const exists = versions.data.find((v) => v.version === input.version);
    if (exists) {
      throw new Error(`Version ${input.version} already exists for this skill`);
    }

    return this.repository.createVersion(skillId, input);
  }

  async installSkill(skillId: string, installedBy?: string, version?: string): Promise<Skill> {
    const skill = await this.getSkillById(skillId);
    const updated = await this.repository.recordInstall({
      skill_id: skillId,
      version,
      installed_by: installedBy,
    });
    if (!updated) {
      throw new Error(`Failed to record install for skill ${skillId}`);
    }
    return updated;
  }

  async uninstallSkill(skillId: string, installedBy?: string): Promise<Skill> {
    const skill = await this.getSkillById(skillId);
    const updated = await this.repository.recordUninstall({
      skill_id: skillId,
      installed_by: installedBy,
    });
    if (!updated) {
      throw new Error(`Failed to record uninstall for skill ${skillId}`);
    }
    return updated;
  }

  async rateSkill(skillId: string, input: RateSkillInput): Promise<SkillRating> {
    await this.getSkillById(skillId);

    if (input.score < 1 || input.score > 5) {
      throw new Error("Rating score must be between 1 and 5");
    }

    return this.repository.addRating(skillId, input);
  }

  async getRating(skillId: string, userId: string): Promise<SkillRating | null> {
    return this.repository.getRating(skillId, userId);
  }
}
