// Additional extension point integration tests.
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
)

// ===========================================================================
// 7. Alert-Pipeline — PipelineResult CRUD (NeatLogic EP #7)
// ===========================================================================

func setupAlertPipelineTables(db *sqlx.DB) error {
	stmt := `CREATE TABLE IF NOT EXISTS alert_pipeline_results (
		id UUID PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL,
		alert_id VARCHAR(64),
		alert_name VARCHAR(255) NOT NULL,
		severity VARCHAR(16) NOT NULL DEFAULT 'info',
		stages JSONB DEFAULT '[]',
		status VARCHAR(16) NOT NULL DEFAULT 'pending',
		error TEXT DEFAULT '',
		duration_ms BIGINT DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`
	_, err := db.Exec(stmt)
	return err
}

func cleanupAlertPipelineTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM alert_pipeline_results`)
	return err
}

func TestAlertPipeline_Result(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAlertPipelineTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupAlertPipelineTables(ctx, db) }()

	resultID := fmt.Sprintf("res-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO alert_pipeline_results (id, tenant_id, alert_id, alert_name, severity, stages, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		resultID, "tenant-1", "alert-100", "high-cpu", "critical",
		`["notify", "escalate", "auto-heal"]`, "completed")
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	type Result struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		AlertID  string `db:"alert_id"`
		AlertName string `db:"alert_name"`
		Severity string `db:"severity"`
		Stages   []byte `db:"stages"`
		Status   string `db:"status"`
	}
	var r Result
	err = db.GetContext(ctx, &r, `SELECT * FROM alert_pipeline_results WHERE id = $1`, resultID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if r.Severity != "critical" {
		t.Errorf("expected severity=critical, got %s", r.Severity)
	}
	if r.Status != "completed" {
		t.Errorf("expected status=completed, got %s", r.Status)
	}

	// Verify JSONB stages
	var stages []string
	if err := json.Unmarshal(r.Stages, &stages); err != nil {
		t.Fatalf("parse stages: %v", err)
	}
	if len(stages) != 3 || stages[2] != "auto-heal" {
		t.Errorf("unexpected stages: %v", stages)
	}
}

// ===========================================================================
// 8. Domain CQRS — EventStore + Aggregate versioning (NeatLogic EP #8)
// ===========================================================================

func setupDomainTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS domain_aggregates (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			aggregate_type VARCHAR(64) NOT NULL,
			aggregate_id VARCHAR(128) NOT NULL,
			version INT NOT NULL DEFAULT 0,
			state JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS domain_events (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			event_type VARCHAR(64) NOT NULL,
			aggregate_type VARCHAR(64) NOT NULL,
			aggregate_id VARCHAR(128) NOT NULL,
			version INT NOT NULL,
			payload JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupDomainTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM domain_events`)
	_, err := db.ExecContext(ctx, `DELETE FROM domain_aggregates`)
	return err
}

func TestDomainCQRS_EventSourcing(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupDomainTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupDomainTables(ctx, db) }()

	aggID := fmt.Sprintf("agg-%d", time.Now().UnixNano())
	tenantID := "tenant-1"
	aggType := "service"

	// Create aggregate at version 0
	aggUUID := fmt.Sprintf("agg-uuid-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO domain_aggregates (id, tenant_id, aggregate_type, aggregate_id, version, state)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		aggUUID, tenantID, aggType, aggID, 0, `{"status":"created"}`)
	if err != nil {
		t.Fatalf("create aggregate: %v", err)
	}

	// Append event 1: "started"
	event1ID := fmt.Sprintf("evt-%d", time.Now().UnixNano())
	_, err = db.ExecContext(ctx,
		`INSERT INTO domain_events (id, tenant_id, event_type, aggregate_type, aggregate_id, version, payload)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		event1ID, tenantID, "started", aggType, aggID, 1, `{"at":"2024-01-01"}`)
	if err != nil {
		t.Fatalf("insert event1: %v", err)
	}

	// Append event 2: "deployed"
	event2ID := fmt.Sprintf("evt-%d", time.Now().UnixNano())
	_, err = db.ExecContext(ctx,
		`INSERT INTO domain_events (id, tenant_id, event_type, aggregate_type, aggregate_id, version, payload)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		event2ID, tenantID, "deployed", aggType, aggID, 2, `{"env":"staging"}`)
	if err != nil {
		t.Fatalf("insert event2: %v", err)
	}

	// Update aggregate version
	_, err = db.ExecContext(ctx,
		`UPDATE domain_aggregates SET version = $1, state = $2 WHERE tenant_id = $3 AND aggregate_id = $4`,
		2, `{"status":"deployed","env":"staging"}`, tenantID, aggID)
	if err != nil {
		t.Fatalf("update version: %v", err)
	}

	// Verify aggregate state
	type Agg struct {
		ID           string `db:"id"`
		AggregateType string `db:"aggregate_type"`
		AggregateID  string `db:"aggregate_id"`
		Version      int    `db:"version"`
		State        []byte `db:"state"`
	}
	var agg Agg
	err = db.GetContext(ctx, &agg,
		`SELECT * FROM domain_aggregates WHERE tenant_id = $1 AND aggregate_id = $2`, tenantID, aggID)
	if err != nil {
		t.Fatalf("get aggregate: %v", err)
	}
	if agg.Version != 2 {
		t.Errorf("expected version=2, got %d", agg.Version)
	}

	// Verify event history
	type Event struct {
		ID            string `db:"id"`
		EventType     string `db:"event_type"`
		AggregateType string `db:"aggregate_type"`
		AggregateID   string `db:"aggregate_id"`
		Version       int    `db:"version"`
	}
	var events []Event
	err = db.SelectContext(ctx, &events,
		`SELECT * FROM domain_events WHERE tenant_id = $1 AND aggregate_id = $2 ORDER BY version`,
		tenantID, aggID)
	if err != nil {
		t.Fatalf("list events: %v", err)
	}
	if len(events) != 2 {
		t.Errorf("expected 2 events, got %d", len(events))
	}
	if events[0].EventType != "started" {
		t.Errorf("expected first event=started, got %s", events[0].EventType)
	}
	if events[1].EventType != "deployed" {
		t.Errorf("expected second event=deployed, got %s", events[1].EventType)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO domain_aggregates (id, tenant_id, aggregate_type, aggregate_id, version, state)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		fmt.Sprintf("agg-uuid-%d", time.Now().UnixNano()), "tenant-2", "service", "other-agg", 0, `{}`)
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var eventsT2 []Event
	db.SelectContext(ctx, &eventsT2,
		`SELECT * FROM domain_events WHERE tenant_id = $1`, "tenant-2")
	if len(eventsT2) != 0 {
		t.Errorf("tenant-2 should have no events")
	}
}

// ===========================================================================
// 9. Worker-Dispatcher — Worker CRUD + Capability Dispatch (EP #9)
// ===========================================================================

func setupWorkerDispatcherTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS workers (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'idle',
			capabilities JSONB DEFAULT '[]',
			metadata JSONB DEFAULT '{}',
			last_heartbeat TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS worker_capability_registry (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			worker_id UUID REFERENCES workers(id),
			skill VARCHAR(128) NOT NULL,
			version VARCHAR(32),
			enabled BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupWorkerDispatcherTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM worker_capability_registry`)
	_, err := db.ExecContext(ctx, `DELETE FROM workers`)
	return err
}

func TestWorkerDispatcher_Worker(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupWorkerDispatcherTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupWorkerDispatcherTables(ctx, db) }()

	workerID := fmt.Sprintf("wk-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO workers (id, tenant_id, name, status, capabilities, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		workerID, "tenant-1", "worker-a", "idle",
		`["build","test","deploy"]`, `{"cpu":8,"memory":16}`)
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}

	type Worker struct {
		ID           string `db:"id"`
		TenantID     string `db:"tenant_id"`
		Name         string `db:"name"`
		Status       string `db:"status"`
		Capabilities []byte `db:"capabilities"`
	}
	var w Worker
	err = db.GetContext(ctx, &w, `SELECT * FROM workers WHERE id = $1`, workerID)
	if err != nil {
		t.Fatalf("get worker: %v", err)
	}
	if w.Name != "worker-a" {
		t.Errorf("expected worker-a, got %s", w.Name)
	}
	if w.Status != "idle" {
		t.Errorf("expected idle, got %s", w.Status)
	}

	// Register capability
	capID := fmt.Sprintf("cap-%d", time.Now().UnixNano())
	_, err = db.ExecContext(ctx,
		`INSERT INTO worker_capability_registry (id, tenant_id, worker_id, skill, version, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		capID, "tenant-1", workerID, "kubernetes", "v1.28", true)
	if err != nil {
		t.Fatalf("create capability: %v", err)
	}

	type Capability struct {
		ID       string `db:"id"`
		WorkerID string `db:"worker_id"`
		Skill    string `db:"skill"`
		Version  string `db:"version"`
		Enabled  bool   `db:"enabled"`
	}
	var cap Capability
	err = db.GetContext(ctx, &cap, `SELECT * FROM worker_capability_registry WHERE id = $1`, capID)
	if err != nil {
		t.Fatalf("get capability: %v", err)
	}
	if cap.Skill != "kubernetes" {
		t.Errorf("expected skill=kubernetes, got %s", cap.Skill)
	}

	// Update worker status to busy
	_, err = db.ExecContext(ctx,
		`UPDATE workers SET status = $1 WHERE id = $2 AND tenant_id = $3`,
		"busy", workerID, "tenant-1")
	if err != nil {
		t.Fatalf("update worker: %v", err)
	}

	var updated Worker
	db.GetContext(ctx, &updated, `SELECT * FROM workers WHERE id = $1`, workerID)
	if updated.Status != "busy" {
		t.Errorf("expected busy, got %s", updated.Status)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO workers (id, tenant_id, name, status, capabilities, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		fmt.Sprintf("wk-%d", time.Now().UnixNano()), "tenant-2", "worker-b", "idle", `[]`, `{}`)
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var tenants []struct{ TenantID string `db:"tenant_id"` }
	db.SelectContext(ctx, &tenants, `SELECT tenant_id FROM workers WHERE tenant_id = $1`, "tenant-2")
	if len(tenants) != 1 {
		t.Errorf("tenant-2: expected 1 worker")
	}
}

// ===========================================================================
// 10. CMDB-Import — ImportJob CRUD + Records (EP #10)
// ===========================================================================

func setupCMDBImportTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS cmdb_import_jobs (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			source VARCHAR(128) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			total_records INT DEFAULT 0,
			imported_records INT DEFAULT 0,
			error TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS cmdb_import_records (
			id UUID PRIMARY KEY,
			job_id UUID REFERENCES cmdb_import_jobs(id),
			tenant_id VARCHAR(64) NOT NULL,
			ci_type VARCHAR(64) NOT NULL,
			ci_name VARCHAR(255) NOT NULL,
			data JSONB DEFAULT '{}',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			error TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupCMDBImportTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM cmdb_import_records`)
	_, err := db.ExecContext(ctx, `DELETE FROM cmdb_import_jobs`)
	return err
}

func TestCMDBImport_Job(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupCMDBImportTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupCMDBImportTables(ctx, db) }()

	jobID := fmt.Sprintf("job-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO cmdb_import_jobs (id, tenant_id, name, source, status, total_records)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		jobID, "tenant-1", "server-import", "snmp", "running", 100)
	if err != nil {
		t.Fatalf("create job: %v", err)
	}

	type Job struct {
		ID             string `db:"id"`
		TenantID       string `db:"tenant_id"`
		Name           string `db:"name"`
		Source         string `db:"source"`
		Status         string `db:"status"`
		TotalRecords   int    `db:"total_records"`
		ImportedRecords int   `db:"imported_records"`
	}
	var job Job
	err = db.GetContext(ctx, &job, `SELECT * FROM cmdb_import_jobs WHERE id = $1`, jobID)
	if err != nil {
		t.Fatalf("get job: %v", err)
	}
	if job.Name != "server-import" {
		t.Errorf("expected server-import, got %s", job.Name)
	}
	if job.Status != "running" {
		t.Errorf("expected running, got %s", job.Status)
	}

	// Import records
	for i := 0; i < 5; i++ {
		recID := fmt.Sprintf("rec-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO cmdb_import_records (id, job_id, tenant_id, ci_type, ci_name, data, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			recID, jobID, "tenant-1", "server", fmt.Sprintf("srv-%d", i),
			`{"ip":"10.0.0.1"}`, "imported")
		if err != nil {
			t.Fatalf("insert record: %v", err)
		}
	}

	// Update job with imported count
	_, err = db.ExecContext(ctx,
		`UPDATE cmdb_import_jobs SET imported_records = $1, status = $2 WHERE id = $3`,
		5, "completed", jobID)
	if err != nil {
		t.Fatalf("update job: %v", err)
	}

	var completed Job
	db.GetContext(ctx, &completed, `SELECT * FROM cmdb_import_jobs WHERE id = $1`, jobID)
	if completed.ImportedRecords != 5 {
		t.Errorf("expected 5 imported, got %d", completed.ImportedRecords)
	}
	if completed.Status != "completed" {
		t.Errorf("expected completed, got %s", completed.Status)
	}

	// List records by job
	type Record struct {
		ID     string `db:"id"`
		JobID  string `db:"job_id"`
		CIType string `db:"ci_type"`
		CIName string `db:"ci_name"`
		Status string `db:"status"`
	}
	var records []Record
	err = db.SelectContext(ctx, &records,
		`SELECT * FROM cmdb_import_records WHERE job_id = $1 AND tenant_id = $2`, jobID, "tenant-1")
	if err != nil {
		t.Fatalf("list records: %v", err)
	}
	if len(records) != 5 {
		t.Errorf("expected 5 records, got %d", len(records))
	}
}

// ===========================================================================
// 11. CMDB-Collector — Collector CRUD + Targets (EP #11)
// ===========================================================================

func setupCMDBCollectorTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS cmdb_collectors (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(32) NOT NULL,
			config JSONB DEFAULT '{}',
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			schedule VARCHAR(64),
			last_run TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS cmdb_collector_targets (
			id UUID PRIMARY KEY,
			collector_id UUID REFERENCES cmdb_collectors(id),
			tenant_id VARCHAR(64) NOT NULL,
			target_type VARCHAR(32) NOT NULL,
			target_name VARCHAR(255) NOT NULL,
			endpoint VARCHAR(255),
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			last_collected TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupCMDBCollectorTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM cmdb_collector_targets`)
	_, err := db.ExecContext(ctx, `DELETE FROM cmdb_collectors`)
	return err
}

func TestCMDBCollector_Collector(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupCMDBCollectorTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupCMDBCollectorTables(ctx, db) }()

	collID := fmt.Sprintf("coll-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO cmdb_collectors (id, tenant_id, name, type, config, status, schedule)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		collID, "tenant-1", "snmp-collector", "snmp",
		`{"community":"public"}`, "active", "*/5 * * * *")
	if err != nil {
		t.Fatalf("create collector: %v", err)
	}

	// Add targets
	for i := 0; i < 3; i++ {
		tgtID := fmt.Sprintf("tgt-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO cmdb_collector_targets (id, collector_id, tenant_id, target_type, target_name, endpoint, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			tgtID, collID, "tenant-1", "server", fmt.Sprintf("host-%d", i),
			fmt.Sprintf("10.0.0.%d", i), "active")
		if err != nil {
			t.Fatalf("insert target: %v", err)
		}
	}

	type Target struct {
		ID         string `db:"id"`
		CollectorID string `db:"collector_id"`
		TargetType string `db:"target_type"`
		TargetName string `db:"target_name"`
		Endpoint   string `db:"endpoint"`
		Status     string `db:"status"`
	}
	var targets []Target
	err = db.SelectContext(ctx, &targets,
		`SELECT * FROM cmdb_collector_targets WHERE collector_id = $1 AND tenant_id = $2`, collID, "tenant-1")
	if err != nil {
		t.Fatalf("list targets: %v", err)
	}
	if len(targets) != 3 {
		t.Errorf("expected 3 targets, got %d", len(targets))
	}
}

// ===========================================================================
// 12. Product-Line — ProductLine CRUD + Deploy Mappings (EP #12)
// ===========================================================================

func setupProductLineTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS product_lines (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			description TEXT DEFAULT '',
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			config JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS product_line_deploy_mappings (
			id UUID PRIMARY KEY,
			product_line_id UUID REFERENCES product_lines(id),
			tenant_id VARCHAR(64) NOT NULL,
			environment VARCHAR(32) NOT NULL,
			branch_pattern VARCHAR(128) NOT NULL,
			pipeline_id VARCHAR(64),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupProductLineTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM product_line_deploy_mappings`)
	_, err := db.ExecContext(ctx, `DELETE FROM product_lines`)
	return err
}

func TestProductLine_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupProductLineTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupProductLineTables(ctx, db) }()

	plID := fmt.Sprintf("pl-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO product_lines (id, tenant_id, name, description, status)
		 VALUES ($1, $2, $3, $4, $5)`,
		plID, "tenant-1", "platform-api", "Core API service", "active")
	if err != nil {
		t.Fatalf("create product-line: %v", err)
	}

	// Add deploy mappings
	for env, branch := range map[string]string{"staging": "staging-*", "production": "main", "dev": "feature-*"} {
		mappingID := fmt.Sprintf("map-%d", time.Now().UnixNano())
		_, err = db.ExecContext(ctx,
			`INSERT INTO product_line_deploy_mappings (id, product_line_id, tenant_id, environment, branch_pattern)
			 VALUES ($1, $2, $3, $4, $5)`,
			mappingID, plID, "tenant-1", env, branch)
		if err != nil {
			t.Fatalf("insert mapping: %v", err)
		}
	}

	type Mapping struct {
		ID            string `db:"id"`
		ProductLineID string `db:"product_line_id"`
		Environment   string `db:"environment"`
		BranchPattern string `db:"branch_pattern"`
	}
	var mappings []Mapping
	err = db.SelectContext(ctx, &mappings,
		`SELECT * FROM product_line_deploy_mappings WHERE product_line_id = $1 AND tenant_id = $2`, plID, "tenant-1")
	if err != nil {
		t.Fatalf("list mappings: %v", err)
	}
	if len(mappings) != 3 {
		t.Errorf("expected 3 mappings, got %d", len(mappings))
	}

	// Verify branch pattern resolution
	envMap := make(map[string]string)
	for _, m := range mappings {
		envMap[m.Environment] = m.BranchPattern
	}
	if envMap["staging"] != "staging-*" {
		t.Errorf("expected staging pattern, got %s", envMap["staging"])
	}
	if envMap["production"] != "main" {
		t.Errorf("expected production pattern, got %s", envMap["production"])
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO product_lines (id, tenant_id, name, description, status)
		 VALUES ($1, $2, $3, $4, $5)`,
		fmt.Sprintf("pl-%d", time.Now().UnixNano()), "tenant-2", "other-pl", "", "active")
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var plTenant1 []struct{ TenantID string `db:"tenant_id"` }
	db.SelectContext(ctx, &plTenant1, `SELECT tenant_id FROM product_lines WHERE tenant_id = $1`, "tenant-1")
	if len(plTenant1) != 1 {
		t.Errorf("tenant-1: expected 1 product-line")
	}
}