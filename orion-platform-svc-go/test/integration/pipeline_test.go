// Package integration tests the pipeline service against a real PostgreSQL
// database. Each test runs in isolation via schema setup in the DB provider.
//
// Run:
//   go test ./test/integration/... -v -run TestPipeline
//
// Skip (no DB available):
//   go test ./test/integration/... -short
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"orion/platform-svc-go/internal/pipeline/models"
	pipeline_repo "orion/platform-svc-go/internal/pipeline/repository"

	"github.com/jmoiron/sqlx"
)

// setupPipelineTables creates the pipelines table if missing.
func setupPipelineTables(db *sqlx.DB) error {
	stmt := `CREATE TABLE IF NOT EXISTS pipelines (
		id VARCHAR(36) PRIMARY KEY,
		tenant_id VARCHAR(36) NOT NULL,
		Project_id VARCHAR(36),
		name VARCHAR(255) NOT NULL,
		description TEXT,
		trigger_type VARCHAR(50) DEFAULT 'manual',
		status VARCHAR(20) DEFAULT 'active',
		version INTEGER DEFAULT 1,
		yaml_definition TEXT,
		spec JSONB,
		config JSONB,
		created_by VARCHAR(36),
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	)`
	_, err := db.Exec(stmt)
	return err
}

// cleanupPipelineTables removes all rows from pipelines.
func cleanupPipelineTables(ctx context.Context, db *sqlx.DB) error {
	_, err := db.ExecContext(ctx, `DELETE FROM pipelines`)
	return err
}

// TestPipelineRepository_Crud verifies the full CRUD lifecycle of Pipeline
// using the real pipeline repository against PostgreSQL.
func TestPipelineRepository_Crud(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup pipeline tables: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create
	createReq := models.CreatePipelineRequest{
		ProjectID:      "proj-1",
		Name:           "integration-test-pipeline",
		Description:    "A pipeline created by integration test",
		TriggerType:    "webhook",
		YamlDefinition: `steps: [{ name: build }]`,
		Version:        1,
	}
	pipeline, err := repo.Create(ctx, "tenant1", createReq)
	if err != nil {
		t.Fatalf("repo.Create: %v", err)
	}
	if pipeline.Name != "integration-test-pipeline" {
		t.Errorf("Create: expected name=integration-test-pipeline, got %s", pipeline.Name)
	}
	if pipeline.Status != models.PipelineStatusActive {
		t.Errorf("Create: expected status=active, got %s", pipeline.Status)
	}
	if pipeline.Version != 1 {
		t.Errorf("Create: expected version=1, got %d", pipeline.Version)
	}

	// Verify spec is JSON
	var specMap map[string]interface{}
	if err := json.Unmarshal([]byte(pipeline.Spec), &specMap); err != nil {
		t.Fatalf("expected valid JSON spec, got: %v", err)
	}

	// GetByID
	found, err := repo.GetByID(ctx, "tenant1", pipeline.ID)
	if err != nil {
		t.Fatalf("repo.GetByID: %v", err)
	}
	if found.ID != pipeline.ID {
		t.Errorf("GetByID: expected id=%s, got %s", pipeline.ID, found.ID)
	}

	// GetByID with wrong tenant should fail
	_, err = repo.GetByID(ctx, "other-tenant", pipeline.ID)
	if err == nil {
		t.Fatalf("GetByID with wrong tenant: expected error, got nil")
	}

	// GetByID non-existent
	_, err = repo.GetByID(ctx, "tenant1", "non-existent-id")
	if err == nil {
		t.Fatalf("GetByID non-existent: expected error, got nil")
	}

	// Update
	desc := "updated description"
	updateReq := models.UpdatePipelineRequest{
		Description: &desc,
	}
	updated, err := repo.Update(ctx, "tenant1", pipeline.ID, updateReq)
	if err != nil {
		t.Fatalf("repo.Update: %v", err)
	}
	if updated.Description != desc {
		t.Errorf("Update: expected description=%s, got %s", desc, updated.Description)
	}

	// Delete
	deleted, err := repo.Delete(ctx, "tenant1", pipeline.ID)
	if err != nil {
		t.Fatalf("repo.Delete: %v", err)
	}
	if !deleted {
		t.Errorf("Delete: expected true, got false")
	}

	// Verify deleted
	_, err = repo.GetByID(ctx, "tenant1", pipeline.ID)
	if err == nil {
		t.Fatalf("expected error after delete, got nil")
	}
}

// TestPipelineRepository_List verifies the List method with pagination and filtering.
func TestPipelineRepository_List(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create 5 pipelines
	for i := 0; i < 5; i++ {
		_, _ = repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
			Name:        fmt.Sprintf("pipe-%d", i),
			Description: "test pipeline",
			Version:     1,
		})
	}

	// List all
	all, total, err := repo.List(ctx, "tenant1", models.ListPipelinesOptions{
		Page: 1,
		Limit: 20,
	})
	if err != nil {
		t.Fatalf("repo.List: %v", err)
	}
	if len(all) != 5 {
		t.Errorf("List: expected 5 pipelines, got %d", len(all))
	}
	if total != 5 {
		t.Errorf("List: expected total=5, got %d", total)
	}

	// Pagination: page 1 with limit 2
	page1, _, err := repo.List(ctx, "tenant1", models.ListPipelinesOptions{
		Page: 1,
		Limit: 2,
	})
	if err != nil {
		t.Fatalf("repo.List page 1: %v", err)
	}
	if len(page1) != 2 {
		t.Errorf("List page 1: expected 2, got %d", len(page1))
	}

	// Filter by name prefix
	filtered, _, err := repo.List(ctx, "tenant1", models.ListPipelinesOptions{
		Name: "pipe-0",
	})
	if err != nil {
		t.Fatalf("repo.List filter: %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("List filter: expected 1, got %d", len(filtered))
	}
}

// TestPipelineRepository_GetStats verifies the GetStats method.
func TestPipelineRepository_GetStats(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create 2 active pipelines
	_, _ = repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name:        "active-pipe-1",
		Description: "test",
		Version:     1,
	})
	_, _ = repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name:        "active-pipe-2",
		Description: "test",
		Version:     1,
	})

	stats, err := repo.GetStats(ctx, "tenant1", "")
	if err != nil {
		t.Fatalf("repo.GetStats: %v", err)
	}
	if stats.TotalRuns != 2 {
		t.Errorf("GetStats: expected totalRuns=2, got %d", stats.TotalRuns)
	}
	if stats.TotalRuns != 2 {
		t.Errorf("GetStats: expected totalRuns=2, got %d", stats.TotalRuns)
	}
}

// TestPipelineRepository_GetVersions verifies the GetVersions method.
func TestPipelineRepository_GetVersions(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create pipeline
	pipe, err := repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name:        "version-test-pipe",
		Description: "test versions",
		Version:     1,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Get versions for this pipeline
	versions, err := repo.GetVersions(ctx, "tenant1", pipe.ID)
	if err != nil {
		t.Fatalf("GetVersions: %v", err)
	}
	if len(versions) == 0 {
		t.Errorf("GetVersions: expected at least 1 version, got 0")
	}
}

// TestPipelineRepository_InvalidYaml tests that Create handles YAML gracefully.
func TestPipelineRepository_InvalidYaml(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create with empty yaml (should still succeed)
	pipe, err := repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name: "no-yaml-pipe",
	})
	if err != nil {
		t.Fatalf("Create without yaml: %v", err)
	}
	if pipe.YamlDefinition != "" {
		t.Errorf("expected empty yaml, got %s", pipe.YamlDefinition)
	}
	_ = pipe
}

// TestPipelineRepository_DefaultValues verifies default status and trigger type.
func TestPipelineRepository_DefaultValues(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create with no explicit status or trigger type
	pipe, err := repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name: "defaults-test",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pipe.Status != models.PipelineStatusActive {
		t.Errorf("expected default status=active, got %s", pipe.Status)
	}
	if pipe.TriggerType != models.TriggerTypeManual {
		t.Errorf("expected default trigger=manual, got %s", pipe.TriggerType)
	}
	_ = pipe
}

// TestPipelineRepository_TenantIsolation verifies that pipelines are isolated by tenant.
func TestPipelineRepository_TenantIsolation(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create pipeline for tenant A
	pipeA, err := repo.Create(ctx, "tenant-a", models.CreatePipelineRequest{
		Name: "tenant-a-pipe",
	})
	if err != nil {
		t.Fatalf("Create tenant-a: %v", err)
	}

	// Create pipeline for tenant B
	pipeB, err := repo.Create(ctx, "tenant-b", models.CreatePipelineRequest{
		Name: "tenant-b-pipe",
	})
	if err != nil {
		t.Fatalf("Create tenant-b: %v", err)
	}

	// Verify tenant A can only see its own pipeline
	listA, _, err := repo.List(ctx, "tenant-a", models.ListPipelinesOptions{})
	if err != nil {
		t.Fatalf("List tenant-a: %v", err)
	}
	if len(listA) != 1 {
		t.Errorf("tenant-a: expected 1 pipeline, got %d", len(listA))
	}
	if listA[0].ID != pipeA.ID {
		t.Errorf("tenant-a: expected pipeA, got %s", listA[0].ID)
	}

	// Verify tenant B can only see its own pipeline
	listB, _, err := repo.List(ctx, "tenant-b", models.ListPipelinesOptions{})
	if err != nil {
		t.Fatalf("List tenant-b: %v", err)
	}
	if len(listB) != 1 {
		t.Errorf("tenant-b: expected 1 pipeline, got %d", len(listB))
	}
	if listB[0].ID != pipeB.ID {
		t.Errorf("tenant-b: expected pipeB, got %s", listB[0].ID)
	}

	// Tenant A should not be able to get tenant B's pipeline by ID
	_, err = repo.GetByID(ctx, "tenant-a", pipeB.ID)
	if err == nil {
		t.Errorf("tenant-a should not access tenant-b pipeline")
	}

	_ = pipeB
}

// TestPipelineRepository_VersionIncrement verifies that version is auto-set to 1 when not provided.
func TestPipelineRepository_VersionIncrement(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create without version
	pipe, err := repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name: "version-increment-test",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pipe.Version != 1 {
		t.Errorf("expected version=1, got %d", pipe.Version)
	}
	_ = pipe
}

// TestPipelineRepository_InvalidLimit tests pagination edge cases.
func TestPipelineRepository_InvalidLimit(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	// Create 3 pipelines
	for i := 0; i < 3; i++ {
		_, _ = repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
			Name: fmt.Sprintf("pipe-%d", i),
		})
	}

	// Limit 0 should default to 20 (all returned)
	all, _, err := repo.List(ctx, "tenant1", models.ListPipelinesOptions{Limit: 0})
	if err != nil {
		t.Fatalf("List limit=0: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("List limit=0: expected 3, got %d", len(all))
	}

	// Limit > 100 should default to 100 (still returns all 3)
	big, _, err := repo.List(ctx, "tenant1", models.ListPipelinesOptions{Limit: 200})
	if err != nil {
		t.Fatalf("List limit=200: %v", err)
	}
	if len(big) != 3 {
		t.Errorf("List limit=200: expected 3, got %d", len(big))
	}
}

// TestPipelineRepository_CreatedAt verifies that timestamps are set on create.
func TestPipelineRepository_CreatedAt(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupPipelineTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}
	defer func() { _ = cleanupPipelineTables(ctx, db) }()

	repo := pipeline_repo.NewRepository(db)

	before := time.Now()
	pipe, err := repo.Create(ctx, "tenant1", models.CreatePipelineRequest{
		Name: "timestamp-test",
	})
	after := time.Now()
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if pipe.CreatedAt.Before(before) || pipe.CreatedAt.After(after) {
		t.Errorf("CreatedAt %v is outside [before=%v, after=%v]", pipe.CreatedAt, before, after)
	}
	if pipe.UpdatedAt.IsZero() {
		t.Errorf("UpdatedAt should be set")
	}
	_ = pipe
}
