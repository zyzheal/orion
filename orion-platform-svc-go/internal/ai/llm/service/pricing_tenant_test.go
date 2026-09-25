package service

import (
	"context"
	"testing"

	"database/sql"
	"time"

	"orion/platform-svc-go/internal/ai/llm/models"
	"orion/platform-svc-go/internal/ai/llm/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The handler fetches the auth tenant and also binds the body. This test drives
// the service through a mocked repository so the tenant that actually reaches the
// SQL is observable — the returned row is not, since this test's fixture owns it.
func newMockSvc(t *testing.T) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres"))), mock
}

func tenantPriceRows(id, tenant, model string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "model_id", "input_price", "output_price", "tenant_id", "created_at", "updated_at",
	}).AddRow(id, model, 1.0, 5.0, tenant, now, now)
}

// The body carries tenantId and the auth tenant is different. The write must
// bind the auth tenant: before the fix SetCustomPricing derived its tenant
// entirely from the body, so any llm:write holder could set the price another
// tenant bills against.
func TestSetCustomPricing_UsesCallerTenantNotRequestBody(t *testing.T) {
	svc, mock := newMockSvc(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("auth-tenant", "gpt-4").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`INSERT INTO model_custom_pricing \(id, model_id, input_price, output_price, tenant_id\) VALUES \(\$1, \$2, \$3, \$4, \$5\) RETURNING \*`).
		WithArgs(sqlmock.AnyArg(), "gpt-4", 0.5, 2.5, "auth-tenant").
		WillReturnRows(tenantPriceRows("pricing-1", "auth-tenant", "gpt-4"))

	p, err := svc.SetCustomPricing(context.Background(), "auth-tenant", &models.SetPricingRequest{
		ModelID:     "gpt-4",
		InputPrice:  0.5,
		OutputPrice: 2.5,
		TenantID:    "attacker-supplied-tenant",
	})
	if err != nil {
		t.Fatalf("SetCustomPricing: %v", err)
	}
	if p == nil || p.TenantID == nil || *p.TenantID != "auth-tenant" {
		t.Errorf("pricing must be stored under the caller tenant, got %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations (tenant_id must be the auth tenant, not the body's): %v", err)
	}
}

// A body tenant must not be able to redirect the upsert onto another tenant's
// existing row either: the scoped lookup has to run with the auth tenant, or the
// caller would be rewriting whichever row shares the model_id.
func TestSetCustomPricing_LookupIsCallerScoped(t *testing.T) {
	svc, mock := newMockSvc(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("auth-tenant", "gpt-4").
		WillReturnRows(tenantPriceRows("pricing-1", "auth-tenant", "gpt-4"))
	mock.ExpectQuery(`UPDATE model_custom_pricing SET input_price = \$1, output_price = \$2, updated_at = \$3 WHERE id = \$4 AND tenant_id = \$5 RETURNING \*`).
		WithArgs(0.1, 0.2, sqlmock.AnyArg(), "pricing-1", "auth-tenant").
		WillReturnRows(tenantPriceRows("pricing-1", "auth-tenant", "gpt-4"))

	if _, err := svc.SetCustomPricing(context.Background(), "auth-tenant", &models.SetPricingRequest{
		ModelID: "gpt-4", InputPrice: 0.1, OutputPrice: 0.2,
		TenantID: "attacker-supplied-tenant",
	}); err != nil {
		t.Fatalf("SetCustomPricing: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// An empty auth tenant stays empty rather than falling back to the body. Filling
// it would reopen the same hole for anonymous callers.
func TestSetCustomPricing_EmptyCallerTenantStaysEmpty(t *testing.T) {
	svc, mock := newMockSvc(t)

	mock.ExpectQuery(`SELECT \* FROM model_custom_pricing WHERE tenant_id = \$1 AND model_id = \$2 LIMIT 1`).
		WithArgs("", "gpt-4").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`INSERT INTO model_custom_pricing \(id, model_id, input_price, output_price, tenant_id\) VALUES \(\$1, \$2, \$3, \$4, \$5\) RETURNING \*`).
		WithArgs(sqlmock.AnyArg(), "gpt-4", 1.0, 5.0, "").
		WillReturnRows(tenantPriceRows("pricing-1", "", "gpt-4"))

	if _, err := svc.SetCustomPricing(context.Background(), "", &models.SetPricingRequest{
		ModelID: "gpt-4", InputPrice: 1.0, OutputPrice: 5.0,
		TenantID: "attacker-supplied-tenant",
	}); err != nil {
		t.Fatalf("SetCustomPricing: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations (empty caller tenant must not be backfilled from the body): %v", err)
	}
}
