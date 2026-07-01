/**
 * Mock DatabasePool for cross-domain orchestration tests.
 * Uses typed Maps keyed by table name + primary key for reliable lookups.
 */

type TableRow = Record<string, any>;

function createMockPool() {
  const tables = new Map<string, TableRow[]>();
  const get = (name: string) => tables.get(name) || [];
  const set = (name: string, data: TableRow[]) => tables.set(name, data);

  // Helper: parse SQL columns/values from INSERT statement
  const parseInsertValues = (sql: string): any[] => {
    // Very basic: find everything between first '(' after VALUES and matching ')'
    const match = sql.match(/VALUES\s*\(([\s\S]+)\)/i);
    if (!match) return [];
    // Split on '), (' boundaries
    const raw = match[1];
    // Replace ? with $N
    return raw.split(',').map((s: string) => s.trim().replace(/^'/, '').replace(/'$/, ''));
  };

  const mockPool = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      params = params ?? [];
      const upper = sql.toUpperCase();

      if (upper.includes('INSERT') || upper.includes('ON CONFLICT')) {
        if (sql.includes('cross_domain_dependencies')) {
          const data = get('cross_domain_dependencies');
          const row: TableRow = {
            id: params![0], tenant_id: params![1], source_domain: params![2],
            source_id: params![3], source_name: params![4], target_domain: params![5],
            target_id: params![6], target_name: params![7], type: params![8],
            status: params![9], description: params![10], impact_level: params![11],
            created_by: params![12], created_at: params![13], updated_at: params![14],
            resolved_at: params![15],
          };
          const idx = data.findIndex((r: TableRow) => r.id === row.id);
          if (idx >= 0) { data[idx] = row; } else { data.push(row); }
          set('cross_domain_dependencies', data);
        } else if (sql.includes('approval_gates')) {
          const data = get('approval_gates');
          const row: TableRow = {
            id: params![0], tenant_id: params![1], orchestration_id: params![2],
            step_name: params![3], domain_name: params![4], type: params![5],
            status: params![6],
            required_approvers: typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7],
            actual_approvers: typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8],
            auto_approve_condition: params[9] ? (typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9]) : null,
            created_at: params[10],
            updated_at: params[11],
            completed_at: params[12],
          };
          const idx = data.findIndex((r: TableRow) => r.id === row.id);
          if (idx >= 0) { data[idx] = row; } else { data.push(row); }
          set('approval_gates', data);
        } else if (sql.includes('domain_connectors')) {
          const data = get('domain_connectors');
          const row: TableRow = {
            id: params![0], tenant_id: params![1], domain_name: params![2],
            endpoint: params![3], status: params![4],
            auth_config: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
            health_status: params[6], last_health_check: params[7], created_by: params[8],
            created_at: params[9], updated_at: params[10],
          };
          // ON CONFLICT (tenant_id, domain_name) — use composite key for upsert
          const idx = data.findIndex((r: TableRow) =>
            r.tenant_id === row.tenant_id && r.domain_name === row.domain_name
          );
          if (idx >= 0) {
            data[idx] = { ...data[idx], ...row };
          } else {
            data.push(row);
          }
          set('domain_connectors', data);
        } else if (sql.includes('cross_domain_orchestrations') && !sql.includes('cross_domain_orchestration_steps')) {
          const data = get('cross_domain_orchestrations');
          const row: TableRow = {
            id: params![0], tenant_id: params![1], name: params![2],
            description: params![3], status: params![4],
            input: typeof params![5] === 'string' ? JSON.parse(params[5]) : params[5],
            output: params[6] ? (typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6]) : null,
            error: params[7],
            domains: typeof params![8] === 'string' ? JSON.parse(params[8]) : params[8],
            current_step: params[9], step_count: params[10], completed_steps: params[11],
            created_by: params[12],
            metadata: typeof params![13] === 'string' ? JSON.parse(params[13]) : params[13],
            created_at: params[14],
            updated_at: params[15],
            completed_at: params[16],
            started_at: params[17],
          };
          const idx = data.findIndex((r: TableRow) => r.id === row.id);
          if (idx >= 0) { data[idx] = row; } else { data.push(row); }
          set('cross_domain_orchestrations', data);
        } else if (sql.includes('cross_domain_orchestration_steps')) {
          const data = get('cross_domain_orchestration_steps');
          const row: TableRow = {
            id: params![0], orchestration_id: params![1], step_name: params![2],
            domain_name: params![3], sequence: params![4], status: params![5],
            input: params![6], output: params![7], error: params![8],
            retry_count: params![9], max_retries: params![10],
            started_at: params![11], completed_at: params![12],
            compensation_started_at: params![13], compensation_completed_at: params![14],
          };
          const key = `${row.orchestration_id}_${row.step_name}_${row.sequence}`;
          const existing = data.find((r: TableRow) =>
            r.orchestration_id === row.orchestration_id &&
            r.step_name === row.step_name &&
            r.sequence === row.sequence
          );
          if (existing) { Object.assign(existing, row); } else { data.push(row); }
          set('cross_domain_orchestration_steps', data);
        }
        return { rowCount: 1 };
      }

      if (upper.includes('SELECT')) {
        if (sql.includes('cross_domain_dependencies')) {
          let data = get('cross_domain_dependencies');
          if (sql.includes('WHERE tenant_id')) {
            data = data.filter((r: TableRow) => r.tenant_id === params![0]);
          }
          if (sql.includes('WHERE id')) {
            data = data.filter((r: TableRow) => r.id === params![0]);
          }
          if (sql.includes('source_domain') && sql.includes('source_id')) {
            // SQL: WHERE tenant_id = $1 AND source_domain = $2 AND source_id = $3
            data = data.filter((r: TableRow) =>
              r.source_domain === params![1] && r.source_id === params![2]
            );
          }
          return { rows: data };
        }
        if (sql.includes('approval_gates')) {
          let data = get('approval_gates');
          if (sql.includes('orchestration_id')) {
            data = data.filter((r: TableRow) => r.orchestration_id === params![0]);
          }
          if (sql.includes('WHERE id')) {
            data = data.filter((r: TableRow) => r.id === params![0]);
          }
          // Parse JSON columns
          return { rows: data.map((r: TableRow) => ({
            ...r,
            required_approvers: typeof r.required_approvers === 'string' ? JSON.parse(r.required_approvers) : r.required_approvers,
            actual_approvers: typeof r.actual_approvers === 'string' ? JSON.parse(r.actual_approvers) : r.actual_approvers,
            auto_approve_condition: typeof r.auto_approve_condition === 'string' ? JSON.parse(r.auto_approve_condition) : r.auto_approve_condition,
          }))};
        }
        if (sql.includes('domain_connectors')) {
          let data = get('domain_connectors');
          if (sql.includes('tenant_id') && sql.includes('domain_name')) {
            data = data.filter((r: TableRow) => r.tenant_id === params![0] && r.domain_name === params![1]);
          } else if (sql.includes('tenant_id')) {
            data = data.filter((r: TableRow) => r.tenant_id === params![0]);
          }
          return { rows: data };
        }
        if (sql.includes('cross_domain_orchestrations')) {
          let data = get('cross_domain_orchestrations');
          if (sql.includes('WHERE id')) {
            data = data.filter((r: TableRow) => r.id === params![0]);
          } else if (sql.includes('tenant_id')) {
            data = data.filter((r: TableRow) => r.tenant_id === params![0]);
            data.sort((a: TableRow, b: TableRow) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          }
          // Parse JSON columns
          return { rows: data.map((r: TableRow) => ({
            ...r,
            input: typeof r.input === 'string' ? JSON.parse(r.input) : r.input,
            output: typeof r.output === 'string' && r.output ? JSON.parse(r.output) : r.output,
            error: (typeof r.error === 'string' && r.error && (r.error.startsWith('"') || r.error.startsWith('{') || r.error.startsWith('['))) ? JSON.parse(r.error) : r.error,
            domains: typeof r.domains === 'string' ? JSON.parse(r.domains) : r.domains,
            metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
          }))};
        }
        if (sql.includes('cross_domain_orchestration_steps')) {
          const data = get('cross_domain_orchestration_steps');
          const filtered = data.filter((r: TableRow) => r.orchestration_id === params![0]);
          return { rows: filtered.sort((a, b) => a.sequence - b.sequence) };
        }
        return { rows: [] };
      }

      if (upper.includes('DELETE')) {
        if (sql.includes('cross_domain_dependencies')) {
          const data = get('cross_domain_dependencies');
          const idx = data.findIndex((r: TableRow) => r.id === params![0]);
          if (idx >= 0) data.splice(idx, 1);
          set('cross_domain_dependencies', data);
          return { rowCount: idx >= 0 ? 1 : 0 };
        }
        return { rowCount: 1 };
      }

      return { rows: [] };
    }),
  };

  return mockPool;
}

export { createMockPool };
