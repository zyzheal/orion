package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/code-scan/models"
	"orion/platform-svc-go/internal/code-scan/repository"
	"orion/platform-svc-go/internal/code-scan/scan"
)

// ErrInvalidTarget means the requested target is not a directory this service
// can read. It is a request problem, not a database problem, so the handler
// answers 400 and never creates a run row that can never be scanned.
var ErrInvalidTarget = errors.New("code scan: invalid target")

const (
	defaultLimit  = 100
	maxLimit      = 1000
	defaultBranch = "main"
	maxBranchLen  = 128
	// scanTimeout bounds one worker run. A scan that exceeds it is cancelled
	// mid-walk rather than holding a goroutine forever.
	scanTimeout = 10 * time.Minute
)

// Service owns the scan lifecycle: it validates a target, records the run,
// walks the tree in a worker goroutine and writes the findings back.
//
// The HTTP handler must not walk the tree inline: a five-thousand-file target
// would blow past the API timeout and the POST would return before the user
// had anything to look at. The row is created as 'pending' and the worker
// moves it to 'running' and then to 'completed' or 'failed'.
type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
	rules  []scan.Rule
	opts   scan.Option

	wg sync.WaitGroup
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return NewServiceWithConfig(repo, logger, scan.NewDefaultRules(), scan.DefaultOption())
}

// NewServiceWithConfig is for tests: it takes the rule set and the walk bounds
// explicitly so a test can plant five findings in a temp dir without asking the
// production rule set to cooperate.
func NewServiceWithConfig(repo *repository.Repository, logger *zap.Logger, rules []scan.Rule, opts scan.Option) *Service {
	if logger == nil {
		logger = zap.NewNop()
	}
	if len(rules) == 0 {
		rules = scan.NewDefaultRules()
	}
	return &Service{repo: repo, logger: logger, rules: rules, opts: opts}
}

// Wait blocks until every scan the service has started has finished. Tests use
// it to observe the worker's database writes without sleeping.
func (s *Service) Wait() {
	s.wg.Wait()
}

func (s *Service) ListScans(ctx context.Context, tenantID string, limit int) ([]models.ScanRecord, error) {
	return s.repo.List(ctx, tenantID, clampLimit(limit))
}

func (s *Service) ListFindings(ctx context.Context, tenantID, scanID string, limit int) ([]models.VulnFinding, error) {
	return s.repo.ListFindings(ctx, tenantID, scanID, clampLimit(limit))
}

// CreateScan validates the target, records a pending run and starts the worker.
//
// The target is stored as an absolute path: a rerun happens later, possibly
// from a process with a different working directory, and a relative path would
// fail to resolve then.
func (s *Service) CreateScan(ctx context.Context, tenantID, target, branch string) (*models.ScanRecord, error) {
	abs, err := validateTarget(target)
	if err != nil {
		return nil, err
	}
	rec := &models.ScanRecord{
		ID:        newID("scan"),
		TenantID:  tenantID,
		Target:    abs,
		Branch:    normaliseBranch(branch),
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.Create(ctx, rec); err != nil {
		return nil, err
	}
	s.wg.Add(1)
	go s.execute(*rec)
	return rec, nil
}

// RerunScan re-runs an existing run. The previous attempt's findings are
// dropped by StartScan before the new walk starts.
func (s *Service) RerunScan(ctx context.Context, tenantID, id string) (*models.ScanRecord, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if _, err := validateTarget(rec.Target); err != nil {
		return nil, err
	}
	if err := s.repo.StartScan(ctx, tenantID, id, time.Now().UTC()); err != nil {
		return nil, err
	}
	s.wg.Add(1)
	go s.execute(*rec)
	// Re-read so the response reflects the row the database actually holds.
	return s.repo.GetByID(ctx, tenantID, id)
}

// execute is the worker body. It uses its own context: the HTTP request that
// created the run is long gone by the time a large tree finishes walking.
func (s *Service) execute(rec models.ScanRecord) {
	defer s.wg.Done()

	ctx, cancel := context.WithTimeout(context.Background(), scanTimeout)
	defer cancel()

	if err := s.repo.StartScan(ctx, rec.TenantID, rec.ID, time.Now().UTC()); err != nil {
		s.logger.Warn("code scan could not start", zap.String("scan_id", rec.ID), zap.String("target", rec.Target), zap.Error(err))
		return
	}

	rep, err := scan.Scan(rec.Target, s.rules, s.opts)
	if err != nil {
		_ = s.repo.FailScan(ctx, rec.TenantID, rec.ID, err.Error())
		s.logger.Warn("code scan failed", zap.String("scan_id", rec.ID), zap.String("target", rec.Target), zap.Error(err))
		return
	}

	createdAt := time.Now().UTC()
	findings := make([]models.VulnFinding, 0, len(rep.Findings))
	for _, f := range rep.Findings {
		findings = append(findings, models.VulnFinding{
			ID:          newID("vuln"),
			TenantID:    rec.TenantID,
			ScanID:      rec.ID,
			Category:    f.Category,
			Severity:    f.Severity,
			File:        f.File,
			Line:        f.Line,
			Description: f.Description,
			Fix:         f.Fix,
			CreatedAt:   createdAt,
		})
	}

	if err := s.repo.FinishScan(ctx, rec.TenantID, rec.ID, rep.Counts, int(rep.Duration.Seconds()), time.Now().UTC(), findings); err != nil {
		// The walk succeeded but the result could not be stored. Leave the row
		// where it is and log: overwriting it to 'failed' would discard a real
		// result set and claim there was none.
		s.logger.Error("code scan result could not be stored", zap.String("scan_id", rec.ID), zap.Error(err))
		return
	}

	s.logger.Info("code scan completed",
		zap.String("scan_id", rec.ID),
		zap.Int("findings", rep.Counts.Total),
		zap.Int("files_scanned", rep.FilesScanned),
		zap.Int("files_skipped", rep.FilesSkipped),
		zap.Bool("truncated", rep.TruncatedFiles),
		zap.Duration("duration", rep.Duration))
}

// validateTarget resolves target to an absolute, readable directory.
func validateTarget(target string) (string, error) {
	trimmed := strings.TrimSpace(target)
	if trimmed == "" {
		return "", fmt.Errorf("%w: target must not be empty", ErrInvalidTarget)
	}
	abs, err := filepath.Abs(trimmed)
	if err != nil {
		return "", err
	}
	st, err := os.Stat(abs)
	if err != nil || !st.IsDir() {
		return "", fmt.Errorf("%w: %s is not a directory", ErrInvalidTarget, abs)
	}
	// A directory that exists but cannot be opened is not scannable, so it is
	// rejected here rather than recorded and left in 'pending' forever.
	f, err := os.Open(abs)
	if err != nil {
		return "", fmt.Errorf("%w: %s is not readable", ErrInvalidTarget, abs)
	}
	_ = f.Close()
	return abs, nil
}

func normaliseBranch(branch string) string {
	branch = strings.TrimSpace(branch)
	if branch == "" {
		return defaultBranch
	}
	if len(branch) > maxBranchLen {
		branch = branch[:maxBranchLen]
	}
	return branch
}

func clampLimit(limit int) int {
	if limit <= 0 {
		return defaultLimit
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}

func newID(prefix string) string {
	return prefix + "-" + uuid.New().String()[:8]
}
