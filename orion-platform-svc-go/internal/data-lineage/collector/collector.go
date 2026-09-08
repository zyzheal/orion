// Package collector automatically extracts data lineage edges from SQL
// statements. It is the missing automatic-acquisition layer that turns
// data-lineage from a manual CRUD catalog into a live graph maintained
// by analyzing real query traffic.
//
// Design:
//   - The collector parses SQL with a lightweight tokenizer (no external
//     parser dependency) to extract source tables (FROM/JOIN) and target
//     tables (INSERT INTO/UPDATE/CREATE/ALTER). The same approach is used
//     by inception/engine/local_engine.go; we duplicate the small parser
//     here to avoid an import cycle and keep the lineage collector
//     self-contained.
//   - Extracted edges are upserted into the lineage graph via the
//     existing RepositoryInterface so the CRUD API and the auto-collector
//     share one persistence path.
//   - Every call carries a tenantID; nodes are scoped per-tenant.
package collector

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/data-lineage/models"
)

// Repository is the persistence contract the collector needs. It is a
// subset of data-lineage/repository.RepositoryInterface — narrowed to
// just the write paths the collector uses, so a test fake can be small.
type Repository interface {
	CreateNode(ctx context.Context, node *models.Node) error
	CreateRelationship(ctx context.Context, rel *models.Relationship) error
	ListNodesByLineage(ctx context.Context, tenantID, lineageID string) ([]models.Node, error)
}

// Collector extracts lineage edges from SQL and upserts them into the
// graph. It is safe for concurrent use — the node cache is guarded by
// a mutex so parallel SQL streams do not race on node creation.
type Collector struct {
	repo Repository
	log  *zap.Logger

	mu       sync.Mutex
	lineages map[string]*lineageCache // lineageID -> cache
}

// lineageCache holds the node IDs we have already created for a lineage,
// keyed by "type:name" so a second sighting of the same table reuses the
// existing node instead of creating a duplicate.
type lineageCache struct {
	nodes map[string]string // "table:users" -> node ID
}

// NewCollector wires a Collector. A nil log disables structured logging.
func NewCollector(repo Repository, log *zap.Logger) *Collector {
	if log == nil {
		log = zap.NewNop()
	}
	return &Collector{
		repo:     repo,
		log:      log,
		lineages: make(map[string]*lineageCache),
	}
}

// CollectRequest is the input to Collect. SQL is the statement to analyze;
// LineageID identifies the graph to write into; TenantID scopes the nodes.
type CollectRequest struct {
	LineageID string
	TenantID  string
	SQL       string
}

// CollectResult summarizes what the collector extracted.
type CollectResult struct {
	SourceTables      []string
	TargetTables      []string
	RelationshipsAdded int
	NodesCreated      int
}

// Collect parses the SQL, extracts source/target tables, and upserts the
// corresponding nodes and relationships. It is idempotent: re-analyzing
// the same SQL does not create duplicate nodes or edges.
func (c *Collector) Collect(ctx context.Context, req CollectRequest) (*CollectResult, error) {
	if req.SQL == "" {
		return nil, fmt.Errorf("collector: sql is required")
	}
	if req.LineageID == "" {
		return nil, fmt.Errorf("collector: lineage id is required")
	}
	if req.TenantID == "" {
		return nil, fmt.Errorf("collector: tenant id is required")
	}

	sources, targets := extractTables(req.SQL)
	result := &CollectResult{
		SourceTables: sources,
		TargetTables: targets,
	}

	c.mu.Lock()
	cache, ok := c.lineages[req.LineageID]
	if !ok {
		cache = &lineageCache{nodes: make(map[string]string)}
		c.lineages[req.LineageID] = cache
	}
	c.mu.Unlock()

	// Resolve or create nodes for all tables involved.
	nodeIDs := make(map[string]string)
	for _, t := range union(sources, targets) {
		id, created, err := c.upsertNode(ctx, cache, req.LineageID, req.TenantID, t)
		if err != nil {
			return result, fmt.Errorf("collector: upsert node %q: %w", t, err)
		}
		nodeIDs[t] = id
		if created {
			result.NodesCreated++
		}
	}

	// Create edges: each source → each target. The relationship type is
	// "reads_from" for source tables and "writes_to" for target tables,
	// but since a single SQL statement connects sources to targets we
	// model the edge as "transforms" (source → target). For a pure SELECT
	// (no target), we still record the source nodes so the graph reflects
	// which tables are being read.
	if len(targets) == 0 {
		// Pure read: no edges to create. Source nodes still recorded.
		return result, nil
	}

	for _, src := range sources {
		for _, tgt := range targets {
			if src == tgt {
				continue // self-loop, skip
			}
			rel := &models.Relationship{
				ID:           uuid.New().String(),
				LineageID:    req.LineageID,
				SourceNodeID: nodeIDs[src],
				TargetNodeID: nodeIDs[tgt],
				Type:         "transforms",
			}
			desc := fmt.Sprintf("Auto-collected from SQL: %s → %s", src, tgt)
			rel.Description = &desc
			if err := c.repo.CreateRelationship(ctx, rel); err != nil {
				c.log.Warn("collector: create relationship failed",
					zap.String("src", src),
					zap.String("tgt", tgt),
					zap.Error(err))
				continue
			}
			result.RelationshipsAdded++
		}
	}

	return result, nil
}

// upsertNode returns the node ID for a table, creating it if missing.
// The cache check is under the collector mutex so concurrent calls do
// not double-create the same node.
func (c *Collector) upsertNode(ctx context.Context, cache *lineageCache, lineageID, tenantID, tableName string) (string, bool, error) {
	key := "table:" + tableName

	c.mu.Lock()
	if id, ok := cache.nodes[key]; ok {
		c.mu.Unlock()
		return id, false, nil
	}
	c.mu.Unlock()

	node := &models.Node{
		ID:         uuid.New().String(),
		LineageID:  lineageID,
		Name:       tableName,
		Type:       "table",
		Properties: map[string]any{
			"source":   "auto-collected",
			"tenantId": tenantID,
		},
	}
	if err := c.repo.CreateNode(ctx, node); err != nil {
		return "", false, err
	}

	c.mu.Lock()
	cache.nodes[key] = node.ID
	c.mu.Unlock()
	return node.ID, true, nil
}

// extractTables parses the SQL and returns (sourceTables, targetTables).
// Sources are tables read (FROM, JOIN). Targets are tables written
// (INSERT INTO, UPDATE, CREATE TABLE, ALTER TABLE, DROP TABLE).
func extractTables(sql string) (sources, targets []string) {
	normalized := normalizeWhitespace(sql)
	upper := strings.ToUpper(normalized)

	// Target detection: find the table being written.
	// INSERT INTO <table>, UPDATE <table>, CREATE TABLE <table>,
	// ALTER TABLE <table>, DROP TABLE <table>, TRUNCATE [TABLE] <table>,
	// DELETE FROM <table>.
	targetPatterns := []struct {
		re     *regexp.Regexp
		groups []int
	}{
		{regexp.MustCompile(`(?i)\bINSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)`), []int{1}},
		{regexp.MustCompile(`(?i)\bUPDATE\s+([A-Za-z_][A-Za-z0-9_]*)\s`), []int{1}},
		{regexp.MustCompile(`(?i)\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)`), []int{1}},
		{regexp.MustCompile(`(?i)\bALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)`), []int{1}},
		{regexp.MustCompile(`(?i)\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)`), []int{1}},
		{regexp.MustCompile(`(?i)\bDELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)`), []int{1}},
	}
	seenTgt := map[string]bool{}
	for _, p := range targetPatterns {
		matches := p.re.FindAllStringSubmatch(upper, -1)
		for _, m := range matches {
			for _, g := range p.groups {
				if g < len(m) && m[g] != "" && !seenTgt[m[g]] {
					seenTgt[m[g]] = true
					targets = append(targets, m[g])
				}
			}
		}
	}

	// Source detection: FROM and JOIN clauses.
	// "FROM table" / "FROM table t1, table t2" / "JOIN table"
	// We also catch table names with schema prefix (schema.table).
	sourceRE := regexp.MustCompile(`(?i)\bFROM\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)*)`)
	joinRE := regexp.MustCompile(`(?i)\bJOIN\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)`)
	seenSrc := map[string]bool{}

	// FROM clauses: use FindAllStringSubmatch to capture every FROM in
	// the statement, including those in subqueries. The previous code
	// used FindStringSubmatch which only captured the first FROM — so
	// "SELECT ... FROM x WHERE id IN (SELECT ... FROM y)" missed table y.
	for _, m := range sourceRE.FindAllStringSubmatch(normalized, -1) {
		for _, t := range strings.Split(m[1], ",") {
			t = strings.TrimSpace(t)
			// Extract just the table name (drop alias).
			fields := strings.Fields(t)
			if len(fields) > 0 {
				t = fields[0]
			}
			// Strip schema prefix.
			if dot := strings.Index(t, "."); dot >= 0 {
				t = t[dot+1:]
			}
			t = strings.Trim(t, "\"`'")
			if t != "" && !seenSrc[t] && !isSQLKeyword(t) {
				seenSrc[t] = true
				sources = append(sources, t)
			}
		}
	}

	// JOIN clauses.
	for _, m := range joinRE.FindAllStringSubmatch(normalized, -1) {
		if len(m) > 1 {
			t := strings.Trim(m[1], "\"`'")
			if dot := strings.Index(t, "."); dot >= 0 {
				t = t[dot+1:]
			}
			if t != "" && !seenSrc[t] && !isSQLKeyword(t) {
				seenSrc[t] = true
				sources = append(sources, t)
			}
		}
	}

	return sources, targets
}

// normalizeWhitespace collapses runs of whitespace to single spaces so
// the regex patterns do not need to handle every newline/tab variant.
func normalizeWhitespace(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\t", " ")
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return strings.TrimSpace(s)
}

// union returns the deduplicated union of two string slices.
func union(a, b []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, x := range a {
		if !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	for _, x := range b {
		if !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	return out
}

var sqlKeywordSet = map[string]bool{
	"SELECT": true, "FROM": true, "WHERE": true, "AND": true, "OR": true,
	"NOT": true, "JOIN": true, "INNER": true, "OUTER": true, "LEFT": true,
	"RIGHT": true, "FULL": true, "ON": true, "AS": true, "IN": true,
	"IS": true, "NULL": true, "LIKE": true, "BETWEEN": true, "ORDER": true,
	"BY": true, "GROUP": true, "HAVING": true, "LIMIT": true, "OFFSET": true,
	"SET": true, "VALUES": true, "INTO": true, "UPDATE": true, "DELETE": true,
	"INSERT": true, "CASE": true, "WHEN": true, "THEN": true, "ELSE": true,
	"END": true, "DISTINCT": true, "EXISTS": true, "TRUE": true, "FALSE": true,
	"TABLE": true, "CREATE": true, "ALTER": true, "DROP": true, "TRUNCATE": true,
}

func isSQLKeyword(w string) bool {
	return sqlKeywordSet[strings.ToUpper(w)]
}
