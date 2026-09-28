package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode"

	"orion/platform-svc-go/internal/governance/governance/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestServiceErrors(t *testing.T) {
	if ErrPolicyNotFound.Error() != "policy not found" {
		t.Errorf("unexpected: %s", ErrPolicyNotFound.Error())
	}
}

// The repository SQL uses `col = $1` with spaces, so literal matching fails.
// Collapse whitespace before comparing; `$1` and `*` stay literal.
func newTestService(t *testing.T) (sqlmock.Sqlmock, *Service) {
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
	return mock, NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")))
}

// Every method in this service is a one-line passthrough. Pinning the arguments
// here is what stops a future edit from reinterpreting the pagination window at
// this layer: the handler owns the floor and the cap, so the service must not
// add a second one.
func TestServiceList_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 200, 100).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	policies, err := svc.List(context.Background(), "tenant-1", 200, 100)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(policies) != 0 {
		t.Errorf("len(policies) = %d, want 0", len(policies))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The repository computes a real COUNT(*) on every List and the service throws
// the total away. The count query still runs, so it costs the same as keeping
// the total; only the response shape differs.
func TestServiceList_DropsTheTotalTheRepositoryComputed(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(99))
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	if _, err := svc.List(context.Background(), "tenant-1", 0, 20); err != nil {
		t.Fatalf("List: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// Count is not a dedicated query: it calls List with an empty window, so it runs
// the COUNT and then a SELECT that nobody reads. Pinning the (0, 0) window is
// what makes a change to that call visible.
func TestServiceCount_ReturnsTheTotalOnly(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	total, err := svc.Count(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if total != 7 {
		t.Errorf("total = %d, want 7", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The service passes the repository's nil straight through; the handler is the
// layer that turns it into an empty slice.
func TestServiceList_PassesANilSliceThrough(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	policies, err := svc.List(context.Background(), "tenant-1", 0, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if policies != nil {
		t.Errorf("policies = %v, want nil", policies)
	}
}
