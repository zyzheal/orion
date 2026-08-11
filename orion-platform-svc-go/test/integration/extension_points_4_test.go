// Remaining extension point integration tests (EP #4, #17-#21, #24-#26, #28).
package integration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
)

// ===========================================================================
// 4. Pipeline-Executor — Pipeline CRUD + Steps + Executions (EP #4)
// ===========================================================================

func setupPipelineExecutorTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS pipelines (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			config TEXT DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS pipeline_steps (
			id VARCHAR(64) PRIMARY KEY,
			pipeline_id VARCHAR(64) REFERENCES pipelines(id),
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(128) NOT NULL,
			"type" VARCHAR(64) NOT NULL,
			"order" INT NOT NULL DEFAULT 0,
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			config TEXT DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS pipeline_executions (
			id VARCHAR(64) PRIMARY KEY,
			pipeline_id VARCHAR(64) REFERENCES pipelines(id),
			tenant_id VARCHAR(64) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			output TEXT DEFAULT '',
			started_at TIMESTAMPTZ,
			finished_at TIMESTAMPTZ,
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

func cleanupPipelineExecutorTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM pipeline_executions`)
	_, _ = db.ExecContext(ctx, `DELETE FROM pipeline_steps`)
	_, err := db.ExecContext(ctx, `DELETE FROM pipelines`)
	return err
}

func TestPipelineExecutor_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineExecutorTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupPipelineExecutorTables(ctx, db) }()

	pipeID := fmt.Sprintf("pipe-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO pipelines (id, tenant_id, name, status) VALUES ($1, $2, $3, $4)`,
		pipeID, "tenant-1", "deploy-pipeline", "active")
	if err != nil {
		t.Fatalf("create pipeline: %v", err)
	}

	// Add steps
	steps := []struct{ name, stepType string }{
		{"checkout", "git"},
		{"build", "docker"},
		{"test", "exec"},
		{"deploy", "k8s"},
	}
	for i, step := range steps {
		stepID := fmt.Sprintf("step-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO pipeline_steps (id, pipeline_id, tenant_id, name, "type", "order", status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			stepID, pipeID, "tenant-1", step.name, step.stepType, i, "pending")
		if err != nil {
			t.Fatalf("insert step: %v", err)
		}
	}

	type Step struct {
		ID        string `db:"id"`
		PipelineID string `db:"pipeline_id"`
		Name      string `db:"name"`
		Type      string `db:"type"`
		Order     int    `db:"order"`
		Status    string `db:"status"`
	}
	var stepsList []Step
	err = db.SelectContext(ctx, &stepsList,
		`SELECT * FROM pipeline_steps WHERE pipeline_id = $1 ORDER BY "order"`, pipeID)
	if err != nil {
		t.Fatalf("list steps: %v", err)
	}
	if len(stepsList) != 4 {
		t.Errorf("expected 4 steps, got %d", len(stepsList))
	}
	if stepsList[0].Name != "checkout" {
		t.Errorf("expected first step=checkout, got %s", stepsList[0].Name)
	}
	if stepsList[3].Name != "deploy" {
		t.Errorf("expected last step=deploy, got %s", stepsList[3].Name)
	}

	// Run pipeline execution
	execID := fmt.Sprintf("exec-%d", time.Now().UnixNano())
	started := time.Now()
	_, err = db.ExecContext(ctx,
		`INSERT INTO pipeline_executions (id, pipeline_id, tenant_id, status, output, started_at, finished_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		execID, pipeID, "tenant-1", "completed", "all steps passed", started, started.Add(30*time.Second))
	if err != nil {
		t.Fatalf("insert execution: %v", err)
	}

	type Exec struct {
		ID         string `db:"id"`
		PipelineID string `db:"pipeline_id"`
		Status     string `db:"status"`
		Output     string `db:"output"`
	}
	var exec Exec
	err = db.GetContext(ctx, &exec, `SELECT * FROM pipeline_executions WHERE id = $1`, execID)
	if err != nil {
		t.Fatalf("get execution: %v", err)
	}
	if exec.Status != "completed" {
		t.Errorf("expected completed, got %s", exec.Status)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO pipelines (id, tenant_id, name, status) VALUES ($1, $2, $3, $4)`,
		fmt.Sprintf("pipe-%d", time.Now().UnixNano()), "tenant-2", "other-pipe", "active")
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var t1pipes []struct{ TenantID string `db:"tenant_id"` }
	db.SelectContext(ctx, &t1pipes, `SELECT tenant_id FROM pipelines WHERE tenant_id = $1`, "tenant-1")
	if len(t1pipes) != 1 {
		t.Errorf("tenant-1: expected 1 pipeline")
	}
}

// ===========================================================================
// 17. Handler-Registry — Handler CRUD + Invoke (EP #17)
// ===========================================================================

func setupHandlerRegistryTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS handler_registry (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			domain VARCHAR(128) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			config JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupHandlerRegistryTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM handler_registry`)
	return err
}

func TestHandlerRegistry_Invoke(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupHandlerRegistryTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupHandlerRegistryTables(ctx, db) }()

	hID := fmt.Sprintf("h-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO handler_registry (id, tenant_id, name, domain, status, config)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		hID, "tenant-1", "deploy-handler", "deployment", "active",
		`{"type":"function","target":"deploy.Service"}`)
	if err != nil {
		t.Fatalf("create handler: %v", err)
	}

	type Handler struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name     string `db:"name"`
		Domain   string `db:"domain"`
		Status   string `db:"status"`
		Config   []byte `db:"config"`
	}
	var h Handler
	err = db.GetContext(ctx, &h, `SELECT * FROM handler_registry WHERE id = $1`, hID)
	if err != nil {
		t.Fatalf("get handler: %v", err)
	}
	if h.Domain != "deployment" {
		t.Errorf("expected domain=deployment, got %s", h.Domain)
	}
	if h.Status != "active" {
		t.Errorf("expected active, got %s", h.Status)
	}

	// List by domain
	var handlers []Handler
	err = db.SelectContext(ctx, &handlers,
		`SELECT * FROM handler_registry WHERE tenant_id = $1 AND domain = $2`, "tenant-1", "deployment")
	if err != nil {
		t.Fatalf("list by domain: %v", err)
	}
	if len(handlers) != 1 {
		t.Errorf("expected 1 handler, got %d", len(handlers))
	}

	// Disable handler
	_, err = db.ExecContext(ctx,
		`UPDATE handler_registry SET status = $1 WHERE id = $2 AND tenant_id = $3`,
		"disabled", hID, "tenant-1")
	if err != nil {
		t.Fatalf("disable: %v", err)
	}

	var disabled Handler
	db.GetContext(ctx, &disabled, `SELECT * FROM handler_registry WHERE id = $1`, hID)
	if disabled.Status != "disabled" {
		t.Errorf("expected disabled, got %s", disabled.Status)
	}
}

// ===========================================================================
// 19. Data-Pipeline — Pipeline CRUD + Status (EP #19)
// ===========================================================================

func setupDataPipelineTables(db *sqlx.DB) error {
	stmt := `CREATE TABLE IF NOT EXISTS data_pipelines (
		id UUID PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL,
		name VARCHAR(255) NOT NULL,
		type VARCHAR(32) NOT NULL,
		source VARCHAR(255),
		sink VARCHAR(255),
		config JSONB DEFAULT '{}',
		status VARCHAR(16) NOT NULL DEFAULT 'active',
		last_run TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`
	_, err := db.Exec(stmt)
	return err
}

func cleanupDataPipelineTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM data_pipelines`)
	return err
}

func TestDataPipeline_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupDataPipelineTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupDataPipelineTables(ctx, db) }()

	dpID := fmt.Sprintf("dp-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO data_pipelines (id, tenant_id, name, type, source, sink, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		dpID, "tenant-1", "etl-users", "etl", "postgres://src", "s3://bucket/data", "active")
	if err != nil {
		t.Fatalf("create pipeline: %v", err)
	}

	type DP struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name     string `db:"name"`
		Type     string `db:"type"`
		Source   string `db:"source"`
		Sink     string `db:"sink"`
		Status   string `db:"status"`
	}
	var dp DP
	err = db.GetContext(ctx, &dp, `SELECT * FROM data_pipelines WHERE id = $1`, dpID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if dp.Source != "postgres://src" {
		t.Errorf("expected source=postgres://src, got %s", dp.Source)
	}
	if dp.Type != "etl" {
		t.Errorf("expected etl, got %s", dp.Type)
	}

	// Update status to running with last_run timestamp
	now := time.Now()
	_, err = db.ExecContext(ctx,
		`UPDATE data_pipelines SET status = $1, last_run = $2 WHERE id = $3 AND tenant_id = $4`,
		"running", now, dpID, "tenant-1")
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	var running DP
	db.GetContext(ctx, &running, `SELECT * FROM data_pipelines WHERE id = $1`, dpID)
	if running.Status != "running" {
		t.Errorf("expected running, got %s", running.Status)
	}
}

// ===========================================================================
// 20. Middleware-Ops — Middleware CRUD + Health (EP #20)
// ===========================================================================

func setupMiddlewareOpsTables(db *sqlx.DB) error {
	stmt := `CREATE TABLE IF NOT EXISTS middleware_ops (
		id UUID PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL,
		name VARCHAR(255) NOT NULL,
		"type" VARCHAR(32) NOT NULL,
		status VARCHAR(16) NOT NULL DEFAULT 'healthy',
		metrics JSONB DEFAULT '{}',
		config JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`
	_, err := db.Exec(stmt)
	return err
}

func cleanupMiddlewareOpsTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM middleware_ops`)
	return err
}

func TestMiddlewareOps_Health(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupMiddlewareOpsTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupMiddlewareOpsTables(ctx, db) }()

	mwID := fmt.Sprintf("mw-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO middleware_ops (id, tenant_id, name, "type", status, metrics)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		mwID, "tenant-1", "nginx-proxy", "gateway", "healthy",
		`{"requests_per_sec":1500,"error_rate":0.01}`)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	type MW struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name     string `db:"name"`
		Type     string `db:"type"`
		Status   string `db:"status"`
	}
	var mw MW
	err = db.GetContext(ctx, &mw, `SELECT * FROM middleware_ops WHERE id = $1`, mwID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if mw.Type != "gateway" {
		t.Errorf("expected gateway, got %s", mw.Type)
	}
	if mw.Status != "healthy" {
		t.Errorf("expected healthy, got %s", mw.Status)
	}

	// Simulate failure
	_, err = db.ExecContext(ctx,
		`UPDATE middleware_ops SET status = $1 WHERE id = $2 AND tenant_id = $3`,
		"degraded", mwID, "tenant-1")
	if err != nil {
		t.Fatalf("update status: %v", err)
	}

	var degraded MW
	db.GetContext(ctx, &degraded, `SELECT * FROM middleware_ops WHERE id = $1`, mwID)
	if degraded.Status != "degraded" {
		t.Errorf("expected degraded, got %s", degraded.Status)
	}

	// List by type
	var gateways []MW
	err = db.SelectContext(ctx, &gateways,
		`SELECT * FROM middleware_ops WHERE tenant_id = $1 AND "type" = $2`, "tenant-1", "gateway")
	if err != nil {
		t.Fatalf("list by type: %v", err)
	}
	if len(gateways) != 1 {
		t.Errorf("expected 1 gateway, got %d", len(gateways))
	}
}

// ===========================================================================
// 21. Task-Executor — Task CRUD + Execution (EP #21)
// ===========================================================================

func setupTaskExecutorTables(db *sqlx.DB) error {
	stmt := `CREATE TABLE IF NOT EXISTS task_executor_tasks (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL,
		name VARCHAR(255) NOT NULL,
		"type" VARCHAR(64) NOT NULL,
		status VARCHAR(16) NOT NULL DEFAULT 'pending',
		input JSONB DEFAULT '{}',
		output TEXT DEFAULT '',
		error TEXT DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		started_at TIMESTAMPTZ,
		finished_at TIMESTAMPTZ
	)`
	_, err := db.Exec(stmt)
	return err
}

func cleanupTaskExecutorTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM task_executor_tasks`)
	return err
}

func TestTaskExecutor_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupTaskExecutorTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupTaskExecutorTables(ctx, db) }()

	taskID := fmt.Sprintf("task-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO task_executor_tasks (id, tenant_id, name, "type", status, input)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		taskID, "tenant-1", "process-batch", "data_processing", "pending",
		`{"batch_size":100,"format":"csv"}`)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	type TE struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name     string `db:"name"`
		Type     string `db:"type"`
		Status   string `db:"status"`
	}
	var task TE
	err = db.GetContext(ctx, &task, `SELECT * FROM task_executor_tasks WHERE id = $1`, taskID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if task.Type != "data_processing" {
		t.Errorf("expected data_processing, got %s", task.Type)
	}

	// Execute task
	now := time.Now()
	_, err = db.ExecContext(ctx,
		`UPDATE task_executor_tasks SET status = $1, output = $2, started_at = $3, finished_at = $4
		 WHERE id = $5 AND tenant_id = $6`,
		"completed", `{"records":100,"errors":0}`, now, now.Add(2*time.Second), taskID, "tenant-1")
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	var completed TE
	db.GetContext(ctx, &completed, `SELECT * FROM task_executor_tasks WHERE id = $1`, taskID)
	if completed.Status != "completed" {
		t.Errorf("expected completed, got %s", completed.Status)
	}
}

// ===========================================================================
// 24. Developer-Portal — Portal CRUD + Access (EP #24)
// ===========================================================================

func setupDeveloperPortalTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS developer_portals (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			description TEXT DEFAULT '',
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			config JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS developer_portal_access (
			id UUID PRIMARY KEY,
			portal_id UUID REFERENCES developer_portals(id),
			tenant_id VARCHAR(64) NOT NULL,
			user_id VARCHAR(64) NOT NULL,
			role VARCHAR(32) NOT NULL DEFAULT 'viewer',
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

func cleanupDeveloperPortalTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM developer_portal_access`)
	_, err := db.ExecContext(ctx, `DELETE FROM developer_portals`)
	return err
}

func TestDeveloperPortal_Access(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupDeveloperPortalTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupDeveloperPortalTables(ctx, db) }()

	portalID := fmt.Sprintf("portal-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO developer_portals (id, tenant_id, name, status) VALUES ($1, $2, $3, $4)`,
		portalID, "tenant-1", "api-docs", "active")
	if err != nil {
		t.Fatalf("create portal: %v", err)
	}

	// Add users with different roles
	roles := []string{"admin", "editor", "viewer"}
	for _, role := range roles {
		accID := fmt.Sprintf("acc-%d", time.Now().UnixNano())
		_, err = db.ExecContext(ctx,
			`INSERT INTO developer_portal_access (id, portal_id, tenant_id, user_id, role)
			 VALUES ($1, $2, $3, $4, $5)`,
			accID, portalID, "tenant-1", fmt.Sprintf("user-%s", role), role)
		if err != nil {
			t.Fatalf("insert access: %v", err)
		}
	}

	type Access struct {
		ID      string `db:"id"`
		PortalID string `db:"portal_id"`
		UserID  string `db:"user_id"`
		Role    string `db:"role"`
	}
	var accesses []Access
	err = db.SelectContext(ctx, &accesses,
		`SELECT * FROM developer_portal_access WHERE portal_id = $1`, portalID)
	if err != nil {
		t.Fatalf("list access: %v", err)
	}
	if len(accesses) != 3 {
		t.Errorf("expected 3 access records, got %d", len(accesses))
	}

	// Verify roles
	roleSet := make(map[string]string)
	for _, a := range accesses {
		roleSet[a.UserID] = a.Role
	}
	if roleSet["user-admin"] != "admin" {
		t.Errorf("expected admin role, got %s", roleSet["user-admin"])
	}
}

// ===========================================================================
// 25. Digital-Twin — Twin CRUD + Snapshots (EP #25)
// ===========================================================================

func setupDigitalTwinTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS digital_twins (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			asset_type VARCHAR(64) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			snapshot_count INT DEFAULT 0,
			data JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
			id UUID PRIMARY KEY,
			twin_id UUID REFERENCES digital_twins(id),
			tenant_id VARCHAR(64) NOT NULL,
			serial INT NOT NULL,
			snapshot_data JSONB DEFAULT '{}',
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

func cleanupDigitalTwinTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM digital_twin_snapshots`)
	_, err := db.ExecContext(ctx, `DELETE FROM digital_twins`)
	return err
}

func TestDigitalTwin_Snapshot(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupDigitalTwinTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupDigitalTwinTables(ctx, db) }()

	twinID := fmt.Sprintf("twin-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO digital_twins (id, tenant_id, name, asset_type, status, data)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		twinID, "tenant-1", "server-01", "server", "active",
		`{"cpu":60,"memory":80,"disk":45}`)
	if err != nil {
		t.Fatalf("create twin: %v", err)
	}

	// Take 3 snapshots at different times
	for i := 0; i < 3; i++ {
	 snapID := fmt.Sprintf("snap-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO digital_twin_snapshots (id, twin_id, tenant_id, serial, snapshot_data)
			 VALUES ($1, $2, $3, $4, $5)`,
			snapID, twinID, "tenant-1", i+1,
			fmt.Sprintf(`{"cpu":%d,"memory":%d,"timestamp":"2024-01-01T%02d:00:00Z"}`,
				40+i*10, 60+i*5, 10+i))
		if err != nil {
			t.Fatalf("insert snapshot: %v", err)
		}
	}

	type Twin struct {
		ID        string `db:"id"`
		TenantID  string `db:"tenant_id"`
		Name      string `db:"name"`
		AssetType string `db:"asset_type"`
		Status    string `db:"status"`
	}
	var twin Twin
	err = db.GetContext(ctx, &twin, `SELECT * FROM digital_twins WHERE id = $1`, twinID)
	if err != nil {
		t.Fatalf("get twin: %v", err)
	}
	if twin.AssetType != "server" {
		t.Errorf("expected server, got %s", twin.AssetType)
	}

	// List snapshots
	type Snapshot struct {
		ID     string `db:"id"`
		TwinID string `db:"twin_id"`
		Serial int    `db:"serial"`
	}
	var snapshots []Snapshot
	err = db.SelectContext(ctx, &snapshots,
		`SELECT * FROM digital_twin_snapshots WHERE twin_id = $1 ORDER BY serial`, twinID)
	if err != nil {
		t.Fatalf("list snapshots: %v", err)
	}
	if len(snapshots) != 3 {
		t.Errorf("expected 3 snapshots, got %d", len(snapshots))
	}
	if snapshots[2].Serial != 3 {
		t.Errorf("expected last serial=3, got %d", snapshots[2].Serial)
	}
}

// ===========================================================================
// 26. RCA — RCARecord CRUD + Analysis (EP #26)
// ===========================================================================

func setupRCATables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS rca_records (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT DEFAULT '',
			status VARCHAR(16) NOT NULL DEFAULT 'open',
			severity VARCHAR(16) NOT NULL DEFAULT 'medium',
			root_cause TEXT DEFAULT '',
			fix_suggestion TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS rca_analyses (
			id UUID PRIMARY KEY,
			rca_id UUID REFERENCES rca_records(id),
			tenant_id VARCHAR(64) NOT NULL,
			step INT NOT NULL,
			action VARCHAR(64) NOT NULL,
			result TEXT DEFAULT '',
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

func cleanupRCATables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM rca_analyses`)
	_, err := db.ExecContext(ctx, `DELETE FROM rca_records`)
	return err
}

func TestRCA_Analysis(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupRCATables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupRCATables(ctx, db) }()

	rcaID := fmt.Sprintf("rca-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO rca_records (id, tenant_id, title, status, severity, root_cause, fix_suggestion)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		rcaID, "tenant-1", "High latency in api-gateway",
		"investigating", "high",
		"Database connection pool exhaustion",
		"Increase pool size and add connection timeout")
	if err != nil {
		t.Fatalf("create RCA: %v", err)
	}

	// Add analysis steps
	steps := []struct{ action, result string }{
		{"collect_metrics", "CPU: 95%, DB connections: 200/200"},
		{"analyze_logs", "Timeout errors from pg driver"},
		{"identify_root_cause", "Connection pool max=200 exhausted"},
	}
	for i, step := range steps {
		stepID := fmt.Sprintf("step-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO rca_analyses (id, rca_id, tenant_id, step, action, result)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			stepID, rcaID, "tenant-1", i+1, step.action, step.result)
		if err != nil {
			t.Fatalf("insert step: %v", err)
		}
	}

	type RCA struct {
		ID            string `db:"id"`
		TenantID      string `db:"tenant_id"`
		Title         string `db:"title"`
		Status        string `db:"status"`
		Severity      string `db:"severity"`
		RootCause     string `db:"root_cause"`
		FixSuggestion string `db:"fix_suggestion"`
	}
	var rca RCA
	err = db.GetContext(ctx, &rca, `SELECT * FROM rca_records WHERE id = $1`, rcaID)
	if err != nil {
		t.Fatalf("get RCA: %v", err)
	}
	if rca.Severity != "high" {
		t.Errorf("expected severity=high, got %s", rca.Severity)
	}
	if rca.RootCause != "Database connection pool exhaustion" {
		t.Errorf("unexpected root cause: %s", rca.RootCause)
	}

	// List analysis steps
	type AnalysisStep struct {
		ID     string `db:"id"`
		RCAID  string `db:"rca_id"`
		Step   int    `db:"step"`
		Action string `db:"action"`
		Result string `db:"result"`
	}
	var stepsList []AnalysisStep
	err = db.SelectContext(ctx, &stepsList,
		`SELECT * FROM rca_analyses WHERE rca_id = $1 ORDER BY step`, rcaID)
	if err != nil {
		t.Fatalf("list steps: %v", err)
	}
	if len(stepsList) != 3 {
		t.Errorf("expected 3 analysis steps, got %d", len(stepsList))
	}
	if stepsList[0].Action != "collect_metrics" {
		t.Errorf("expected first step=collect_metrics, got %s", stepsList[0].Action)
	}

	// Update RCA to resolved
	_, err = db.ExecContext(ctx,
		`UPDATE rca_records SET status = $1 WHERE id = $2 AND tenant_id = $3`,
		"resolved", rcaID, "tenant-1")
	if err != nil {
		t.Fatalf("update status: %v", err)
	}

	var resolved RCA
	db.GetContext(ctx, &resolved, `SELECT * FROM rca_records WHERE id = $1`, rcaID)
	if resolved.Status != "resolved" {
		t.Errorf("expected resolved, got %s", resolved.Status)
	}
}

// ===========================================================================
// 28. Ticketing — Ticket CRUD + Workflow (EP #28)
// ===========================================================================

func setupTicketingTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS tickets (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT DEFAULT '',
			status VARCHAR(16) NOT NULL DEFAULT 'open',
			priority VARCHAR(16) NOT NULL DEFAULT 'medium',
			assignee VARCHAR(128) DEFAULT '',
			created_by VARCHAR(128) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_transitions (
			id UUID PRIMARY KEY,
			ticket_id UUID REFERENCES tickets(id),
			tenant_id VARCHAR(64) NOT NULL,
			from_status VARCHAR(16) NOT NULL,
			to_status VARCHAR(16) NOT NULL,
			actor VARCHAR(128),
			note TEXT DEFAULT '',
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

func cleanupTicketingTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM ticket_transitions`)
	_, err := db.ExecContext(ctx, `DELETE FROM tickets`)
	return err
}

func TestTicketing_Workflow(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupTicketingTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupTicketingTables(ctx, db) }()

	ticketID := fmt.Sprintf("tk-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO tickets (id, tenant_id, title, status, priority, assignee, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		ticketID, "tenant-1", "Service down", "open", "critical", "", "user-1")
	if err != nil {
		t.Fatalf("create ticket: %v", err)
	}

	type Ticket struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Title    string `db:"title"`
		Status   string `db:"status"`
		Priority string `db:"priority"`
		Assignee string `db:"assignee"`
		CreatedBy string `db:"created_by"`
	}
	var ticket Ticket
	err = db.GetContext(ctx, &ticket, `SELECT * FROM tickets WHERE id = $1`, ticketID)
	if err != nil {
		t.Fatalf("get ticket: %v", err)
	}
	if ticket.Priority != "critical" {
		t.Errorf("expected critical, got %s", ticket.Priority)
	}

	// Transition: open -> assigned -> in_progress -> resolved
	transitions := []struct{ from, to, actor string }{
		{"open", "assigned", "user-1"},
		{"assigned", "in_progress", "engineer-1"},
		{"in_progress", "resolved", "engineer-1"},
	}
	for _, tr := range transitions {
		trID := fmt.Sprintf("tr-%d", time.Now().UnixNano())
		_, err = db.ExecContext(ctx,
			`INSERT INTO ticket_transitions (id, ticket_id, tenant_id, from_status, to_status, actor)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			trID, ticketID, "tenant-1", tr.from, tr.to, tr.actor)
		if err != nil {
			t.Fatalf("insert transition: %v", err)
		}
		// Update ticket status
		_, err = db.ExecContext(ctx,
			`UPDATE tickets SET status = $1, updated_at = $2 WHERE id = $3`,
			tr.to, time.Now(), ticketID)
		if err != nil {
			t.Fatalf("update status: %v", err)
		}
	}

	// Verify final state
	var resolved Ticket
	db.GetContext(ctx, &resolved, `SELECT * FROM tickets WHERE id = $1`, ticketID)
	if resolved.Status != "resolved" {
		t.Errorf("expected resolved, got %s", resolved.Status)
	}

	// List transitions
	type Transition struct {
		ID        string `db:"id"`
		TicketID  string `db:"ticket_id"`
		FromStatus string `db:"from_status"`
		ToStatus  string `db:"to_status"`
		Actor     string `db:"actor"`
	}
	var trans []Transition
	err = db.SelectContext(ctx, &trans,
		`SELECT * FROM ticket_transitions WHERE ticket_id = $1 ORDER BY created_at`, ticketID)
	if err != nil {
		t.Fatalf("list transitions: %v", err)
	}
	if len(trans) != 3 {
		t.Errorf("expected 3 transitions, got %d", len(trans))
	}
	if trans[0].FromStatus != "open" || trans[0].ToStatus != "assigned" {
		t.Errorf("expected open->assigned, got %s->%s", trans[0].FromStatus, trans[0].ToStatus)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO tickets (id, tenant_id, title, status, priority, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		fmt.Sprintf("tk-%d", time.Now().UnixNano()), "tenant-2", "Other ticket", "open", "low", "user-2")
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var t1tickets []Ticket
	db.SelectContext(ctx, &t1tickets, `SELECT * FROM tickets WHERE tenant_id = $1`, "tenant-1")
	if len(t1tickets) != 1 {
		t.Errorf("tenant-1: expected 1 ticket")
	}
}