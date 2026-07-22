export const authenticateUser = async (req: any, reply: any) => {
  const auth = req.headers.authorization;
  if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenant_id: 'tenant-1' };
};
