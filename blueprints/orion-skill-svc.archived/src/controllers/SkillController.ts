import type { FastifyReply, FastifyRequest } from "fastify";
import { SkillService } from "../services/SkillService";
import type {
  CreateSkillInput,
  UpdateSkillInput,
  CreateVersionInput,
  RateSkillInput,
  SkillListParams,
} from "../types/skill";

export class SkillController {
  private service: SkillService;

  constructor() {
    this.service = new SkillService();
  }

  async listSkills(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, unknown>;

    const params: SkillListParams = {
      category: typeof query.category === "string" ? query.category : undefined,
      author: typeof query.author === "string" ? query.author : undefined,
      is_public: query.is_public === "true" ? true : query.is_public === "false" ? false : undefined,
      is_verified:
        query.is_verified === "true" ? true : query.is_verified === "false" ? false : undefined,
      status: typeof query.status === "string" ? query.status : undefined,
      search: typeof query.search === "string" ? query.search : undefined,
      sort: typeof query.sort === "string" ? (query.sort as SkillListParams["sort"]) : undefined,
      order: typeof query.order === "string" ? (query.order as SkillListParams["order"]) : undefined,
      page: typeof query.page === "string" ? parseInt(query.page, 10) : undefined,
      limit: typeof query.limit === "string" ? parseInt(query.limit, 10) : undefined,
    };

    if (typeof query.tags === "string") {
      params.tags = query.tags.split(",").map((t) => t.trim());
    }

    const result = await this.service.listSkills(params);
    reply.send({
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          total_pages: result.total_pages,
        },
      },
    });
  }

  async getSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const skill = await this.service.getSkillById(id);
    reply.send({
      success: true,
      data: skill,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async createSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as CreateSkillInput;
    const skill = await this.service.createSkill(body);
    reply.code(201).send({
      success: true,
      data: skill,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async updateSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateSkillInput;
    const skill = await this.service.updateSkill(id, body);
    reply.send({
      success: true,
      data: skill,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async deleteSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    await this.service.deleteSkill(id);
    reply.code(204).send();
  }

  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const versions = await this.service.listVersions(id);
    reply.send({
      success: true,
      data: versions.data,
      meta: {
        timestamp: new Date().toISOString(),
        total: versions.total,
      },
    });
  }

  async createVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as CreateVersionInput;
    const version = await this.service.createVersion(id, body);
    reply.code(201).send({
      success: true,
      data: version,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async installSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string> | undefined;
    const installedBy = body?.installed_by;
    const version = body?.version;
    const skill = await this.service.installSkill(id, installedBy, version);
    reply.send({
      success: true,
      data: skill,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async uninstallSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string> | undefined;
    const installedBy = body?.installed_by;
    const skill = await this.service.uninstallSkill(id, installedBy);
    reply.send({
      success: true,
      data: skill,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  async rateSkill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as RateSkillInput;
    const rating = await this.service.rateSkill(id, body);
    reply.code(201).send({
      success: true,
      data: rating,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
