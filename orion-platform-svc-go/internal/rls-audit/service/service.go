package service

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/otel"
	"orion/platform-svc-go/internal/rls-audit/models"
	"orion/platform-svc-go/internal/rls-audit/repository"
)

// Scanner executes catalog queries against a target database and returns the table audits.
// Injected so that tests can supply a fake.
type Scanner func(ctx context.Context, dsn string) ([]*models.TableAudit, error)

// Service orchestrates RLS audits.
type Service struct {
	repo    repository.Interface
	logger  *zap.Logger
	scanner Scanner
}

func New(repo repository.Interface, logger *zap.Logger, scanner Scanner) *Service {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &Service{repo: repo, logger: logger, scanner: scanner}
}

// Audit runs a full RLS scan on the database identified by dsn.
func (s *Service) Audit(ctx context.Context, database, dsn string) (*models.AuditScanResult, error) {
	ctx, span := otel.StartSpan(ctx, "rls-audit.Audit",
		otel.AttrString("database", database))
	defer span.End()

	if s.scanner == nil {
		return nil, fmt.Errorf("scanner not configured")
	}

	tables, err := s.scanner(ctx, dsn)
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("scan database %s: %w", database, err)
	}

	now := time.Now()
	var (
		covered  int
		gapCount int
		gaps     []models.GapFinding
		dbGaps   int
	)

	for i := range tables {
		t := tables[i]
		t.LastCheckedAt = now
		_ = s.repo.SaveTableAudit(ctx, t)

		gap := s.classifyTableGap(t)
		if gap != nil {
			gaps = append(gaps, *gap)
			_ = s.repo.SaveGap(ctx, gap)
		}
		if t.Coverage == models.CoverageEnabled {
			covered++
		} else {
			gapCount++
			dbGaps++
		}
	}

	total := len(tables)
	var score float64
	if total > 0 {
		score = float64(covered) / float64(total) * 100
	}

	dbAudit := &models.DatabaseAudit{
		DatabaseName: database, Host: dsn, Tables: tables,
		Score: score, Covered: covered, Total: total,
		Gaps: dbGaps, AssessedAt: now,
	}
	_ = s.repo.SaveDatabaseAudit(ctx, dbAudit)

	result := &models.AuditScanResult{
		Databases:    []*models.DatabaseAudit{dbAudit},
		TotalScore:   score,
		TotalCovered: covered,
		TotalTables:  total,
		GapCount:     gapCount,
		Gaps:         gaps,
		ScannedAt:    now,
	}
	return result, nil
}

func (s *Service) classifyTableGap(t *models.TableAudit) *models.GapFinding {
	switch t.Coverage {
	case models.CoverageEnabled:
		return nil
	case models.CoverageDisabled:
		return &models.GapFinding{
			SchemaName: t.SchemaName, TableName: t.TableName,
			Issue: "RLS is not enabled on the table", Severity: "critical",
			Recommendation: fmt.Sprintf("ALTER TABLE %q.%q ENABLE ROW LEVEL SECURITY", t.SchemaName, t.TableName),
		}
	default:
		return &models.GapFinding{
			SchemaName: t.SchemaName, TableName: t.TableName,
			Issue: "no RLS policy found on the table", Severity: "high",
			Recommendation: fmt.Sprintf("CREATE POLICY tenant_%q ON %q.%q FOR ALL USING (tenant_id = current_setting('app.current_tenant', true))",
				t.TableName, t.SchemaName, t.TableName),
		}
	}
}

// CoverageSummary returns per-database summaries from stored database audits.
func (s *Service) CoverageSummary(ctx context.Context) ([]*models.CoverageSummary, error) {
	_, span := otel.StartSpan(ctx, "rls-audit.CoverageSummary")
	defer span.End()

	dbAudits, err := s.repo.ListDatabaseAudits(ctx)
	if err != nil {
		return nil, fmt.Errorf("list database audits: %w", err)
	}
	summaries := make([]*models.CoverageSummary, 0, len(dbAudits))
	for _, d := range dbAudits {
		status := models.CoverageEnabled
		if d.Gaps > 0 {
			if d.Score < 50 {
				status = models.CoverageDisabled
			} else {
				status = models.CoverageDisabled
			}
		}
		summaries = append(summaries, &models.CoverageSummary{
			DatabaseName: d.DatabaseName, Score: d.Score,
			Covered: d.Covered, Total: d.Total, Gaps: d.Gaps, Status: status,
		})
	}
	return summaries, nil
}

// RecommendFixes computes remediation steps for all gaps in a database.
func (s *Service) RecommendFixes(ctx context.Context, database string) ([]*models.RemediationStep, error) {
	_, span := otel.StartSpan(ctx, "rls-audit.RecommendFixes",
		otel.AttrString("database", database))
	defer span.End()

	gaps, err := s.repo.ListGaps(ctx, database, "")
	if err != nil {
		return nil, fmt.Errorf("list gaps: %w", err)
	}

	steps := make([]*models.RemediationStep, 0, len(gaps))
	for _, g := range gaps {
		switch g.Severity {
		case "critical":
			steps = append(steps, models.EnableRLS(g.SchemaName, g.TableName))
		case "high", "medium", "low":
			steps = append(steps, models.CreateTenantPolicy(g.SchemaName, g.TableName, "tenant_id", "tenant_"+g.TableName))
		}
	}
	return steps, nil
}
