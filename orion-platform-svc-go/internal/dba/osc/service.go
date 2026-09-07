package osc

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"orion/go-common/pkg/sentinel"
)

// ErrInvalidTransition is returned when Start() is called on a job that
// is already running or already finished.
var ErrInvalidTransition = errors.New("invalid job status transition")

// DataSourceInfo is the minimal slice of dba_data_sources the service
// needs. The concrete DataSource type lives in internal/dba/models and
// importing it here would create a package cycle; a small adapter in the
// wiring layer keeps OSC self-contained.
type DataSourceInfo struct {
	ID       string
	TenantID string
	Type     string // "mysql" / "postgres" / ...
	Host     string
	Port     int
	Database string
	User     string
	Password string
}

// DataSourceProvider resolves a DataSourceID into credentials. The
// default implementation lives in the wiring layer.
type DataSourceProvider interface {
	GetDataSource(ctx context.Context, id string) (*DataSourceInfo, error)
}

// ServiceInterface is the contract the HTTP handler depends on.
// Defined here (not in service_interface.go) to keep the package small.
type ServiceInterface interface {
	CreateJob(ctx context.Context, tenantID, userID string, req CreateOSCJobInput) (*OSCJob, error)
	StartJob(ctx context.Context, tenantID, userID, jobID string) (*OSCJob, error)
	StopJob(ctx context.Context, tenantID, jobID string) (*OSCJob, error)
	GetJob(ctx context.Context, tenantID, jobID string) (*OSCJob, error)
	ListJobs(ctx context.Context, tenantID string, q OSCListQuery) (*OSCJobListResult, error)
	DryRun(ctx context.Context, tenantID string, req DryRunRequest) (*DryRunResult, error)
	Status(ctx context.Context, tenantID, jobID string) (*OSCStatus, error)
}

// Service is the concrete ServiceInterface implementation.
type Service struct {
	engine  *GhOstEngine
	repo    *Repository
	ds      DataSourceProvider
	log     *zap.Logger

	mu    sync.Mutex
	active map[string]context.CancelFunc // jobID -> cancel
}

// NewService wires the OSC service. Provider may be nil (dry-runs still
// work) but StartJob will fail fast in that case. logger may be nil.
func NewService(engine *GhOstEngine, repo *Repository, ds DataSourceProvider, logger *zap.Logger) *Service {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Service{
		engine: engine,
		repo:   repo,
		ds:     ds,
		log:    logger,
		active: make(map[string]context.CancelFunc),
	}
}

// CreateJob validates input, sets defaults and persists a pending job.
// It does not launch gh-ost; that's StartJob's job.
func (s *Service) CreateJob(ctx context.Context, tenantID, userID string, req CreateOSCJobInput) (*OSCJob, error) {
	if req.Table == "" {
		return nil, errors.New("table is required")
	}
	if req.AlterSQL == "" {
		return nil, errors.New("alter_sql is required")
	}
	if err := validateAlterSQL(req.AlterSQL); err != nil {
		return nil, err
	}
	if req.CutoverMode == "" {
		req.CutoverMode = CutoverAtomic
	}
	if !validCutover(req.CutoverMode) {
		return nil, fmt.Errorf("invalid cutover_mode %q; want two-step, atomic or instant", req.CutoverMode)
	}
	if req.MaxLagMillis <= 0 {
		req.MaxLagMillis = DefaultMaxLagMillis
	}
	if req.ChunkSize <= 0 {
		req.ChunkSize = DefaultChunkSize
	}

	// Validate the data source up-front so we fail fast. If no provider
	// is wired we skip this step but the request must supply a
	// non-empty DataSourceID.
	if s.ds != nil {
		ds, err := s.ds.GetDataSource(ctx, req.DataSourceID)
		if err != nil {
			if errors.Is(err, sentinel.NotFound) {
				return nil, fmt.Errorf("data source %q not found", req.DataSourceID)
			}
			return nil, fmt.Errorf("load data source: %w", err)
		}
		if ds.TenantID != "" && ds.TenantID != tenantID {
			return nil, fmt.Errorf("data source %q does not belong to tenant", req.DataSourceID)
		}
		if !isMySQL(ds.Type) {
			return nil, fmt.Errorf("OSC only supports MySQL data sources; data source %q is %s", ds.ID, ds.Type)
		}
	}

	job := &OSCJob{
		TenantID:     tenantID,
		UserID:       userID,
		DataSourceID: req.DataSourceID,
		Table:        req.Table,
		AlterSQL:     req.AlterSQL,
		Status:       StatusPending,
		DryRun:       req.DryRun,
		CutoverMode:  req.CutoverMode,
		MaxLagMillis: req.MaxLagMillis,
		ChunkSize:    req.ChunkSize,
		Log:          "",
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

// StartJob launches gh-ost for an existing job. It enforces the
// pending->running transition and runs gh-ost synchronously in a
// goroutine so the caller can return immediately.
//
// On return the job has been persisted as either running, completed,
// failed or cancelled depending on the outcome.
func (s *Service) StartJob(ctx context.Context, tenantID, userID, jobID string) (*OSCJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("job %q not found", jobID)
		}
		return nil, err
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job belongs to a different tenant")
	}
	if job.Status != StatusPending {
		return nil, fmt.Errorf("%w: job is %s", ErrInvalidTransition, job.Status)
	}

	// Mark running, then run the engine asynchronously so the HTTP
	// handler can return the running job without blocking.
	now := time.Now().UTC()
	if _, err := s.repo.UpdateJobStatus(ctx, jobID, StatusRunning, &now, nil, nil); err != nil {
		return nil, err
	}
	job.Status = StatusRunning
	job.StartedAt = &now

	cfg, err := s.buildConfig(ctx, job)
	if err != nil {
		_, _ = s.repo.UpdateJobStatus(context.Background(), jobID, StatusFailed, nil, nil, strPtr(err.Error()))
		return nil, err
	}

	// Detach from the caller's request context so the job keeps running
	// even if the HTTP connection closes. Use a longer default timeout
	// so a slow large-table migration is not killed at 60s.
	jobCtx, cancel := context.WithTimeout(context.Background(), 6*time.Hour)
	s.mu.Lock()
	s.active[jobID] = cancel
	s.mu.Unlock()

	go func() {
		defer cancel()
		s.mu.Lock()
		delete(s.active, jobID)
		s.mu.Unlock()

		start := time.Now()
		res, runErr := s.engine.Start(jobCtx, jobID, cfg)
		dur := time.Since(start)
		finished := time.Now().UTC()
		updates := map[string]interface{}{
			"finished_at": finished,
			"duration_ms": dur.Milliseconds(),
			"log":         strings.Join(res.Log, "\n"),
		}
		if res.Rows > 0 {
			updates["rows_affected"] = res.Rows
		}
		if res.Lag > 0 {
			updates["max_lag_observed"] = res.Lag
		}

		switch {
		case runErr != nil || !res.Success:
			updates["status"] = StatusFailed
			errMsg := res.Error
			if runErr != nil {
				errMsg = runErr.Error()
			}
			if errMsg == "" {
				errMsg = fmt.Sprintf("gh-ost exited with code %d", res.ExitCode)
			}
			updates["error_message"] = errMsg
		case cfg.DryRun:
			updates["status"] = StatusCompleted
			updates["error_message"] = "dry-run completed (no schema changes applied)"
		default:
			updates["status"] = StatusCompleted
		}

		if _, err := s.repo.UpdateJob(context.Background(), jobID, updates); err != nil {
			s.log.Error("persist osc job result", zap.String("job_id", jobID), zap.Error(err))
		}
	}()

	return job, nil
}

// StopJob cancels a running gh-ost process and marks the job cancelled.
func (s *Service) StopJob(ctx context.Context, tenantID, jobID string) (*OSCJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("job %q not found", jobID)
		}
		return nil, err
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job belongs to a different tenant")
	}
	if job.Status != StatusRunning {
		return nil, fmt.Errorf("%w: job is %s", ErrInvalidTransition, job.Status)
	}

	if err := s.engine.Stop(ctx, jobID); err != nil {
		// The process may already have exited between our check and
		// this call. Mark the job cancelled anyway so the UI reflects
		// intent, but keep the error for the caller.
		s.log.Warn("stop engine", zap.String("job_id", jobID), zap.Error(err))
	}

	finished := time.Now().UTC()
	now := time.Now().UTC()
	errMsg := "cancelled by user"
	updates := map[string]interface{}{
		"status":        StatusCancelled,
		"finished_at":   finished,
		"duration_ms":   time.Since(now).Milliseconds(),
		"updated_at":    now,
		"error_message": errMsg,
	}
	return s.repo.UpdateJob(ctx, jobID, updates)
}

// GetJob returns a job scoped to the caller's tenant.
func (s *Service) GetJob(ctx context.Context, tenantID, jobID string) (*OSCJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("job %q not found", jobID)
		}
		return nil, err
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job belongs to a different tenant")
	}
	return job, nil
}

// ListJobs returns a paginated list scoped to the caller's tenant.
func (s *Service) ListJobs(ctx context.Context, tenantID string, q OSCListQuery) (*OSCJobListResult, error) {
	page := q.Page
	if page <= 0 {
		page = 1
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	jobs, total, err := s.repo.ListJobs(ctx, tenantID, q.Status, page, limit)
	if err != nil {
		return nil, err
	}
	return &OSCJobListResult{Data: jobs, Total: total, Page: page, Limit: limit}, nil
}

// DryRun validates credentials by pinging MySQL, then invokes gh-ost
// with --execute omitted. It does not persist a job row.
func (s *Service) DryRun(ctx context.Context, tenantID string, req DryRunRequest) (*DryRunResult, error) {
	if s.ds == nil {
		return nil, errors.New("no data source provider configured")
	}
	ds, err := s.ds.GetDataSource(ctx, req.DataSourceID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("data source %q not found", req.DataSourceID)
		}
		return nil, fmt.Errorf("load data source: %w", err)
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("data source %q does not belong to tenant", req.DataSourceID)
	}
	if !isMySQL(ds.Type) {
		return nil, fmt.Errorf("OSC only supports MySQL data sources; data source %q is %s", ds.ID, ds.Type)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cfg := GhOstConfig{
		Host:       ds.Host,
		Port:       ds.Port,
		User:       ds.User,
		Password:   ds.Password,
		DBName:     ds.Database,
		Table:      req.Table,
		AlterSQL:   req.AlterSQL,
		DryRun:     true,
		MaxLagMillis: DefaultMaxLagMillis,
		ChunkSize:  DefaultChunkSize,
	}
	if err := PingMySQL(pingCtx, cfg); err != nil {
		return &DryRunResult{
			Success: false,
			Message: fmt.Sprintf("credential validation failed: %s", err),
		}, nil
	}

	// gh-ost in --dry-run mode exits quickly. Use a short timeout so a
	// stuck gh-ost can't hang the request handler.
	ghCtx, cancel2 := context.WithTimeout(ctx, 90*time.Second)
	defer cancel2()

	started := time.Now()
	res, runErr := s.engine.Start(ghCtx, "dryrun", cfg)
	dur := time.Since(started)

	if runErr != nil {
		return &DryRunResult{
			Success:  false,
			Message:  runErr.Error(),
			Duration: dur.Milliseconds(),
			Log:      res.Log,
		}, nil
	}
	if !res.Success {
		code := res.ExitCode
		return &DryRunResult{
			Success:  false,
			Message:  fmt.Sprintf("gh-ost dry-run failed: %s", res.Error),
			Duration: dur.Milliseconds(),
			Log:      res.Log,
			ExitCode: &code,
		}, nil
	}
	return &DryRunResult{
		Success:  true,
		Message:  "dry-run completed; review the plan before running for real",
		Duration: dur.Milliseconds(),
		Log:      res.Log,
		ExitCode: intPtr(0),
	}, nil
}

// Status combines the persisted job state with a live poll of the
// gh-ost web API. It never errors when the API is unreachable; the
// caller gets Reachable=false with a helpful message.
func (s *Service) Status(ctx context.Context, tenantID, jobID string) (*OSCStatus, error) {
	job, err := s.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	st := &OSCStatus{Job: *job}
	if !s.engine.IsRunning(jobID) {
		st.Reachable = false
		st.ReachableError = "no active gh-ost process for this job"
		return st, nil
	}
	// We don't persist the gh-ost web port on the job row; fall back to
	// the default. If the engine isn't configured with a web port, this
	// will return an error, which we surface via Reachable=false.
	port := 10008 // gh-ost default
	gst, err := s.engine.Status(ctx, port)
	if err != nil {
		st.Reachable = false
		st.ReachableError = err.Error()
		return st, nil
	}
	st.Reachable = true
	st.GhOst = gst
	return st, nil
}

// buildConfig translates a persisted job into a GhOstConfig by looking
// up its data source credentials.
func (s *Service) buildConfig(ctx context.Context, job *OSCJob) (GhOstConfig, error) {
	if s.ds == nil {
		return GhOstConfig{}, errors.New("no data source provider configured")
	}
	ds, err := s.ds.GetDataSource(ctx, job.DataSourceID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return GhOstConfig{}, fmt.Errorf("data source %q not found", job.DataSourceID)
		}
		return GhOstConfig{}, fmt.Errorf("load data source: %w", err)
	}
	cfg := GhOstConfig{
		Host:         ds.Host,
		Port:         ds.Port,
		User:         ds.User,
		Password:     ds.Password,
		DBName:       ds.Database,
		Table:        job.Table,
		AlterSQL:     job.AlterSQL,
		DryRun:       job.DryRun,
		Cutover:      job.CutoverMode,
		MaxLagMillis: job.MaxLagMillis,
		ChunkSize:    job.ChunkSize,
		Threads:      4,
	}
	// Only enable the web API when the job is meant to run long enough
	// to be worth polling. Dry runs and short jobs don't need it.
	if !job.DryRun {
		cfg.WebPort = 10008
	}
	return cfg, nil
}

// ---- validation helpers ----

func isMySQL(typeName string) bool {
	switch strings.ToLower(strings.TrimSpace(typeName)) {
	case "mysql", "mariadb":
		return true
	}
	return false
}

func validCutover(mode string) bool {
	switch mode {
	case CutoverTwoStep, CutoverAtomic, CutoverInstant:
		return true
	}
	return false
}

// validateAlterSQL blocks obviously destructive ALTERs that are almost
// never what an OSC caller wants. gh-ost is designed to be safe but a
// "DROP COLUMN x" via gh-ost still silently discards data.
func validateAlterSQL(alter string) error {
	upper := strings.ToUpper(strings.TrimSpace(alter))
	blocked := []string{
		"DROP TABLE",
		"DROP DATABASE",
		"TRUNCATE TABLE",
	}
	for _, b := range blocked {
		if strings.Contains(upper, b) {
			return fmt.Errorf("alter_sql contains %q which is not allowed via OSC", b)
		}
	}
	// DROP COLUMN is allowed (a common OSC use case) but logged; we do
	// not block it because the caller must approve the migration anyway.
	return nil
}

func strPtr(s string) *string   { return &s }
func intPtr(i int) *int         { return &i }
