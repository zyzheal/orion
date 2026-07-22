import type { FastifyInstance } from "fastify";
import { SkillController } from "../controllers/SkillController";

export async function skillRoutes(fastify: FastifyInstance): Promise<void> {
  const controller = new SkillController();

  // GET /api/v1/skills - list/search skills
  fastify.get("/", async (request, reply) => {
    return controller.listSkills(request, reply);
  });

  // GET /api/v1/skills/health - health check
  fastify.get("/health", async (_request, reply) => {
    reply.send({
      success: true,
      data: { status: "ok", service: "orion-skill-svc" },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/skills - create skill
  fastify.post("/", {
    schema: {
      body: {
        type: "object",
        required: ["name", "description", "category", "author"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          description: { type: "string", minLength: 1 },
          category: { type: "string", minLength: 1, maxLength: 100 },
          author: { type: "string", minLength: 1, maxLength: 255 },
          repository_url: { type: "string", format: "uri" },
          documentation_url: { type: "string", format: "uri" },
          icon_url: { type: "string", format: "uri" },
          tags: { type: "array", items: { type: "string" } },
          is_public: { type: "boolean" },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.createSkill(request, reply);
    },
  });

  // GET /api/v1/skills/:id - skill detail
  fastify.get("/:id", async (request, reply) => {
    return controller.getSkill(request, reply);
  });

  // PUT /api/v1/skills/:id - update skill
  fastify.put("/:id", {
    schema: {
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          description: { type: "string", minLength: 1 },
          category: { type: "string", minLength: 1, maxLength: 100 },
          repository_url: { type: "string", format: "uri" },
          documentation_url: { type: "string", format: "uri" },
          icon_url: { type: "string", format: "uri" },
          tags: { type: "array", items: { type: "string" } },
          is_public: { type: "boolean" },
          status: { type: "string", enum: ["active", "deprecated", "archived"] },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.updateSkill(request, reply);
    },
  });

  // DELETE /api/v1/skills/:id - delete skill
  fastify.delete("/:id", async (request, reply) => {
    return controller.deleteSkill(request, reply);
  });

  // GET /api/v1/skills/:id/versions - list versions
  fastify.get("/:id/versions", async (request, reply) => {
    return controller.listVersions(request, reply);
  });

  // POST /api/v1/skills/:id/versions - add version
  fastify.post("/:id/versions", {
    schema: {
      body: {
        type: "object",
        required: ["version"],
        properties: {
          version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
          changelog: { type: "string" },
          manifest: { type: "object" },
          download_url: { type: "string", format: "uri" },
          checksum: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.createVersion(request, reply);
    },
  });

  // POST /api/v1/skills/:id/install - increment install count
  fastify.post("/:id/install", {
    schema: {
      body: {
        type: "object",
        properties: {
          installed_by: { type: "string" },
          version: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.installSkill(request, reply);
    },
  });

  // POST /api/v1/skills/:id/uninstall - decrement install count
  fastify.post("/:id/uninstall", {
    schema: {
      body: {
        type: "object",
        properties: {
          installed_by: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.uninstallSkill(request, reply);
    },
  });

  // POST /api/v1/skills/:id/rate - add rating
  fastify.post("/:id/rate", {
    schema: {
      body: {
        type: "object",
        required: ["user_id", "score"],
        properties: {
          user_id: { type: "string" },
          score: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      return controller.rateSkill(request, reply);
    },
  });
}
