package repository

import (
	"context"
	"testing"

	"database/sql"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The model_custom_pricing table has tenant_id NOT NULL plus its own index, and
// the repo ships an otherwise-unused FindPricingsByTenant — so scoping was
// always the design. What the upsert/read/delete paths actually did was look up
// and rewrite rows by model_id alone. These tests pin the SQL text and the
// bound arguments: asserting on the returned row proves nothing, because the row
// comes back from this test's own mock fixture.

func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

func pricingRows(id, tenant, model string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "model_id", "input_price", "output_price", "tenant_id", "created_at", "updated_at",
	}).AddRow(id, model, 3.0, 15.0, tenant, now, now)
}

func pricingRowsWithPrices(id, tenant, model string, in, out float64) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "model_id", "input_price", "output_price", "tenant_id", "created_at", "updated_at",
	}).AddRow(id, model, in, out, tenant, now, now)
}

// The lookup must carry both predicates. model_id alone is what let a row owned
// by another tenant be returned here and then rewritten below.
func TestFindPricingByModelID_ScopesByTenant(t *testing.T) {
	r, mock := newMockRepo(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("tenant-a", "gpt-4").
		WillReturnRows(pricingRows("pricing-1", "tenant-a", "gpt-4"))

	p, err := r.FindPricingByModelID(context.Background(), "tenant-a", "gpt-4")
	if err != nil {
		t.Fatalf("FindPricingByModelID: %v", err)
	}
	if p == nil || p.ID != "pricing-1" || p.TenantID == nil || *p.TenantID != "tenant-a" {
		t.Errorf("unexpected row: %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The UPDATE is the destructive half: with WHERE id = $4 alone, a caller could
// rewrite another tenant's price while tenant_id on the row was left untouched.
// Pinning $5 is what makes that impossible.
func TestUpsertPricing_UpdateIsTenantScoped(t *testing.T) {
	r, mock := newMockRepo(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("tenant-a", "gpt-4").
		WillReturnRows(pricingRows("pricing-1", "tenant-a", "gpt-4"))
	mock.ExpectQuery(`UPDATE model_custom_pricing SET input_price = \$1, output_price = \$2, updated_at = \$3 WHERE id = \$4 AND tenant_id = \$5 RETURNING \*`).
		WithArgs(0.5, 2.0, sqlmock.AnyArg(), "pricing-1", "tenant-a").
		// RETURNING * hands back the row as stored, so the prices must be the
		// ones the UPDATE bound — not the pre-update fixture values.
		WillReturnRows(pricingRowsWithPrices("pricing-1", "tenant-a", "gpt-4", 0.5, 2.0))

	p, err := r.UpsertPricing(context.Background(), "tenant-a", "gpt-4", 0.5, 2.0)
	if err != nil {
		t.Fatalf("UpsertPricing: %v", err)
	}
	if p == nil || p.InputPrice != 0.5 || p.OutputPrice != 2.0 {
		t.Errorf("unexpected row: %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// A tenant with no row of its own must INSERT rather than fall through to a row
// that happens to share the model_id. model_id is not unique in this table, so
// any unscoped lookup is a coin flip.
func TestUpsertPricing_InsertsWhenTenantHasNoRow(t *testing.T) {
	r, mock := newMockRepo(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("tenant-b", "gpt-4").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`INSERT INTO model_custom_pricing \(id, model_id, input_price, output_price, tenant_id\) VALUES \(\$1, \$2, \$3, \$4, \$5\) RETURNING \*`).
		WithArgs(sqlmock.AnyArg(), "gpt-4", 1.0, 5.0, "tenant-b").
		WillReturnRows(pricingRows("pricing-new", "tenant-b", "gpt-4"))

	p, err := r.UpsertPricing(context.Background(), "tenant-b", "gpt-4", 1.0, 5.0)
	if err != nil {
		t.Fatalf("UpsertPricing: %v", err)
	}
	if p == nil || p.TenantID == nil || *p.TenantID != "tenant-b" {
		t.Errorf("row must land under the caller tenant, got %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestDeletePricingByModelID_ScopesByTenant(t *testing.T) {
	r, mock := newMockRepo(t)

	mock.ExpectExec(`DELETE FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2`).
		WithArgs("tenant-a", "gpt-4").
		WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := r.DeletePricingByModelID(context.Background(), "tenant-a", "gpt-4")
	if err != nil {
		t.Fatalf("DeletePricingByModelID: %v", err)
	}
	if !ok {
		t.Error("expected the delete to report a match")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// Empty tenant must not silently match every row: with an unscoped predicate a
// blank tenant would be the widest possible delete.
func TestDeletePricingByModelID_EmptyTenantStillBinds(t *testing.T) {
	r, mock := newMockRepo(t)

	mock.ExpectExec(`DELETE FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2`).
		WithArgs("", "gpt-4").
		WillReturnResult(sqlmock.NewResult(0, 0))

	if _, err := r.DeletePricingByModelID(context.Background(), "", "gpt-4"); err != nil {
		t.Fatalf("DeletePricingByModelID: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations (empty tenant must bind an empty string, not vanish): %v", err)
	}
}
