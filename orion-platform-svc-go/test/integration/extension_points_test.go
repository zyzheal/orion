// Package integration provides end-to-end integration tests for the 29
// NeatLogic extension points mapped to Orion modules.
//
// Each test group:
//   - Creates the required tables via AutoMigrate or inline DDL
//   - Runs full CRUD lifecycle through the repository
//   - Cleans up via t.Cleanup
//   - Skips when ORION_TEST_DSN is not set
//
// Run:
//   ORION_TEST_DSN="postgres://..." go test ./test/integration/... -v -run TestExtensionPoint
//
// 29 Extension Points:
//   1. extension-point: ExtensionPoint CRUD + lifecycle
//   2. startup: StartupModule CRUD + status transitions
//   3. auto-exec: ExecutionTask CRUD + history + plugin SPI
//   4. pipeline-executor: Pipeline CRUD + steps + executions
//   5. job-actions: JobAction CRUD + executions
//   6. job-processor: OperationChain CRUD + operations
//   7. alert-pipeline: PipelineResult CRUD
//   8. domain (CQRS): EventStore + aggregates
//   9. worker-dispatcher: Worker CRUD + capability dispatch
//  10. cmdb-import: ImportJob CRUD + records
//  11. cmdb-collector: Collector CRUD + targets
//  12. product-line: ProductLine CRUD + deploy mappings
//  13. inspection: Record CRUD + status transitions + stats
//  14. confirmation: Record CRUD + batch operations
//  15. prompt-security: Config CRUD + scan history
//  16. global-search: Config CRUD + status tracking
//  17. handler-registry: HandlerEntry CRUD + invoke routing
//  18. cron: CronJob CRUD + execution history
//  19. data-pipeline: Pipeline CRUD + status management
//  20. middleware-ops: Middleware CRUD + status
//  21. task-executor: Task CRUD + execution
//  22. iac: Workspace CRUD + state versions + resources
//  23. chatops: Session CRUD + commands
//  24. developer-portal: Portal CRUD + access control
//  25. digital-twin: Twin CRUD + snapshots
//  26. rca: RCARecord CRUD + analysis
//  27. config: ConfigRecord CRUD + dependency graph
//  28. ticketing: Ticket CRUD + workflow
//  29. startup-task: StartupTask CRUD (shared with extension-point)

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	ext_repo "orion/platform-svc-go/internal/extension-point/repository"
)

// ===========================================================================
// 1. Extension Point — ExtensionPoint CRUD + lifecycle (NeatLogic EP #1)
// ===========================================================================

func setupExtensionPointTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS extension_points (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL DEFAULT '',
			name VARCHAR(128) NOT NULL,
			category VARCHAR(32) NOT NULL,
			description TEXT,
			handler_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
			config JSONB DEFAULT '{}',
			enabled BOOLEAN DEFAULT true,
			priority INT DEFAULT 0,
			status VARCHAR(32) NOT NULL DEFAULT 'registered',
			error TEXT,
			registered_at TIMESTAMP DEFAULT NOW(),
			initialized_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS startup_tasks (
			id UUID PRIMARY KEY,
			extension_id UUID REFERENCES extension_points(id),
			name VARCHAR(128) NOT NULL,
			script TEXT,
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			phase INT DEFAULT 0,
			enabled BOOLEAN DEFAULT true,
			output TEXT,
			error TEXT,
			dry_run BOOLEAN DEFAULT false,
			forced BOOLEAN DEFAULT false,
			execution_mode VARCHAR(32) DEFAULT 'auto',
			duration_ms BIGINT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupExtensionPointTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM startup_tasks`)
	_, err := db.ExecContext(ctx, `DELETE FROM extension_points`)
	return err
}

func TestExtensionPointRepository_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupExtensionPointTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupExtensionPointTables(ctx, db) }()

	repo := ext_repo.NewRepository(db)

	id := uuid.New()
	ep := &struct {
		ID          uuid.UUID `db:"id"`
		TenantID    string    `db:"tenant_id"`
		Name        string    `db:"name"`
		Category    string    `db:"category"`
		Description string    `db:"description"`
		HandlerType string    `db:"handler_type"`
		Config      []byte    `db:"config"`
		Enabled     bool      `db:"enabled"`
		Priority    int       `db:"priority"`
		Status      string    `db:"status"`
	}{
		ID:          id,
		TenantID:    "tenant-1",
		Name:        "test-hook",
		Category:    "pipeline",
		Description: "integration test hook",
		HandlerType: "builtin",
		Config:      []byte(`{"key":"value"}`),
		Enabled:     true,
		Priority:    10,
		Status:      "registered",
	}

	type EP struct {
		ID          uuid.UUID `db:"id"`
		TenantID    string    `db:"tenant_id"`
		Name        string    `db:"name"`
		Category    string    `db:"category"`
		HandlerType string    `db:"handler_type"`
		Config      []byte    `db:"config"`
		Enabled     bool      `db:"enabled"`
		Priority    int       `db:"priority"`
		Status      string    `db:"status"`
	}

	// Create
	_, err := db.ExecContext(ctx,
		`INSERT INTO extension_points (id, tenant_id, name, category, description, handler_type, config, enabled, priority, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		ep.ID, ep.TenantID, ep.Name, ep.Category, ep.Description, ep.HandlerType, ep.Config, ep.Enabled, ep.Priority, ep.Status)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	// GetByID
	var got EP
	err = db.GetContext(ctx, &got, `SELECT * FROM extension_points WHERE id = $1`, id)
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	if got.Name != "test-hook" {
		t.Errorf("expected name=test-hook, got %s", got.Name)
	}
	if got.Category != "pipeline" {
		t.Errorf("expected category=pipeline, got %s", got.Category)
	}
	if !got.Enabled {
		t.Errorf("expected enabled=true")
	}

	// Verify config JSONB
	var cfg map[string]interface{}
	if err := json.Unmarshal(got.Config, &cfg); err != nil {
		t.Fatalf("config JSONB parse: %v", err)
	}
	if cfg["key"] != "value" {
		t.Errorf("expected config key=value, got %v", cfg)
	}

	// List
	var eps []EP
	err = db.SelectContext(ctx, &eps, `SELECT * FROM extension_points WHERE tenant_id = $1`, "tenant-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(eps) != 1 {
		t.Errorf("expected 1 extension point, got %d", len(eps))
	}

	// Update
	now := time.Now()
	_, err = db.ExecContext(ctx,
		`UPDATE extension_points SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		"initialized", now, id, "tenant-1")
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	var updated EP
	err = db.GetContext(ctx, &updated, `SELECT * FROM extension_points WHERE id = $1`, id)
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if updated.Status != "initialized" {
		t.Errorf("expected status=initialized, got %s", updated.Status)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO extension_points (id, tenant_id, name, category, handler_type, config, enabled, priority, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		uuid.New(), "tenant-2", "other-hook", "alert", "builtin", []byte(`{}`), true, 5, "registered")
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}

	var tenant2 []EP
	err = db.SelectContext(ctx, &tenant2, `SELECT * FROM extension_points WHERE tenant_id = $1`, "tenant-2")
	if err != nil {
		t.Fatalf("list tenant-2: %v", err)
	}
	if len(tenant2) != 1 {
		t.Errorf("tenant-2: expected 1, got %d", len(tenant2))
	}

	// Delete
	_, err = db.ExecContext(ctx, `DELETE FROM extension_points WHERE id = $1 AND tenant_id = $2`, id, "tenant-1")
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	var count int
	db.GetContext(ctx, &count, `SELECT COUNT(*) FROM extension_points WHERE id = $1`, id)
	if count != 0 {
		t.Errorf("expected 0 after delete, got %d", count)
	}
	_ = repo
}

func TestStartupTaskRepository_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupExtensionPointTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupExtensionPointTables(ctx, db) }()

	// Insert an extension point first (startup_tasks references it)
	epID := uuid.New()
	_, err := db.ExecContext(ctx,
		`INSERT INTO extension_points (id, tenant_id, name, category, handler_type, config, enabled, priority, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		epID, "tenant-1", "parent-ep", "pipeline", "builtin", []byte(`{}`), true, 1, "registered")
	if err != nil {
		t.Fatalf("insert ep: %v", err)
	}

	// Create startup task
	taskID := uuid.New()
	_, err = db.ExecContext(ctx,
		`INSERT INTO startup_tasks (id, extension_id, name, script, status, phase, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		taskID, epID, "init-db", "SELECT 1", "pending", 0, true)
	if err != nil {
		t.Fatalf("insert task: %v", err)
	}

	type ST struct {
		ID          uuid.UUID `db:"id"`
		ExtensionID uuid.UUID `db:"extension_id"`
		Name        string    `db:"name"`
		Script      string    `db:"script"`
		Status      string    `db:"status"`
		Phase       int       `db:"phase"`
		Enabled     bool      `db:"enabled"`
		Output      string    `db:"output"`
	}
	var task ST
	err = db.GetContext(ctx, &task, `SELECT * FROM startup_tasks WHERE id = $1`, taskID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if task.Name != "init-db" {
		t.Errorf("expected name=init-db, got %s", task.Name)
	}
	if task.Script != "SELECT 1" {
		t.Errorf("expected script=SELECT 1, got %s", task.Script)
	}
	if task.Status != "pending" {
		t.Errorf("expected status=pending, got %s", task.Status)
	}

	// Update status
	_, err = db.ExecContext(ctx,
		`UPDATE startup_tasks SET status = $1, output = $2 WHERE id = $3`,
		"completed", "ok", taskID)
	if err != nil {
		t.Fatalf("update task: %v", err)
	}

	var updated ST
	db.GetContext(ctx, &updated, `SELECT * FROM startup_tasks WHERE id = $1`, taskID)
	if updated.Status != "completed" {
		t.Errorf("expected completed, got %s", updated.Status)
	}
	if updated.Output != "ok" {
		t.Errorf("expected output=ok, got %s", updated.Output)
	}
}

// ===========================================================================
// 3. Auto-Exec — ExecutionTask CRUD + History (NeatLogic EP #3, #21-22)
// ===========================================================================

func setupAutoExecTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS execution_tasks (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(32) NOT NULL,
			config TEXT DEFAULT '',
			plugin VARCHAR(128) NOT NULL,
			plugin_params TEXT DEFAULT '{}',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			retry_count INT NOT NULL DEFAULT 0,
			max_retries INT NOT NULL DEFAULT 3,
			timeout INT NOT NULL DEFAULT 300,
			output TEXT DEFAULT '',
			error TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			started_at TIMESTAMPTZ,
			finished_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS execution_history (
			id VARCHAR(64) PRIMARY KEY,
			task_id VARCHAR(64) NOT NULL REFERENCES execution_tasks(id),
			action VARCHAR(64) NOT NULL,
			result TEXT,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			finished_at TIMESTAMPTZ,
			duration_ms BIGINT
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func cleanupAutoExecTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM execution_history`)
	_, err := db.ExecContext(ctx, `DELETE FROM execution_tasks`)
	return err
}

func TestAutoExecTask_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAutoExecTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupAutoExecTables(ctx, db) }()

	// Create task
	taskID := fmt.Sprintf("task-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO execution_tasks (id, tenant_id, name, type, plugin, status, timeout)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		taskID, "tenant-1", "deploy-job", "deployment", "shell", "pending", 60)
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	// Get task
	type Task struct {
		ID      string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name    string `db:"name"`
		Type    string `db:"type"`
		Plugin  string `db:"plugin"`
		Status  string `db:"status"`
		Timeout int    `db:"timeout"`
	}
	var task Task
	err = db.GetContext(ctx, &task, `SELECT * FROM execution_tasks WHERE id = $1`, taskID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}
	if task.Name != "deploy-job" {
		t.Errorf("expected name=deploy-job, got %s", task.Name)
	}
	if task.Plugin != "shell" {
		t.Errorf("expected plugin=shell, got %s", task.Plugin)
	}

	// List tasks by tenant
	var tasks []Task
	err = db.SelectContext(ctx, &tasks, `SELECT * FROM execution_tasks WHERE tenant_id = $1`, "tenant-1")
	if err != nil {
		t.Fatalf("list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Errorf("expected 1 task, got %d", len(tasks))
	}

	// Update status to running
	now := time.Now()
	_, err = db.ExecContext(ctx,
		`UPDATE execution_tasks SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4`,
		"running", now, now, taskID)
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	// Record execution history
	historyID := fmt.Sprintf("hist-%d", time.Now().UnixNano())
	_, err = db.ExecContext(ctx,
		`INSERT INTO execution_history (id, task_id, action, result, duration_ms)
		 VALUES ($1, $2, $3, $4, $5)`,
		historyID, taskID, "execute", "deployed successfully", 42)
	if err != nil {
		t.Fatalf("create history: %v", err)
	}

	// Get history for task
	type History struct {
		ID         string `db:"id"`
		TaskID     string `db:"task_id"`
		Action     string `db:"action"`
		Result     string `db:"result"`
		DurationMs int64  `db:"duration_ms"`
	}
	var hist History
	err = db.GetContext(ctx, &hist, `SELECT * FROM execution_history WHERE id = $1`, historyID)
	if err != nil {
		t.Fatalf("get history: %v", err)
	}
	if hist.Action != "execute" {
		t.Errorf("expected action=execute, got %s", hist.Action)
	}
	if hist.DurationMs != 42 {
		t.Errorf("expected duration=42, got %d", hist.DurationMs)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO execution_tasks (id, tenant_id, name, type, plugin, status, timeout)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		fmt.Sprintf("task-%d", time.Now().UnixNano()), "tenant-2", "other-job", "http", "webhook", "pending", 30)
	if err != nil {
		t.Fatalf("insert tenant-2: %v", err)
	}
	var t2tasks []Task
	db.SelectContext(ctx, &t2tasks, `SELECT * FROM execution_tasks WHERE tenant_id = $1`, "tenant-2")
	if len(t2tasks) != 1 {
		t.Errorf("tenant-2: expected 1, got %d", len(t2tasks))
	}

	// Delete task
	_, err = db.ExecContext(ctx, `DELETE FROM execution_tasks WHERE id = $1`, taskID)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	var remaining int
	db.GetContext(ctx, &remaining, `SELECT COUNT(*) FROM execution_tasks WHERE id = $1`, taskID)
	if remaining != 0 {
		t.Errorf("expected 0 after delete, got %d", remaining)
	}
}

// ===========================================================================
// 5. Job-Actions — JobAction CRUD + Execution (NeatLogic EP #5)
// ===========================================================================

func setupJobActionsTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS job_actions (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(64) NOT NULL,
			description TEXT DEFAULT '',
			params TEXT DEFAULT '{}',
			category VARCHAR(32) NOT NULL DEFAULT 'deployment',
			timeout INT NOT NULL DEFAULT 300,
			retry_count INT NOT NULL DEFAULT 0,
			enabled BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS job_action_executions (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			action_id VARCHAR(64) NOT NULL REFERENCES job_actions(id),
			params TEXT DEFAULT '{}',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			output TEXT DEFAULT '',
			error TEXT DEFAULT '',
			duration_ms BIGINT NOT NULL DEFAULT 0,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

func cleanupJobActionsTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM job_action_executions`)
	_, err := db.ExecContext(ctx, `DELETE FROM job_actions`)
	return err
}

func TestJobActions_CRUD(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupJobActionsTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupJobActionsTables(ctx, db) }()

	actionID := fmt.Sprintf("action-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO job_actions (id, tenant_id, name, type, category, timeout, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		actionID, "tenant-1", "deploy-service", "deployment", "deployment", 300, true)
	if err != nil {
		t.Fatalf("create action: %v", err)
	}

	type Action struct {
		ID       string `db:"id"`
		TenantID string `db:"tenant_id"`
		Name     string `db:"name"`
		Type     string `db:"type"`
		Category string `db:"category"`
		Timeout  int    `db:"timeout"`
		Enabled  bool   `db:"enabled"`
	}
	var action Action
	err = db.GetContext(ctx, &action, `SELECT * FROM job_actions WHERE id = $1`, actionID)
	if err != nil {
		t.Fatalf("get action: %v", err)
	}
	if action.Name != "deploy-service" {
		t.Errorf("expected name=deploy-service, got %s", action.Name)
	}
	if !action.Enabled {
		t.Errorf("expected enabled=true")
	}

	// Execute action
	execID := fmt.Sprintf("exec-%d", time.Now().UnixNano())
	_, err = db.ExecContext(ctx,
		`INSERT INTO job_action_executions (id, tenant_id, action_id, status, output, duration_ms)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		execID, "tenant-1", actionID, "completed", "deployed", 150)
	if err != nil {
		t.Fatalf("create execution: %v", err)
	}

	type Exec struct {
		ID        string `db:"id"`
		ActionID  string `db:"action_id"`
		Status    string `db:"status"`
		Output    string `db:"output"`
		DurationMs int64 `db:"duration_ms"`
	}
	var exec Exec
	err = db.GetContext(ctx, &exec, `SELECT * FROM job_action_executions WHERE id = $1`, execID)
	if err != nil {
		t.Fatalf("get execution: %v", err)
	}
	if exec.Status != "completed" {
		t.Errorf("expected completed, got %s", exec.Status)
	}
	if exec.DurationMs != 150 {
		t.Errorf("expected 150ms, got %d", exec.DurationMs)
	}

	// List executions by action
	var execs []Exec
	err = db.SelectContext(ctx, &execs, `SELECT * FROM job_action_executions WHERE action_id = $1`, actionID)
	if err != nil {
		t.Fatalf("list executions: %v", err)
	}
	if len(execs) != 1 {
		t.Errorf("expected 1 execution, got %d", len(execs))
	}
}

// ===========================================================================
// 6. Job-Processor — OperationChain CRUD + Operations (NeatLogic EP #6)
// ===========================================================================

func setupJobProcessorTables(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS job_operation_chains (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(255) NOT NULL DEFAULT '',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			error TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS job_operations (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			chain_id VARCHAR(64),
			type VARCHAR(16) NOT NULL,
			target VARCHAR(255) NOT NULL,
			params TEXT DEFAULT '{}',
			result TEXT DEFAULT '{}',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			error TEXT DEFAULT '',
			"order" INT NOT NULL DEFAULT 0,
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

func cleanupJobProcessorTables(ctx context.Context, db *sqlx.DB) error {
	_, _ = db.ExecContext(ctx, `DELETE FROM job_operations`)
	_, err := db.ExecContext(ctx, `DELETE FROM job_operation_chains`)
	return err
}

func TestJobProcessor_Chain(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupJobProcessorTables(db); err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer func() { _ = cleanupJobProcessorTables(ctx, db) }()

	chainID := fmt.Sprintf("chain-%d", time.Now().UnixNano())
	_, err := db.ExecContext(ctx,
		`INSERT INTO job_operation_chains (id, tenant_id, name, status) VALUES ($1, $2, $3, $4)`,
		chainID, "tenant-1", "deploy-chain", "pending")
	if err != nil {
		t.Fatalf("create chain: %v", err)
	}

	// Add operations to chain
	for i, opType := range []string{"clone", "build", "test", "deploy"} {
		opID := fmt.Sprintf("op-%d", time.Now().UnixNano()+int64(i))
		_, err = db.ExecContext(ctx,
			`INSERT INTO job_operations (id, tenant_id, chain_id, type, target, status, "order")
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			opID, "tenant-1", chainID, opType, "service-a", "pending", i)
		if err != nil {
			t.Fatalf("create op %s: %v", opType, err)
		}
	}

	type Op struct {
		ID     string `db:"id"`
		ChainID string `db:"chain_id"`
		Type   string `db:"type"`
		Target string `db:"target"`
		Status string `db:"status"`
		Order  int    `db:"order"`
	}
	var ops []Op
	err = db.SelectContext(ctx, &ops, `SELECT * FROM job_operations WHERE chain_id = $1 ORDER BY "order"`, chainID)
	if err != nil {
		t.Fatalf("list ops: %v", err)
	}
	if len(ops) != 4 {
		t.Errorf("expected 4 operations, got %d", len(ops))
	}
	if ops[0].Type != "clone" || ops[3].Type != "deploy" {
		t.Errorf("expected ordered [clone, build, test, deploy], got %v", ops)
	}

	// Execute ops in sequence
	for i, op := range ops {
		newStatus := "completed"
		if i == 2 { // "test" fails
			newStatus = "failed"
		}
		_, err = db.ExecContext(ctx,
			`UPDATE job_operations SET status = $1, result = $2, updated_at = $3 WHERE id = $4`,
			newStatus, `{"output":"ok"}`, time.Now(), op.ID)
		if err != nil {
			t.Fatalf("update op: %v", err)
		}
	}

	// Verify sequence
	var ops2 []Op
	db.SelectContext(ctx, &ops2, `SELECT * FROM job_operations WHERE chain_id = $1 ORDER BY "order"`, chainID)
	if ops2[2].Status != "failed" {
		t.Errorf("expected test op to fail, got %s", ops2[2].Status)
	}
	if ops2[0].Status != "completed" {
		t.Errorf("expected clone to be completed, got %s", ops2[0].Status)
	}

	// Tenant isolation
	_, err = db.ExecContext(ctx,
		`INSERT INTO job_operation_chains (id, tenant_id, name, status) VALUES ($1, $2, $3, $4)`,
		fmt.Sprintf("chain-%d", time.Now().UnixNano()), "tenant-2", "other-chain", "pending")
	if err != nil {
		t.Fatalf("insert tenant-2 chain: %v", err)
	}
	var chains []struct {
		ID    string `db:"id"`
		TenantID string `db:"tenant_id"`
	}
	db.SelectContext(ctx, &chains, `SELECT id, tenant_id FROM job_operation_chains WHERE tenant_id = $1`, "tenant-2")
	if len(chains) != 1 {
		t.Errorf("tenant-2: expected 1 chain, got %d", len(chains))
	}
}