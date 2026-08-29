package service

import (
	"context"
	"testing"

	"go.uber.org/zap/zaptest"

	"orion/platform-svc-go/internal/rls-audit/models"
)

type fakeRepo struct {
	tables map[string]*models.TableAudit
	dbs    map[string]*models.DatabaseAudit
	gaps   []*models.GapFinding
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		tables: make(map[string]*models.TableAudit),
		dbs:    make(map[string]*models.DatabaseAudit),
	}
}

func (r *fakeRepo) key(ns, t string) string { return ns + ":" + t }
func (r *fakeRepo) SaveTableAudit(_ context.Context, t *models.TableAudit) error {
	r.tables[r.key(t.SchemaName, t.TableName)] = t
	return nil
}
func (r *fakeRepo) GetTableAudit(_ context.Context, db, s, t string) (*models.TableAudit, error) {
	v, ok := r.tables[r.key(s, t)]
	if !ok {
		return nil, nil
	}
	return v, nil
}
func (r *fakeRepo) ListTableAudits(_ context.Context, _ string) ([]*models.TableAudit, error) {
	out := make([]*models.TableAudit, 0, len(r.tables))
	for _, v := range r.tables {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeRepo) SaveDatabaseAudit(_ context.Context, d *models.DatabaseAudit) error {
	r.dbs[d.DatabaseName] = d
	return nil
}
func (r *fakeRepo) GetDatabaseAudit(_ context.Context, db string) (*models.DatabaseAudit, error) {
	v, ok := r.dbs[db]
	if !ok {
		return nil, nil
	}
	return v, nil
}
func (r *fakeRepo) ListDatabaseAudits(_ context.Context) ([]*models.DatabaseAudit, error) {
	out := make([]*models.DatabaseAudit, 0, len(r.dbs))
	for _, v := range r.dbs {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeRepo) SaveGap(_ context.Context, g *models.GapFinding) error {
	r.gaps = append(r.gaps, g)
	return nil
}
func (r *fakeRepo) ListGaps(_ context.Context, db, sev string) ([]*models.GapFinding, error) {
	if db == "" && sev == "" {
		return r.gaps, nil
	}
	out := make([]*models.GapFinding, 0, len(r.gaps))
	for _, g := range r.gaps {
		if db != "" { /* not stored on gap */
		}
		if sev != "" && g.Severity != sev {
			continue
		}
		out = append(out, g)
	}
	return out, nil
}

func fakeScanner(tables []*models.TableAudit) Scanner {
	return func(ctx context.Context, dsn string) ([]*models.TableAudit, error) {
		return tables, nil
	}
}

func TestAudit_FullCoverage(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t), fakeScanner([]*models.TableAudit{
		{SchemaName: "public", TableName: "users", RLSEnabled: true, RLSForce: true, Coverage: models.CoverageEnabled,
			Policies: []models.PolicyAudit{{Name: "tenant_users", Type: models.PolicyPermit, Command: models.CommandAll, IsRowLevel: true}}},
		{SchemaName: "public", TableName: "orders", RLSEnabled: true, Coverage: models.CoverageEnabled,
			Policies: []models.PolicyAudit{{Name: "tenant_orders", Type: models.PolicyPermit, Command: models.CommandAll}}},
	}))

	result, err := svc.Audit(ctx, "orion", "postgres://orion")
	if err != nil {
		t.Fatalf("Audit failed: %v", err)
	}
	if result.TotalScore != 100 {
		t.Errorf("expected score 100, got %f", result.TotalScore)
	}
	if result.GapCount != 0 {
		t.Errorf("expected 0 gaps, got %d", result.GapCount)
	}
	if result.TotalCovered != 2 {
		t.Errorf("expected 2 covered, got %d", result.TotalCovered)
	}
}

func TestAudit_GapDisabled(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t), fakeScanner([]*models.TableAudit{
		{SchemaName: "public", TableName: "users", Coverage: models.CoverageEnabled,
			Policies: []models.PolicyAudit{{Name: "p", Type: models.PolicyPermit, Command: models.CommandAll}}},
		{SchemaName: "public", TableName: "secrets", Coverage: models.CoverageDisabled},
	}))

	result, err := svc.Audit(ctx, "orion", "postgres://orion")
	if err != nil {
		t.Fatalf("Audit failed: %v", err)
	}
	if result.TotalScore != 50 {
		t.Errorf("expected 50, got %f", result.TotalScore)
	}
	if result.GapCount != 1 {
		t.Errorf("expected 1 gap, got %d", result.GapCount)
	}
	if len(result.Gaps) != 1 || result.Gaps[0].Severity != "critical" {
		t.Errorf("unexpected gaps: %+v", result.Gaps)
	}
}

func TestAudit_MissingPolicy(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t), fakeScanner([]*models.TableAudit{
		{SchemaName: "public", TableName: "users", RLSEnabled: true, Coverage: models.CoverageMissing},
	}))

	result, err := svc.Audit(ctx, "orion", "postgres://orion")
	if err != nil {
		t.Fatalf("Audit failed: %v", err)
	}
	if result.GapCount != 1 || result.Gaps[0].Severity != "high" {
		t.Errorf("unexpected gap: %+v", result.Gaps)
	}
}

func TestAudit_Empty(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t), fakeScanner(nil))

	result, err := svc.Audit(ctx, "orion", "postgres://orion")
	if err != nil {
		t.Fatalf("Audit failed: %v", err)
	}
	if result.TotalTables != 0 {
		t.Errorf("expected 0 tables, got %d", result.TotalTables)
	}
	if result.TotalScore != 0 {
		t.Errorf("expected score 0, got %f", result.TotalScore)
	}
}

func TestAudit_NoScanner(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), zaptest.NewLogger(t), nil)
	_, err := svc.Audit(ctx, "orion", "postgres://orion")
	if err == nil {
		t.Error("expected error without scanner")
	}
}

func TestCoverageSummary(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.SaveDatabaseAudit(ctx, &models.DatabaseAudit{DatabaseName: "a", Score: 100, Covered: 2, Total: 2, Gaps: 0})
	repo.SaveDatabaseAudit(ctx, &models.DatabaseAudit{DatabaseName: "b", Score: 50, Covered: 1, Total: 2, Gaps: 1})
	svc := New(repo, zaptest.NewLogger(t), nil)

	sums, err := svc.CoverageSummary(ctx)
	if err != nil {
		t.Fatalf("CoverageSummary: %v", err)
	}
	if len(sums) != 2 {
		t.Errorf("expected 2 summaries, got %d", len(sums))
	}
}

func TestRecommendFixes(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	repo.SaveGap(ctx, &models.GapFinding{SchemaName: "public", TableName: "users", Severity: "critical", Issue: "rls off"})
	repo.SaveGap(ctx, &models.GapFinding{SchemaName: "public", TableName: "orders", Severity: "high", Issue: "no policy"})
	svc := New(repo, zaptest.NewLogger(t), nil)

	steps, err := svc.RecommendFixes(ctx, "orion")
	if err != nil {
		t.Fatalf("RecommendFixes: %v", err)
	}
	if len(steps) != 2 {
		t.Errorf("expected 2 steps, got %d", len(steps))
	}
	if steps[0].Action != "enable_rls" {
		t.Errorf("expected enable_rls, got %s", steps[0].Action)
	}
	if steps[1].Action != "add_tenant_policy" {
		t.Errorf("expected add_tenant_policy, got %s", steps[1].Action)
	}
}

func TestEnableRLS_SQL(t *testing.T) {
	step := models.EnableRLS("public", "users")
	if step.Action != "enable_rls" {
		t.Errorf("unexpected action: %s", step.Action)
	}
	if step.SQL == "" {
		t.Error("expected non-empty SQL")
	}
}

func TestCreateTenantPolicy_SQL(t *testing.T) {
	step := models.CreateTenantPolicy("public", "users", "tenant_id", "tenant_users")
	if step.Action != "add_tenant_policy" {
		t.Errorf("unexpected action: %s", step.Action)
	}
	if step.SQL == "" {
		t.Error("expected non-empty SQL")
	}
}
