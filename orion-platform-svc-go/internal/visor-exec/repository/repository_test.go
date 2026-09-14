package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against "UPDATE visor_exec_templates SET ..." cannot
// quietly satisfy a statement with a different SET clause. That is the whole
// point here: UpdateTemplate and UpdateCronJob used to ignore the caller's
// fields and always execute "SET updated_at = NOW()", and the exact matcher is
// what makes that regression fail instead of passing.
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

func TestUpdateTemplateWritesEveryRequestedColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	// The whitelist order is name, description, content, category, so a
	// request for name + content binds name to $1 and content to $2 regardless
	// of the order the service happened to fill the map in.
	mock.ExpectExec(normSQL(`UPDATE visor_exec_templates SET name = $1, content = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4`)).
		WithArgs("deploy.sh v2", "echo deploy", "tpl-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateTemplate(context.Background(), "tenant-1", "tpl-1", map[string]interface{}{
		"content": "echo deploy",
		"name":    "deploy.sh v2",
	})
	if err != nil {
		t.Fatalf("UpdateTemplate: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdateTemplateRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _ := mockDB(t)
	repo := NewRepository(db)

	err := repo.UpdateTemplate(context.Background(), "tenant-1", "tpl-1", map[string]interface{}{
		"password": "hunter2",
	})
	if err == nil {
		t.Fatal("an unknown column must not be silently dropped into an empty update")
	}
	if !strings.Contains(err.Error(), `column "password" is not updatable`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
}

func TestUpdateTemplateRejectsAnEmptyUpdate(t *testing.T) {
	db, _ := mockDB(t)
	repo := NewRepository(db)

	err := repo.UpdateTemplate(context.Background(), "tenant-1", "tpl-1", map[string]interface{}{})
	if err == nil {
		t.Fatal("an empty update must not be issued as an UPDATE")
	}
	// A "no expectation" error from sqlmock would satisfy err != nil and leave
	// this guard untested, so pin the message the guard itself produces.
	if !strings.Contains(err.Error(), "no column to update") {
		t.Fatalf("error %q does not come from the empty-update guard", err.Error())
	}
}

func TestUpdateCronJobRejectsAnEmptyUpdate(t *testing.T) {
	db, _ := mockDB(t)
	repo := NewRepository(db)

	err := repo.UpdateCronJob(context.Background(), "tenant-1", "job-1", map[string]interface{}{})
	if err == nil {
		t.Fatal("an empty update must not be issued as an UPDATE")
	}
	if !strings.Contains(err.Error(), "no column to update") {
		t.Fatalf("error %q does not come from the empty-update guard", err.Error())
	}
}

func TestUpdateTemplateReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	deadlock := errors.New("deadlock detected")

	mock.ExpectExec(normSQL(`UPDATE visor_exec_templates SET name = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`)).
		WithArgs("nope", "tpl-1", "tenant-1").
		WillReturnError(deadlock)

	err := repo.UpdateTemplate(context.Background(), "tenant-1", "tpl-1", map[string]interface{}{"name": "nope"})
	if err == nil {
		t.Fatal("a failed UPDATE must not be reported as success")
	}
	if !errors.Is(err, deadlock) {
		t.Fatalf("error %q is not the statement failure", err.Error())
	}
}

func TestUpdateCronJobWritesEveryRequestedColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`UPDATE visor_exec_cron_jobs SET command = $1, host_ids = $2, hostnames = $3, cron_expression = $4, enabled = $5, updated_at = NOW() WHERE id = $6 AND tenant_id = $7`)).
		WithArgs("kubectl drain", `["h1"]`, "h1,h2", "@reboot", true, "job-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateCronJob(context.Background(), "tenant-1", "job-1", map[string]interface{}{
		"enabled":         true,
		"cron_expression": "@reboot",
		"hostnames":       "h1,h2",
		"host_ids":        `["h1"]`,
		"command":         "kubectl drain",
	})
	if err != nil {
		t.Fatalf("UpdateCronJob: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

// last_run_at exists on the table but is written only by UpdateCronJobLastRun;
// letting it through the general update would let a caller backdate the run
// history that the cron scheduler reads to decide whether a job is overdue.
func TestUpdateCronJobRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _ := mockDB(t)
	repo := NewRepository(db)

	err := repo.UpdateCronJob(context.Background(), "tenant-1", "job-1", map[string]interface{}{
		"last_run_at": "2026-01-01T00:00:00Z",
	})
	if err == nil {
		t.Fatal("an unknown column must not be silently dropped into an empty update")
	}
	if !strings.Contains(err.Error(), `column "last_run_at" is not updatable`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
}

func TestUpdateCronJobReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	deadlock := errors.New("deadlock detected")

	mock.ExpectExec(normSQL(`UPDATE visor_exec_cron_jobs SET enabled = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`)).
		WithArgs(false, "job-1", "tenant-1").
		WillReturnError(deadlock)

	err := repo.UpdateCronJob(context.Background(), "tenant-1", "job-1", map[string]interface{}{"enabled": false})
	if err == nil {
		t.Fatal("a failed UPDATE must not be reported as success")
	}
	if !errors.Is(err, deadlock) {
		t.Fatalf("error %q is not the statement failure", err.Error())
	}
}

// The service fills these maps from a typed request, so map iteration order is
// not the caller's business. Going through the whitelist instead keeps the SQL
// and the binding order stable across runs.
func TestBuildWhitelistedSETNumberedAndInWhitelistOrder(t *testing.T) {
	clause, args, err := buildWhitelistedSET(map[string]interface{}{
		"category":    "db",
		"description": "rotate",
		"name":        "rotate.sql",
	}, templateUpdatable)
	if err != nil {
		t.Fatalf("buildWhitelistedSET: %v", err)
	}
	if clause != "name = $1, description = $2, category = $3" {
		t.Fatalf("unexpected SET clause %q", clause)
	}
	if len(args) != 3 || args[0] != "rotate.sql" || args[1] != "rotate" || args[2] != "db" {
		t.Fatalf("unexpected args %v", args)
	}

	if clause, args, _ = buildWhitelistedSET(map[string]interface{}{}, templateUpdatable); clause != "" || len(args) != 0 {
		t.Fatalf("an empty update must produce an empty clause, got %q %v", clause, args)
	}
}
