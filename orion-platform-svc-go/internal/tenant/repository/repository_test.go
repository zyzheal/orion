package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_NewRepository_ReturnsNonNil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("repo should never be nil")
	}
}

func Test_NewRepository_SameType(t *testing.T) {
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("each NewRepository call should return a distinct instance")
	}
}

func TestCascadeDeleteTenant_CascadesCoreTablesInTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectBegin()
	for _, tbl := range cascadeDeleteTables {
		mock.ExpectExec(`DELETE FROM ` + tbl + ` WHERE tenant_id = \$1`).
			WithArgs("t-1").
			WillReturnResult(sqlmock.NewResult(0, 3))
	}
	mock.ExpectExec(`DELETE FROM tenants WHERE id = \$1`).
		WithArgs("t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := r.CascadeDeleteTenant(context.Background(), "t-1"); err != nil {
		t.Fatalf("CascadeDeleteTenant: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCascadeDeleteTenant_RollbackOnChildFailure(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectBegin()
	// First child table succeeds, second fails.
	mock.ExpectExec(`DELETE FROM ` + cascadeDeleteTables[0] + ` WHERE tenant_id = \$1`).
		WithArgs("t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`DELETE FROM ` + cascadeDeleteTables[1] + ` WHERE tenant_id = \$1`).
		WithArgs("t-1").
		WillReturnError(errors.New("constraint violation"))
	mock.ExpectRollback()

	err = r.CascadeDeleteTenant(context.Background(), "t-1")
	if err == nil {
		t.Fatal("expected error when a child table delete fails")
	}
	if err.Error() != "cascade delete "+cascadeDeleteTables[1]+": constraint violation" {
		t.Errorf("err = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCascadeDeleteTenant_DeletesTenantRowLast(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectBegin()
	for _, tbl := range cascadeDeleteTables {
		mock.ExpectExec(`DELETE FROM ` + tbl + ` WHERE tenant_id = \$1`).
			WithArgs("t-2").
			WillReturnResult(sqlmock.NewResult(0, 0))
	}
	mock.ExpectExec(`DELETE FROM tenants WHERE id = \$1`).
		WithArgs("t-2").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := r.CascadeDeleteTenant(context.Background(), "t-2"); err != nil {
		t.Fatalf("CascadeDeleteTenant: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCascadeDeleteTenant_AllChildTablesIncluded(t *testing.T) {
	if len(cascadeDeleteTables) != 6 {
		t.Fatalf("cascadeDeleteTables len = %d, want 6 core tables", len(cascadeDeleteTables))
	}
	want := []string{"audit_logs", "cmdb_cis", "tickets", "pipelines", "users", "alerts"}
	for i, tbl := range want {
		if cascadeDeleteTables[i] != tbl {
			t.Errorf("cascadeDeleteTables[%d] = %q, want %q", i, cascadeDeleteTables[i], tbl)
		}
	}
}
