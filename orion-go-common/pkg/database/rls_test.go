//go:build integration
// +build integration

package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// RLS Integration Tests
// Run with: go test -tags=integration -run TestRLS -v ./pkg/database/
// Requires: PostgreSQL with SUPERUSER or CREATE privilege, ORION_TEST_DSN env var set.

var testDB *sqlx.DB

func TestMain(m *testing.M) {
	dsn := os.Getenv("ORION_TEST_DSN")
	if dsn == "" {
		dsn = "postgres://orion:orion@localhost:5432/orion_test?sslmode=disable"
	}

	var err error
	testDB, err = sqlx.Connect("postgres", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot connect to test DB: %v\n", err)
		os.Exit(1)
	}
	defer testDB.Close()

	os.Exit(m.Run())
}

// setupRLSTables creates temporary test tables with RLS enabled.
func setupRLSTables(t *testing.T) func() {
	t.Helper()
	ctx := context.Background()

	// Create helper function for tenant_id resolution
	_, err := testDB.ExecContext(ctx, `
		CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
		BEGIN
			RETURN current_setting('app.current_tenant_id', true)::UUID;
		EXCEPTION
			WHEN OTHERS THEN
				RETURN NULL;
		END;
		$$ LANGUAGE plpgsql STABLE;
	`)
	if err != nil {
		t.Fatalf("create helper function: %v", err)
	}

	// Create test tables
	tables := []string{"rls_test_jobs", "rls_test_secrets", "rls_test_deployments"}
	for _, tbl := range tables {
		_, err := testDB.ExecContext(ctx, fmt.Sprintf(`
			DROP TABLE IF EXISTS %s CASCADE;
			CREATE TABLE %s (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				tenant_id  UUID NOT NULL,
				name       TEXT NOT NULL,
				status     TEXT DEFAULT 'active',
				created_at TIMESTAMPTZ DEFAULT NOW()
			);
		`, tbl, tbl))
		if err != nil {
			t.Fatalf("create table %s: %v", tbl, err)
		}

		// Enable RLS
		_, err = testDB.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE %s ENABLE ROW LEVEL SECURITY;`, tbl))
		if err != nil {
			t.Fatalf("enable RLS on %s: %v", tbl, err)
		}

		// Force RLS (even for table owner)
		_, err = testDB.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE %s FORCE ROW LEVEL SECURITY;`, tbl))
		if err != nil {
			t.Fatalf("force RLS on %s: %v", tbl, err)
		}

		// Create policy
		_, err = testDB.ExecContext(ctx, fmt.Sprintf(`
			CREATE POLICY tenant_isolation_%s ON %s
				USING (tenant_id = current_tenant_id());
		`, tbl, tbl))
		if err != nil {
			t.Fatalf("create policy on %s: %v", tbl, err)
		}
	}

	// Cleanup function
	return func() {
		for _, tbl := range tables {
			_, _ = testDB.ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s CASCADE;`, tbl))
		}
		_, _ = testDB.ExecContext(ctx, `DROP FUNCTION IF EXISTS current_tenant_id();`)
	}
}

// setTenant sets the current tenant_id session variable.
func setTenant(t *testing.T, tenantID string) {
	t.Helper()
	_, err := testDB.Exec(`SET app.current_tenant_id = $1`, tenantID)
	if err != nil {
		t.Fatalf("set tenant_id: %v", err)
	}
}

// resetTenant clears the tenant_id session variable.
func resetTenant(t *testing.T) {
	t.Helper()
	_, err := testDB.Exec(`RESET app.current_tenant_id`)
	if err != nil {
		t.Fatalf("reset tenant_id: %v", err)
	}
}

// insertRow inserts a test row with explicit tenant_id.
func insertRow(t *testing.T, table, tenantID, name string) string {
	t.Helper()
	var id string
	err := testDB.QueryRow(
		fmt.Sprintf(`INSERT INTO %s (tenant_id, name) VALUES ($1, $2) RETURNING id`, table),
		tenantID, name,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert into %s: %v", table, err)
	}
	return id
}

const (
	tenantA = "11111111-1111-1111-1111-111111111111"
	tenantB = "22222222-2222-2222-2222-222222222222"
)

// TestRLS_SelectIsolation verifies that SELECT queries are filtered by tenant_id.
func TestRLS_SelectIsolation(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	// Insert data for both tenants
	insertRow(t, "rls_test_jobs", tenantA, "job-a-1")
	insertRow(t, "rls_test_jobs", tenantA, "job-a-2")
	insertRow(t, "rls_test_jobs", tenantB, "job-b-1")

	// Set tenant A and query
	setTenant(t, tenantA)
	var jobs []struct {
		ID   string `db:"id"`
		Name string `db:"name"`
	}
	err := testDB.SelectContext(ctx, &jobs, `SELECT id, name FROM rls_test_jobs ORDER BY name`)
	if err != nil {
		t.Fatalf("select as tenant A: %v", err)
	}
	if len(jobs) != 2 {
		t.Errorf("tenant A should see 2 jobs, got %d", len(jobs))
	}
	for _, j := range jobs {
		if j.Name[:6] != "job-a-" {
			t.Errorf("tenant A should not see %q", j.Name)
		}
	}

	// Set tenant B and query
	setTenant(t, tenantB)
	jobs = nil
	err = testDB.SelectContext(ctx, &jobs, `SELECT id, name FROM rls_test_jobs ORDER BY name`)
	if err != nil {
		t.Fatalf("select as tenant B: %v", err)
	}
	if len(jobs) != 1 {
		t.Errorf("tenant B should see 1 job, got %d", len(jobs))
	}
	if len(jobs) > 0 && jobs[0].Name != "job-b-1" {
		t.Errorf("tenant B should see job-b-1, got %q", jobs[0].Name)
	}
}

// TestRLS_NoTenantReturnsNothing verifies that without setting tenant_id, no rows are visible.
func TestRLS_NoTenantReturnsNothing(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	insertRow(t, "rls_test_secrets", tenantA, "secret-a")
	insertRow(t, "rls_test_secrets", tenantB, "secret-b")

	// Reset tenant (no tenant set)
	resetTenant(t)

	var count int
	err := testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_secrets`)
	if err != nil {
		t.Fatalf("count without tenant: %v", err)
	}
	if count != 0 {
		t.Errorf("without tenant_id set, should see 0 rows, got %d", count)
	}
}

// TestRLS_UpdateBlocked verifies that UPDATE cannot modify other tenant's rows.
func TestRLS_UpdateBlocked(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	jobBID := insertRow(t, "rls_test_jobs", tenantB, "job-b-original")

	// Set tenant A, try to update tenant B's row
	setTenant(t, tenantA)
	result, err := testDB.ExecContext(ctx,
		`UPDATE rls_test_jobs SET name = 'hacked' WHERE id = $1`, jobBID)
	if err != nil {
		t.Fatalf("update attempt: %v", err)
	}
	rows, _ := result.RowsAffected()
	if rows != 0 {
		t.Errorf("tenant A should not be able to update tenant B's row, affected %d rows", rows)
	}

	// Verify the row is unchanged
	setTenant(t, tenantB)
	var name string
	err = testDB.GetContext(ctx, &name, `SELECT name FROM rls_test_jobs WHERE id = $1`, jobBID)
	if err != nil {
		t.Fatalf("verify unchanged: %v", err)
	}
	if name != "job-b-original" {
		t.Errorf("row should be unchanged, got %q", name)
	}
}

// TestRLS_DeleteBlocked verifies that DELETE cannot remove other tenant's rows.
func TestRLS_DeleteBlocked(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	secretBID := insertRow(t, "rls_test_secrets", tenantB, "secret-b")

	// Set tenant A, try to delete tenant B's row
	setTenant(t, tenantA)
	result, err := testDB.ExecContext(ctx,
		`DELETE FROM rls_test_secrets WHERE id = $1`, secretBID)
	if err != nil {
		t.Fatalf("delete attempt: %v", err)
	}
	rows, _ := result.RowsAffected()
	if rows != 0 {
		t.Errorf("tenant A should not be able to delete tenant B's row, affected %d rows", rows)
	}

	// Verify the row still exists under tenant B
	setTenant(t, tenantB)
	var count int
	err = testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_secrets WHERE id = $1`, secretBID)
	if err != nil {
		t.Fatalf("verify exists: %v", err)
	}
	if count != 1 {
		t.Errorf("row should still exist, count=%d", count)
	}
}

// TestRLS_InsertWithWrongTenantID verifies that INSERT with wrong tenant_id still respects RLS on read.
func TestRLS_InsertWithWrongTenantID(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	// Set tenant A, but insert with tenant B's ID directly
	setTenant(t, tenantA)
	_, err := testDB.ExecContext(ctx,
		`INSERT INTO rls_test_deployments (tenant_id, name) VALUES ($1, $2)`,
		tenantB, "deploy-under-b")
	if err != nil {
		t.Fatalf("insert with explicit tenant_id: %v", err)
	}

	// As tenant A, should NOT see this row
	var count int
	err = testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_deployments`)
	if err != nil {
		t.Fatalf("count as tenant A: %v", err)
	}
	if count != 0 {
		t.Errorf("tenant A should not see tenant B's row, got %d", count)
	}

	// As tenant B, should see it
	setTenant(t, tenantB)
	err = testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_deployments`)
	if err != nil {
		t.Fatalf("count as tenant B: %v", err)
	}
	if count != 1 {
		t.Errorf("tenant B should see 1 deployment, got %d", count)
	}
}

// TestRLS_CrossTenantByID verifies that fetching by ID is also isolated.
func TestRLS_CrossTenantByID(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	jobAID := insertRow(t, "rls_test_jobs", tenantA, "job-a-private")
	jobBID := insertRow(t, "rls_test_jobs", tenantB, "job-b-private")

	// As tenant A, fetch own job — should succeed
	setTenant(t, tenantA)
	var name string
	err := testDB.GetContext(ctx, &name, `SELECT name FROM rls_test_jobs WHERE id = $1`, jobAID)
	if err != nil {
		t.Fatalf("fetch own job: %v", err)
	}
	if name != "job-a-private" {
		t.Errorf("expected job-a-private, got %q", name)
	}

	// As tenant A, fetch tenant B's job by ID — should fail (no rows)
	err = testDB.GetContext(ctx, &name, `SELECT name FROM rls_test_jobs WHERE id = $1`, jobBID)
	if err == nil {
		t.Error("fetching other tenant's job by ID should fail, but succeeded")
	}
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

// TestRLS_MultipleTablesIsolated verifies RLS works across different tables.
func TestRLS_MultipleTablesIsolated(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	// Insert into all tables for both tenants
	for _, tbl := range []string{"rls_test_jobs", "rls_test_secrets", "rls_test_deployments"} {
		insertRow(t, tbl, tenantA, tbl+"-a")
		insertRow(t, tbl, tenantB, tbl+"-b")
	}

	// As tenant A, each table should have exactly 1 row
	setTenant(t, tenantA)
	for _, tbl := range []string{"rls_test_jobs", "rls_test_secrets", "rls_test_deployments"} {
		var count int
		err := testDB.GetContext(ctx, &count, fmt.Sprintf(`SELECT COUNT(*) FROM %s`, tbl))
		if err != nil {
			t.Fatalf("count %s as tenant A: %v", tbl, err)
		}
		if count != 1 {
			t.Errorf("%s: tenant A should see 1 row, got %d", tbl, count)
		}
	}

	// As tenant B, each table should also have exactly 1 row
	setTenant(t, tenantB)
	for _, tbl := range []string{"rls_test_jobs", "rls_test_secrets", "rls_test_deployments"} {
		var count int
		err := testDB.GetContext(ctx, &count, fmt.Sprintf(`SELECT COUNT(*) FROM %s`, tbl))
		if err != nil {
			t.Fatalf("count %s as tenant B: %v", tbl, err)
		}
		if count != 1 {
			t.Errorf("%s: tenant B should see 1 row, got %d", tbl, count)
		}
	}
}

// TestRLS_BypassWithSuperuser verifies that FORCE RLS prevents even table owners from bypassing.
func TestRLS_BypassWithSuperuser(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	insertRow(t, "rls_test_jobs", tenantA, "job-a-force")

	// Without setting tenant, even the connection owner should see 0 rows
	// (because we used FORCE ROW LEVEL SECURITY)
	resetTenant(t)
	var count int
	err := testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_jobs`)
	if err != nil {
		t.Fatalf("count without tenant (force RLS): %v", err)
	}
	if count != 0 {
		t.Errorf("FORCE RLS should block even owner without tenant_id, got %d rows", count)
	}
}

// TestRLS_NullTenantID verifies that rows with NULL tenant_id are never visible.
func TestRLS_NullTenantID(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	// Insert a row with NULL tenant_id (bypassing the NOT NULL constraint for testing)
	// First, temporarily allow NULL
	_, err := testDB.ExecContext(ctx, `ALTER TABLE rls_test_jobs ALTER COLUMN tenant_id DROP NOT NULL`)
	if err != nil {
		t.Fatalf("alter column: %v", err)
	}

	_, err = testDB.ExecContext(ctx,
		`INSERT INTO rls_test_jobs (tenant_id, name) VALUES (NULL, 'orphan-job')`)
	if err != nil {
		t.Fatalf("insert null tenant: %v", err)
	}

	// Even as a valid tenant, NULL rows should not be visible
	setTenant(t, tenantA)
	var count int
	err = testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_jobs`)
	if err != nil {
		t.Fatalf("count with null row: %v", err)
	}
	if count != 0 {
		t.Errorf("NULL tenant_id rows should not be visible, got %d", count)
	}
}

// TestRLS_ConcurrentTenantSwitching simulates concurrent requests with different tenants.
func TestRLS_ConcurrentTenantSwitching(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	// Insert data for both tenants
	for i := 0; i < 10; i++ {
		insertRow(t, "rls_test_jobs", tenantA, fmt.Sprintf("job-a-%d", i))
		insertRow(t, "rls_test_jobs", tenantB, fmt.Sprintf("job-b-%d", i))
	}

	// Open separate connections for each tenant (simulating concurrent requests)
	connA, err := testDB.Conn(ctx)
	if err != nil {
		t.Fatalf("get conn A: %v", err)
	}
	defer connA.Close()

	connB, err := testDB.Conn(ctx)
	if err != nil {
		t.Fatalf("get conn B: %v", err)
	}
	defer connB.Close()

	// Set different tenants on each connection
	_, err = connA.ExecContext(ctx, `SET app.current_tenant_id = $1`, tenantA)
	if err != nil {
		t.Fatalf("set tenant A: %v", err)
	}
	_, err = connB.ExecContext(ctx, `SET app.current_tenant_id = $1`, tenantB)
	if err != nil {
		t.Fatalf("set tenant B: %v", err)
	}

	// Query concurrently
	errCh := make(chan error, 2)

	go func() {
		var count int
		err := connA.QueryRowContext(ctx, `SELECT COUNT(*) FROM rls_test_jobs`).Scan(&count)
		if err != nil {
			errCh <- fmt.Errorf("tenant A query: %w", err)
			return
		}
		if count != 10 {
			errCh <- fmt.Errorf("tenant A: expected 10, got %d", count)
			return
		}
		errCh <- nil
	}()

	go func() {
		var count int
		err := connB.QueryRowContext(ctx, `SELECT COUNT(*) FROM rls_test_jobs`).Scan(&count)
		if err != nil {
			errCh <- fmt.Errorf("tenant B query: %w", err)
			return
		}
		if count != 10 {
			errCh <- fmt.Errorf("tenant B: expected 10, got %d", count)
			return
		}
		errCh <- nil
	}()

	// Wait for both
	for i := 0; i < 2; i++ {
		if err := <-errCh; err != nil {
			t.Error(err)
		}
	}
}

// TestRLS_SessionVariablePersistence verifies tenant_id persists for the session.
func TestRLS_SessionVariablePersistence(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()
	insertRow(t, "rls_test_jobs", tenantA, "job-a-persist")

	setTenant(t, tenantA)

	// Multiple queries should all see the same tenant's data
	for i := 0; i < 5; i++ {
		var count int
		err := testDB.GetContext(ctx, &count, `SELECT COUNT(*) FROM rls_test_jobs`)
		if err != nil {
			t.Fatalf("query %d: %v", i, err)
		}
		if count != 1 {
			t.Errorf("query %d: expected 1, got %d", i, count)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// TestRLS_AdvisoryLockNotAffectedByRLS verifies that advisory locks work regardless of RLS.
func TestRLS_AdvisoryLockNotAffectedByRLS(t *testing.T) {
	cleanup := setupRLSTables(t)
	defer cleanup()

	ctx := context.Background()

	setTenant(t, tenantA)

	// Advisory locks should work fine
	var acquired bool
	err := testDB.GetContext(ctx, &acquired, `SELECT pg_try_advisory_lock($1)`, 12345)
	if err != nil {
		t.Fatalf("acquire lock: %v", err)
	}
	if !acquired {
		t.Error("should acquire lock")
	}

	var released bool
	err = testDB.GetContext(ctx, &released, `SELECT pg_advisory_unlock($1)`, 12345)
	if err != nil {
		t.Fatalf("release lock: %v", err)
	}
	if !released {
		t.Error("should release lock")
	}
}
