import { QueryBuilder } from '../query-builder';

describe('QueryBuilder', () => {
  test('should build SELECT query with where clause', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.select().where({ status: 'active', role: 'admin' }).build();

    expect(sql).toContain('SELECT * FROM users');
    expect(sql).toContain('WHERE status = $1');
    expect(sql).toContain('AND role = $2');
    expect(params).toEqual(['active', 'admin']);
  });

  test('should build SELECT query with ordering and pagination', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.select()
      .orderBy('created_at', 'DESC')
      .limit(10)
      .offset(20)
      .build();

    expect(sql).toContain('ORDER BY created_at DESC');
    expect(sql).toContain('LIMIT $');
    expect(sql).toContain('OFFSET $');
  });

  test('should build INSERT query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.insert({ name: 'John', email: 'john@test.com' }).build();

    expect(sql).toContain('INSERT INTO users');
    expect(sql).toContain('(name, email)');
    expect(sql).toContain('VALUES ($1, $2)');
    expect(params).toEqual(['John', 'john@test.com']);
  });

  test('should build UPDATE query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.update({ name: 'Jane' }).where({ id: '1' }).build();

    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('SET name = $1');
    expect(sql).toContain('WHERE id = $');
    expect(params).toEqual(['Jane', '1']);
  });

  test('should build DELETE query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.delete().where({ id: '1' }).build();

    expect(sql).toContain('DELETE FROM users');
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual(['1']);
  });

  test('should prevent SQL injection in table name', () => {
    expect(() => new QueryBuilder('users; DROP TABLE users;')).toThrow();
  });

  test('should build COUNT query', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.count().where({ status: 'active' }).build();

    expect(sql).toContain('SELECT COUNT(*) as count FROM users');
    expect(sql).toContain('WHERE status = $1');
    expect(params).toEqual(['active']);
  });

  test('should support returning clause for INSERT', () => {
    const qb = new QueryBuilder('users');
    const { sql, params } = qb.insert({ name: 'John' }).returning('*').build();

    expect(sql).toContain('RETURNING *');
  });
});
