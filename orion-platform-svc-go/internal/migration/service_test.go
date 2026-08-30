package migration

import (
	"context"
	"testing"

	"go.uber.org/zap"
)

func setupService(t *testing.T) (*Service, *Repository) {
	t.Helper()
	logger, _ := zap.NewDevelopment()
	repo := NewRepository()
	svc := NewService(repo, logger)
	return svc, repo
}

func TestCreatePlan(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	input := CreatePlanInput{
		Name: "Test Migration",
		Type: MigrationSchema,
		Source: MigrationEndpoint{
			Name: "source-db",
			Host: "10.0.1.10",
			Port: 5432,
			Database: "prod_db",
		},
		Target: MigrationEndpoint{
			Name: "target-db",
			Host: "10.0.2.20",
			Port: 5432,
			Database: "new_db",
		},
		Direction: DirectionForward,
	}

	plan, err := svc.CreatePlan(ctx, input)
	if err != nil {
		t.Fatalf("CreatePlan failed: %v", err)
	}
	if plan.ID == "" {
		t.Fatal("expected non-empty ID")
	}
	if plan.Name != "Test Migration" {
		t.Fatalf("expected name 'Test Migration', got '%s'", plan.Name)
	}
	if plan.Phase() != "" {
		t.Fatalf("expected empty initial phase, got %q", plan.Phase())
	}
	if plan.CreatedAt.IsZero() {
		t.Fatal("expected non-zero CreatedAt")
	}
}

func TestCreatePlanEmptyName(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	_, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "",
		Type: MigrationSchema,
	})
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestCreatePlanDefaultBatchSize(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Batch Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})
	if err != nil {
		t.Fatalf("CreatePlan failed: %v", err)
	}
	if plan.BatchSize != 100 {
		t.Fatalf("expected default batch size 100, got %d", plan.BatchSize)
	}
}

func TestGetPlan(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	created, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "GetPlan Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	plan, err := svc.GetPlan(ctx, "", created.ID)
	if err != nil {
		t.Fatalf("GetPlan failed: %v", err)
	}
	if plan.ID != created.ID {
		t.Fatalf("expected ID %s, got %s", created.ID, plan.ID)
	}
}

func TestGetPlanNotFound(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	_, err := svc.GetPlan(ctx, "", "nonexistent")
	if err == nil {
		t.Fatal("expected error for non-existent plan")
	}
}

func TestListPlans(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Plan 1",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})
	svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Plan 2",
		Type: MigrationData,
		Source: MigrationEndpoint{Host: "10.0.3.30", Port: 8080},
		Target: MigrationEndpoint{Host: "10.0.4.40", Port: 8080},
		Direction: DirectionRollback,
	})

	plans, err := svc.ListPlans(ctx, "")
	if err != nil {
		t.Fatalf("ListPlans failed: %v", err)
	}
	if len(plans) != 2 {
		t.Fatalf("expected 2 plans, got %d", len(plans))
	}
}

func TestUpdatePlan(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	created, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Update Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		BatchSize: 100,
	})

	name := "Updated Name"
	batch := 500
	updated, err := svc.UpdatePlan(ctx, "", created.ID, UpdatePlanInput{
		Name: &name,
		BatchSize: &batch,
	})
	if err != nil {
		t.Fatalf("UpdatePlan failed: %v", err)
	}
	if updated.Name != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got '%s'", updated.Name)
	}
	if updated.BatchSize != 500 {
		t.Fatalf("expected batch size 500, got %d", updated.BatchSize)
	}
}

func TestDeletePlan(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	created, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Delete Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	if err := svc.DeletePlan(ctx, "", created.ID); err != nil {
		t.Fatalf("DeletePlan failed: %v", err)
	}

	_, err := svc.GetPlan(ctx, "", created.ID)
	if err == nil {
		t.Fatal("expected error after deletion")
	}
}

func TestExecute(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Execute Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{
			"CREATE TABLE users (id SERIAL PRIMARY KEY)",
			"INSERT INTO users (name) VALUES ('test')",
		},
	})

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected status 'success', got '%s': %s", result.Status, result.Error)
	}
	if result.Steps != 2 {
		t.Fatalf("expected 2 steps, got %d", result.Steps)
	}
	if result.StepsOK != 2 {
		t.Fatalf("expected 2 ok steps, got %d", result.StepsOK)
	}
	if result.Phase != PhaseCompleted {
		t.Fatalf("expected phase completed, got %s", result.Phase)
	}

	phase, err := svc.GetPlanPhase(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetPlanPhase failed: %v", err)
	}
	if phase != PhaseCompleted {
		t.Fatalf("expected phase completed, got %s", phase)
	}
}

func TestExecuteAlreadyCompleted(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Already Completed",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1"},
	})

	_, _ = svc.Execute(ctx, "", plan.ID)

	_, err := svc.Execute(ctx, "", plan.ID)
	if err == nil {
		t.Fatal("expected error when executing completed plan")
	}
}

func TestValidate(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Validate Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"CREATE TABLE test (id INT)"},
	})

	result, err := svc.Validate(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Validate failed: %v", err)
	}
	if result.Status != "validated" {
		t.Fatalf("expected status 'validated', got '%s': %s", result.Status, result.Error)
	}
}

func TestValidateNoStatements(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Validate No SQL",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	result, err := svc.Validate(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Validate failed: %v", err)
	}
	if result.Status != "invalid" {
		t.Fatalf("expected status 'invalid', got '%s'", result.Status)
	}
}

func TestRollback(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Rollback Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"CREATE TABLE test (id INT)"},
	})

	_, _ = svc.Execute(ctx, "", plan.ID)

	result, err := svc.Rollback(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected rollback success, got: %s", result.Error)
	}
	if result.Phase != PhaseRolledBack {
		t.Fatalf("expected phase rolled_back, got %s", result.Phase)
	}

	phase, err := svc.GetPlanPhase(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetPlanPhase failed: %v", err)
	}
	if phase != PhaseRolledBack {
		t.Fatalf("expected phase rolled_back, got %s", phase)
	}
}

func TestRollbackNotCompleted(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Rollback Not Completed",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1"},
	})

	_, err := svc.Rollback(ctx, "", plan.ID)
	if err == nil {
		t.Fatal("expected error when rolling back non-completed plan")
	}
}

func TestSchemaDiff(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "SchemaDiff Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Name: "source-db", Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Name: "target-db", Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"CREATE TABLE test (id INT)"},
	})

	diff, err := svc.SchemaDiff(ctx, plan.ID)
	if err != nil {
		t.Fatalf("SchemaDiff failed: %v", err)
	}
	if diff.SourceEndpoint != "source-db" {
		t.Fatalf("expected source endpoint 'source-db', got '%s'", diff.SourceEndpoint)
	}
	if diff.TargetEndpoint != "target-db" {
		t.Fatalf("expected target endpoint 'target-db', got '%s'", diff.TargetEndpoint)
	}
	if len(diff.Additions) == 0 {
		t.Fatal("expected at least one addition in diff")
	}
}

func TestSchemaDiffRollback(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "SchemaDiff Rollback",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Name: "source-db", Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Name: "target-db", Host: "10.0.2.20", Port: 5432},
		Direction: DirectionRollback,
	})

	diff, err := svc.SchemaDiff(ctx, plan.ID)
	if err != nil {
		t.Fatalf("SchemaDiff failed: %v", err)
	}
	if len(diff.Removals) == 0 {
		t.Fatal("expected at least one removal in rollback diff")
	}
}

func TestGetSteps(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Steps Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1", "SELECT 2"},
	})

	_, _ = svc.Execute(ctx, "", plan.ID)

	steps, err := svc.GetSteps(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetSteps failed: %v", err)
	}
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(steps))
	}
}

func TestGetStats(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Stats Plan 1",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1"},
	})

	stats := svc.GetStats(ctx)
	if stats.TotalPlans < 1 {
		t.Fatalf("expected at least 1 plan, got %d", stats.TotalPlans)
	}
}

func TestGetPlanPhase(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "Phase Test",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	phase, err := svc.GetPlanPhase(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetPlanPhase failed: %v", err)
	}
	if phase != "" {
		t.Fatalf("expected empty phase for new plan, got %q", phase)
	}
}

func TestTenantIsolation(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	svc.CreatePlan(ctx, CreatePlanInput{
		TenantID: "tenant-a",
		Name: "Tenant A Plan",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	// Access with wrong tenant should fail
	_, err := svc.GetPlan(ctx, "tenant-b", "nonexistent")
	if err == nil {
		t.Fatal("expected error for wrong tenant")
	}
}

func TestExecuteWithNoStatements(t *testing.T) {
	svc, _ := setupService(t)
	ctx := context.Background()

	plan, _ := svc.CreatePlan(ctx, CreatePlanInput{
		Name: "No Statements",
		Type: MigrationSchema,
		Source: MigrationEndpoint{Host: "10.0.1.10", Port: 5432},
		Target: MigrationEndpoint{Host: "10.0.2.20", Port: 5432},
		Direction: DirectionForward,
	})

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected success, got: %s", result.Error)
	}
	if result.Steps != 0 {
		t.Fatalf("expected 0 steps, got %d", result.Steps)
	}
}
