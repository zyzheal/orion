import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RegisterServiceInput, UpdateServiceInput } from '../types/core.js';
import * as SD from '../services/ServiceDiscoveryService.js';

export async function serviceDiscoveryRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RegisterServiceInput }>('/services/register', {
    schema: {
      description: 'Register or update a service',
      tags: ['service-discovery'],
      body: {
        type: 'object',
        properties: {
          serviceName: { type: 'string' },
          serviceUrl: { type: 'string', format: 'uri' },
          version: { type: 'string' },
          healthUrl: { type: 'string', format: 'uri' },
          metadata: { type: 'object' },
        },
        required: ['serviceName', 'serviceUrl'],
      },
    },
    handler: async (request: FastifyRequest<{ Body: RegisterServiceInput }>, reply) => {
      const service = await SD.registerService(request.body);
      return reply.code(201).send({ success: true, data: service });
    },
  });

  fastify.delete<{ Params: { serviceName: string } }>('/services/:serviceName', {
    schema: {
      description: 'Deregister a service',
      tags: ['service-discovery'],
    },
    handler: async (request: FastifyRequest<{ Params: { serviceName: string } }>, reply) => {
      const result = await SD.deregisterService(request.params.serviceName);
      if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return reply.send({ success: true, data: { message: 'Service deregistered' } });
    },
  });

  fastify.get<{ Params: { serviceName: string } }>('/services/:serviceName', {
    schema: {
      description: 'Get service details',
      tags: ['service-discovery'],
    },
    handler: async (request: FastifyRequest<{ Params: { serviceName: string } }>, reply) => {
      const service = await SD.getService(request.params.serviceName);
      if (!service) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return reply.send({ success: true, data: service });
    },
  });

  fastify.get<{ Querystring: { status?: string } }>('/services', {
    schema: {
      description: 'List all registered services',
      tags: ['service-discovery'],
    },
    handler: async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply) => {
      const services = await SD.listServices(request.query.status);
      return reply.send({ success: true, data: services });
    },
  });

  fastify.post<{ Params: { serviceName: string } }>('/services/:serviceName/heartbeat', {
    schema: {
      description: 'Update service heartbeat',
      tags: ['service-discovery'],
    },
    handler: async (request: FastifyRequest<{ Params: { serviceName: string } }>, reply) => {
      const result = await SD.updateServiceHeartbeat(request.params.serviceName);
      if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return reply.send({ success: true, data: { message: 'Heartbeat updated' } });
    },
  });

  fastify.get<{ Params: { serviceName: string } }>('/services/:serviceName/discover', {
    schema: {
      description: 'Discover service URL',
      tags: ['service-discovery'],
    },
    handler: async (request: FastifyRequest<{ Params: { serviceName: string } }>, reply) => {
      const discovered = await SD.discoverService(request.params.serviceName);
      if (!discovered) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found or inactive' } });
      return reply.send({ success: true, data: discovered });
    },
  });
}
