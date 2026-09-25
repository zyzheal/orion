package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/alert/models"
)

// fakeIngestRepo implements RepositoryInterface. seenTenants records every
// tenantID the service passed down, so a test can prove the lookup is scoped to
// the caller tenant and not the request body's. GetActiveMaintenanceWindows and
// GetActiveGroups return empty slices so Ingest skips suppression and dedup
// without panicking — checkSuppression type-asserts w.Scope.(string), and a
// window with a nil Scope interface value would panic there.
type fakeIngestRepo struct {
	seenTenants   []string
	created       *models.Alert
	knownIssueNil bool // GetKnownIssueByPattern returns (nil, nil) = no match
}

func (f *fakeIngestRepo) AddKnownIssue(ctx context.Context, ki *models.KnownIssue) error { return nil }
func (f *fakeIngestRepo) AddMaintenanceWindow(ctx context.Context, mw *models.MaintenanceWindow) error {
	return nil
}
func (f *fakeIngestRepo) CreateAlert(ctx context.Context, a *models.Alert) error {
	f.created = a
	return nil
}
func (f *fakeIngestRepo) DeleteAlert(ctx context.Context, tenantID, id string) error { return nil }
func (f *fakeIngestRepo) ExpireMaintenanceWindows(ctx context.Context, tenantID string) error {
	return nil
}
func (f *fakeIngestRepo) GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error) {
	f.seenTenants = append(f.seenTenants, tenantID)
	return nil, nil
}
func (f *fakeIngestRepo) GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error) {
	f.seenTenants = append(f.seenTenants, tenantID)
	return nil, nil
}
func (f *fakeIngestRepo) GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	return nil, nil
}
func (f *fakeIngestRepo) GetKnownIssueByPattern(ctx context.Context, tenantID, pattern string) (*models.KnownIssue, error) {
	f.seenTenants = append(f.seenTenants, tenantID)
	if f.knownIssueNil {
		return nil, nil
	}
	return &models.KnownIssue{Title: "known"}, nil
}
func (f *fakeIngestRepo) GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error) {
	return nil, nil
}
func (f *fakeIngestRepo) GetStats(ctx context.Context, tenantID string) (*models.DedupStats, error) {
	return nil, nil
}
func (f *fakeIngestRepo) GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error) {
	return nil, nil
}
func (f *fakeIngestRepo) GetTopology(ctx context.Context, tenantID string) (*models.Topology, error) {
	return nil, nil
}
func (f *fakeIngestRepo) ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) ([]models.Alert, int, error) {
	return nil, 0, nil
}
func (f *fakeIngestRepo) SetTopology(ctx context.Context, tenantID string, nodes, edges any) (*models.Topology, error) {
	return nil, nil
}
func (f *fakeIngestRepo) UpdateAlert(ctx context.Context, a *models.Alert) error { return nil }
func (f *fakeIngestRepo) UpdateNodeHealth(ctx context.Context, tenantID string, node models.NodeHealth) error {
	return nil
}

// TestIngest_UsesCallerTenantNotRequestBody asserts the service ignores
// req.TenantID. The handler passes the auth-context tenant; before the fix a
// body carrying tenantId overrode it, so the alert would land in another
// tenant's workspace — and, worse, be deduplicated against that tenant's
// existing fingerprints, silently suppressing their real alerts.
func TestIngest_UsesCallerTenantNotRequestBody(t *testing.T) {
	tenant := "auth-context-tenant"
	repo := &fakeIngestRepo{knownIssueNil: true}
	svc := NewService(repo, nil)

	req := models.IngestRequest{Name: "db down", Severity: "critical", TenantID: "attacker-supplied-tenant"}

	got, err := svc.Ingest(context.Background(), tenant, req)
	if err != nil {
		t.Fatalf("Ingest returned error: %v", err)
	}
	if repo.created == nil {
		t.Fatalf("CreateAlert was not called")
	}
	if repo.created.TenantID != tenant {
		t.Errorf("stored alert tenant: got %q, want %q (caller)", repo.created.TenantID, tenant)
	}
	if got.Alert.TenantID != tenant {
		t.Errorf("returned alert tenant: got %q, want %q (caller)", got.Alert.TenantID, tenant)
	}

	// Suppression and dedup must be scoped to the caller tenant too: otherwise
	// the alert is compared against the wrong tenant's maintenance windows and
	// fingerprints.
	if len(repo.seenTenants) == 0 {
		t.Fatalf("suppression/dedup lookups never ran — tenant scoping not exercised")
	}
	for _, seen := range repo.seenTenants {
		if seen != tenant {
			t.Errorf("downstream lookup ran with tenant %q, want %q (caller)", seen, tenant)
		}
	}
}

// TestIngest_EmptyCallerTenantStaysEmpty asserts an empty caller tenant is not
// backfilled from the body. It is tempting to "help" by falling back to
// req.TenantID when tenantID is empty — that reintroduces exactly the hole this
// test closes, for the anonymous-request case.
func TestIngest_EmptyCallerTenantStaysEmpty(t *testing.T) {
	repo := &fakeIngestRepo{knownIssueNil: true}
	svc := NewService(repo, nil)

	_, err := svc.Ingest(context.Background(), "", models.IngestRequest{
		Name: "n", TenantID: "attacker-supplied-tenant",
	})
	if err != nil {
		t.Fatalf("Ingest returned error: %v", err)
	}
	if repo.created == nil {
		t.Fatalf("CreateAlert was not called")
	}
	if repo.created.TenantID != "" {
		t.Errorf("empty caller tenant must not be backfilled from the body, got %q", repo.created.TenantID)
	}
}

// TestIngest_NoMatchingKnownIssueDoesNotPanic is a regression test for a real
// nil dereference: checkSuppression checked `err == nil` and then read
// issue.Title. Every fingerprint misses most of the time, so the common path
// returned (nil, nil) and Ingest panicked on any real alert. The production
// repository only returns (nil, err) on no match, but any sqlmock-driven test
// returning (nil, nil) — or a repository refactored to that convention —
// crashes the process.
func TestIngest_NoMatchingKnownIssueDoesNotPanic(t *testing.T) {
	repo := &fakeIngestRepo{knownIssueNil: true}
	svc := NewService(repo, nil)

	got, err := svc.Ingest(context.Background(), "t1", models.IngestRequest{Name: "n"})
	if err != nil {
		t.Fatalf("Ingest returned error: %v", err)
	}
	if got.Status != "created" {
		t.Errorf("expected status created (no suppression), got %q", got.Status)
	}
}

// TestIngest_MatchingKnownIssueSuppresses asserts the suppress branch still
// works after adding the nil guard.
func TestIngest_MatchingKnownIssueSuppresses(t *testing.T) {
	repo := &fakeIngestRepo{knownIssueNil: false}
	svc := NewService(repo, nil)

	got, err := svc.Ingest(context.Background(), "t1", models.IngestRequest{Name: "n"})
	if err != nil {
		t.Fatalf("Ingest returned error: %v", err)
	}
	if got.Status != "suppressed" {
		t.Errorf("expected status suppressed, got %q", got.Status)
	}
	if got.Reason == "" {
		t.Errorf("expected a suppression reason")
	}
}
