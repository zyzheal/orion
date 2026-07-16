package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/service-topology/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("service topology not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// EnsureTable creates tables if they do not exist.
func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS service_topology (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		service_name VARCHAR(255) NOT NULL,
		service_url VARCHAR(1024) DEFAULT '',
		port INTEGER DEFAULT 0,
		status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
		dependencies JSONB DEFAULT '[]',
		metadata JSONB DEFAULT '{}',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(tenant_id, service_name)
	);
	CREATE INDEX IF NOT EXISTS idx_service_topology_tenant ON service_topology(tenant_id);
	CREATE TABLE IF NOT EXISTS topology_edges (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		source_service VARCHAR(255) NOT NULL,
		target_service VARCHAR(255) NOT NULL,
		relation_type VARCHAR(32) NOT NULL DEFAULT 'depends_on',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(tenant_id, source_service, target_service)
	);
	CREATE INDEX IF NOT EXISTS idx_topology_edges_tenant ON topology_edges(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_topology_edges_source ON topology_edges(tenant_id, source_service);
	CREATE INDEX IF NOT EXISTS idx_topology_edges_target ON topology_edges(tenant_id, target_service);
	`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.ServiceTopology) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	if m.Status == "" {
		m.Status = models.StatusActive
	}
	if m.Dependencies == nil {
		m.Dependencies = []string{}
	}
	if m.Metadata == nil {
		m.Metadata = map[string]string{}
	}
	deps, _ := json.Marshal(m.Dependencies)
	meta, _ := json.Marshal(m.Metadata)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO service_topology
		(id, tenant_id, service_name, service_url, port, status, dependencies, metadata, created_at, updated_at)
		VALUES (:id, :tenant_id, :service_name, :service_url, :port, :status, :dependencies, :metadata, :created_at, :updated_at)
		ON CONFLICT (tenant_id, service_name) DO NOTHING`,
		map[string]interface{}{
			"id": m.ID, "tenant_id": m.TenantID,
			"service_name": m.ServiceName, "service_url": m.ServiceURL,
			"port": m.Port, "status": string(m.Status),
			"dependencies": string(deps), "metadata": string(meta),
			"created_at": m.CreatedAt, "updated_at": m.UpdatedAt,
		})
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ServiceTopology, error) {
	var m models.ServiceTopology
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_topology WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return &m, nil
}

func (r *Repository) GetByServiceName(ctx context.Context, tenantID, serviceName string) (*models.ServiceTopology, error) {
	var m models.ServiceTopology
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_topology WHERE service_name = $1 AND tenant_id = $2`, serviceName, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ServiceTopology, error) {
	var items []models.ServiceTopology
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM service_topology WHERE tenant_id = $1 ORDER BY service_name`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ServiceTopology, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	// Convert JSONB fields to strings
	for k, v := range updates {
		switch t := v.(type) {
		case []string:
			b, _ := json.Marshal(t)
			updates[k] = string(b)
		case map[string]string:
			b, _ := json.Marshal(t)
			updates[k] = string(b)
		}
	}
	query, args, err := sqlx.Named(`UPDATE service_topology SET @:updates WHERE id = :id AND tenant_id = :tenant_id`,
		map[string]interface{}{"updates": updates, "id": id, "tenant_id": tenantID})
	if err != nil {
		return nil, err
	}
	_, err = r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `DELETE FROM topology_edges WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM service_topology WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) AddEdge(ctx context.Context, tenantID, source, target string, relType models.RelationType) error {
	if relType == "" {
		relType = models.RelDependsOn
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO topology_edges (id, tenant_id, source_service, target_service, relation_type, created_at)
		VALUES (:id, :tenant_id, :source_service, :target_service, :relation_type, :created_at)
		ON CONFLICT (tenant_id, source_service, target_service) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
		map[string]interface{}{
			"id": uuid.New().String(), "tenant_id": tenantID,
			"source_service": source, "target_service": target,
			"relation_type": string(relType), "created_at": time.Now().UTC(),
		})
	return err
}

func (r *Repository) RemoveEdge(ctx context.Context, tenantID, source, target string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM topology_edges WHERE tenant_id = $1 AND source_service = $2 AND target_service = $3`,
		tenantID, source, target)
	return err
}

func (r *Repository) GetEdges(ctx context.Context, tenantID, serviceName string) ([]models.TopologyEdge, error) {
	var edges []models.TopologyEdge
	err := r.db.SelectContext(ctx, &edges,
		`SELECT * FROM topology_edges WHERE tenant_id = $1 AND source_service = $2 ORDER BY target_service`,
		tenantID, serviceName)
	return edges, err
}

func (r *Repository) GetUpstreamDependencies(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	var result []string
	visited := map[string]bool{serviceName: true}
	queue := []string{serviceName}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		var deps []string
		err := r.db.SelectContext(ctx, &deps,
			`SELECT target_service FROM topology_edges WHERE tenant_id = $1 AND source_service = $2`,
			tenantID, current)
		if err != nil {
			return nil, err
		}
		for _, d := range deps {
			if !visited[d] {
				visited[d] = true
				queue = append(queue, d)
				result = append(result, d)
			}
		}
	}
	return result, nil
}

func (r *Repository) GetDownstreamDependents(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	var result []string
	visited := map[string]bool{serviceName: true}
	queue := []string{serviceName}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		var dependents []string
		err := r.db.SelectContext(ctx, &dependents,
			`SELECT source_service FROM topology_edges WHERE tenant_id = $1 AND target_service = $2`,
			tenantID, current)
		if err != nil {
			return nil, err
		}
		for _, d := range dependents {
			if !visited[d] {
				visited[d] = true
				queue = append(queue, d)
				result = append(result, d)
			}
		}
	}
	return result, nil
}

func (r *Repository) DetectCycles(ctx context.Context, tenantID string) ([][]string, error) {
	var edges []models.TopologyEdge
	err := r.db.SelectContext(ctx, &edges,
		`SELECT * FROM topology_edges WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	graph := map[string][]string{}
	nodes := map[string]bool{}
	for _, e := range edges {
		graph[e.SourceService] = append(graph[e.SourceService], e.TargetService)
		nodes[e.SourceService] = true
		nodes[e.TargetService] = true
	}
	var cycles [][]string
	visited := map[string]bool{}
	path := []string{}
	pathSet := map[string]bool{}
	var dfs func(string)
	dfs = func(node string) {
		if pathSet[node] {
			idx := -1
			for i, n := range path {
				if n == node {
					idx = i
					break
				}
			}
			if idx >= 0 {
				cycle := make([]string, len(path)-idx+1)
				copy(cycle, path[idx:])
				cycle[len(cycle)-1] = node
				cycles = append(cycles, cycle)
			}
			return
		}
		if visited[node] {
			return
		}
		visited[node] = true
		path = append(path, node)
		pathSet[node] = true
		for _, nb := range graph[node] {
			dfs(nb)
		}
		path = path[:len(path)-1]
		delete(pathSet, node)
	}
	for n := range nodes {
		if !visited[n] {
			dfs(n)
		}
	}
	return cycles, nil
}

func (r *Repository) GetTopologyStats(ctx context.Context, tenantID string) (*models.TopologyStats, error) {
	stats := &models.TopologyStats{}
	err := r.db.GetContext(ctx, &stats.ServiceCount,
		`SELECT COUNT(*) FROM service_topology WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &stats.DependencyCount,
		`SELECT COUNT(*) FROM topology_edges WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	// Max depth via BFS over all edges
	var allEdges []models.TopologyEdge
	err = r.db.SelectContext(ctx, &allEdges,
		`SELECT * FROM topology_edges WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	graph := map[string][]string{}
	for _, e := range allEdges {
		graph[e.SourceService] = append(graph[e.SourceService], e.TargetService)
	}
	for start := range graph {
		seen := map[string]bool{}
		q := []struct{ node string; depth int }{{start, 0}}
		for len(q) > 0 {
			cur := q[0]
			q = q[1:]
			if cur.depth > stats.MaxDepth {
				stats.MaxDepth = cur.depth
			}
			for _, nb := range graph[cur.node] {
				if !seen[nb] {
					seen[nb] = true
					q = append(q, struct{ node string; depth int }{nb, cur.depth + 1})
				}
			}
		}
	}
	cycles, err := r.DetectCycles(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	stats.HasCycle = len(cycles) > 0
	return stats, nil
}
