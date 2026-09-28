package repository

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode"

	"orion/platform-svc-go/internal/governance/governance/models"

	"database/sql"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Several SQL strings in this repository are backtick literals spread over two
// lines. Comparing them literally means typing a newline and a tab into the
// expectation, so the matcher below collapses every whitespace run to a single
// space before comparing. `$1` and `*` stay literal: nothing needs escaping.
func newMockDB(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	collapse := func(s string) string {
		var b strings.Builder
		seenSpace := false
		for _, r := range s {
			if unicode.IsSpace(r) {
				if !seenSpace {
					b.WriteByte(' ')
				}
				seenSpace = true
			} else {
				b.WriteRune(r)
				seenSpace = false
			}
		}
		return strings.TrimSpace(b.String())
	}
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
		func(expected, actual string) error {
			if collapse(expected) != collapse(actual) {
				return errors.New("sql does not match: " + actual)
			}
			return nil
		})))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	return mock, NewRepository(sqlx.NewDb(db, "sqlmock"))
}

func ts() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }

func policyColumns() []string {
	return []string{"id", "tenant_id", "name", "description", "category", "rego_path",
		"gate_id", "severity", "enabled", "metadata", "created_at", "updated_at"}
}

const policySelect = "SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3"

// The bind order is asserted, not just the bind count: Postgres happily runs a
// query with offset and limit swapped and the driver never complains. Only an
// order-sensitive WithArgs sees it.
func TestListPolicies_BindsTenantOffsetAndLimit(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(41))
	mock.ExpectQuery(policySelect).
		WithArgs("tenant-1", 50, 25).
		WillReturnRows(sqlmock.NewRows(policyColumns()))
	items, total, err := repo.ListPolicies(context.Background(), "tenant-1", 50, 25)
	if err != nil {
		t.Fatalf("ListPolicies: %v", err)
	}
	if total != 41 {
		t.Errorf("total = %d, want 41", total)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// A nil slice here is indistinguishable from an empty slice only to the caller,
// not to the client: JSON renders nil as `null`. The handler guards for it.
func TestListPolicies_EmptyTableYieldsZeroRows(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(policySelect).
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows(policyColumns()))
	items, total, err := repo.ListPolicies(context.Background(), "tenant-1", 0, 20)
	if err != nil {
		t.Fatalf("ListPolicies: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
}

func TestListPolicies_PropagatesTheDriverError(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery(policySelect).
		WithArgs("tenant-1", 0, 20).
		WillReturnError(errors.New("connection refused"))
	items, total, err := repo.ListPolicies(context.Background(), "tenant-1", 0, 20)
	if err == nil {
		t.Fatalf("ListPolicies returned nil error")
	}
	if items != nil {
		t.Errorf("items = %v, want nil", items)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
}

// If the COUNT fails the whole call must fail rather than report zero.
func TestListPolicies_CountFailureFailsTheCall(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WillReturnError(errors.New("no such table"))
	items, total, err := repo.ListPolicies(context.Background(), "tenant-1", 0, 20)
	if err == nil {
		t.Fatalf("ListPolicies returned nil error")
	}
	if items != nil || total != 0 {
		t.Errorf("items=%v total=%d, want nil 0", items, total)
	}
}

// Documenting the behaviour, not blessing it: a missing policy comes back as
// (nil, nil), so the handler answers 200 with `data: null` instead of 404.
func TestGetPolicyByID_NoRowYieldsNilNotAnError(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE id = $1 AND tenant_id = $2").
		WithArgs("missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)
	p, err := repo.GetPolicyByID(context.Background(), "tenant-1", "missing")
	if err != nil {
		t.Fatalf("GetPolicyByID: %v", err)
	}
	if p != nil {
		t.Errorf("policy = %v, want nil", p)
	}
}

func TestGetPolicyByID_BindsTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE id = $1 AND tenant_id = $2").
		WithArgs("p-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows(policyColumns()).
			AddRow("p-1", "tenant-1", "n1", nil, "security", "r.rego", nil, "block",
				true, "{}", ts(), ts()))
	p, err := repo.GetPolicyByID(context.Background(), "tenant-1", "p-1")
	if err != nil {
		t.Fatalf("GetPolicyByID: %v", err)
	}
	if p == nil || p.TenantID != "tenant-1" || p.Category != "security" {
		t.Errorf("policy = %+v", p)
	}
}

func TestDelete_BindsTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectExec("DELETE FROM policy_definitions WHERE id = $1 AND tenant_id = $2").
		WithArgs("p-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	ok, err := repo.DeletePolicy(context.Background(), "tenant-1", "p-1")
	if err != nil {
		t.Fatalf("DeletePolicy: %v", err)
	}
	if !ok {
		t.Errorf("deleted = false, want true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestCreate_BindsEveryColumn(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectExec("INSERT INTO policy_definitions (id, tenant_id, name, description, category, rego_path, gate_id, severity, enabled, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)").
		WithArgs("p-1", "tenant-1", "n1", nil, "security", "r.rego", nil, "block",
			false, models.JSONB{"a": 1}).
		WillReturnResult(sqlmock.NewResult(0, 1))
	err := repo.CreatePolicy(context.Background(), &models.Policy{
		ID: "p-1", TenantID: "tenant-1", Name: "n1", Category: "security",
		RegoPath: "r.rego", Severity: "block", Enabled: false,
		Metadata: models.JSONB{"a": 1},
	})
	if err != nil {
		t.Fatalf("CreatePolicy: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
