package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cron/cronparser"
	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/repository"

	"go.uber.org/zap"
)

// IJob is the interface all job handlers must implement.
type IJob interface {
	// Name returns the unique job type name, used to look up the handler.
	Name() string
	// CronExpr returns the default cron expression for this job type.
	CronExpr() string
	// Execute runs the job with the given config. Returns (result, err).
	Execute(ctx context.Context, config map[string]string) (result string, err error)
	// Validate checks that this job handler is ready to run.
	Validate() error
}

// SchedulerManager is the job scheduling manager.
type SchedulerManager struct {
	repo   *repository.JobRepository
	svc    *Service
	jobs   map[string]IJob
	logger *zap.Logger
	mu     sync.RWMutex
	tasks  map[string]*schedTask
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// schedTask is the per-job scheduler goroutine state.
type schedTask struct {
	quit     chan struct{}
	done     chan struct{}
	jobID    string
	tenantID string
}

// NewSchedulerManager creates a SchedulerManager.
func NewSchedulerManager(jobRepo *repository.JobRepository, svc *Service, logger *zap.Logger) *SchedulerManager {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &SchedulerManager{
		repo:   jobRepo,
		svc:    svc,
		jobs:   make(map[string]IJob),
		tasks:  make(map[string]*schedTask),
		logger: logger,
		stopCh: make(chan struct{}),
	}
}

// Register registers an IJob handler by its Name().
func (m *SchedulerManager) Register(job IJob) {
	if job == nil {
		return
	}
	name := strings.ToLower(job.Name())
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := job.Validate(); err != nil {
		m.logger.Warn("scheduler: job failed validation", zap.String("job", name), zap.Error(err))
		return
	}
	m.jobs[name] = job
	m.logger.Info("scheduler: registered job", zap.String("job", name), zap.String("cron", job.CronExpr()))
}

// Start loads all enabled job definitions from the database and starts their
// per-job goroutine timers. Blocks until Stop() is called.
func (m *SchedulerManager) Start(ctx context.Context) {
	m.logger.Info("scheduler: starting")

	defs, err := m.repo.ListAllEnabledDefinitions(ctx)
	if err != nil {
		m.logger.Error("scheduler: failed to list enabled definitions", zap.Error(err))
		return
	}
	for _, j := range defs {
		if !j.Enabled {
			continue
		}
		if _, ok := m.getJob(j.JobType); !ok {
			m.logger.Warn("scheduler: job type not registered, skipping",
				zap.String("job_type", j.JobType), zap.String("job_id", j.ID))
			continue
		}
		m.startTask(ctx, j.ID, j.TenantID)
	}
	m.logger.Info("scheduler: started", zap.Int("tasks", len(m.tasks)))

	<-m.stopCh
}

// Stop tears down the scheduler and waits for all task goroutines to finish.
func (m *SchedulerManager) Stop() {
	m.logger.Info("scheduler: stopping")
	close(m.stopCh)

	m.mu.RLock()
	for _, t := range m.tasks {
		select {
		case <-t.quit:
		default:
			close(t.quit)
		}
	}
	m.mu.RUnlock()

	m.wg.Wait()
	m.logger.Info("scheduler: stopped")
}

// CreateJob creates a new JobDefinition in the database and, if enabled, starts it.
func (m *SchedulerManager) CreateJob(ctx context.Context, tenantID, name, cronExpr, jobType string, config map[string]string) (*models.JobDefinition, error) {
	jobType = strings.ToLower(jobType)
	if _, ok := m.getJob(jobType); !ok {
		return nil, fmt.Errorf("job type %q not registered", jobType)
	}
	if err := m.repo.IsValidCronExpression(cronExpr); err != nil {
		return nil, fmt.Errorf("invalid cron expression %q: %w", cronExpr, err)
	}

	cfgJSON := "null"
	if config != nil {
		b, err := json.Marshal(config)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal config: %w", err)
		}
		cfgJSON = string(b)
	}

	j := &models.JobDefinition{
		TenantID:   tenantID,
		Name:       name,
		CronExpr:   cronExpr,
		JobType:    jobType,
		Config:     cfgJSON,
		Enabled:    true,
		MaxRetries: 3,
		TimeoutSec: 300,
	}
	if err := m.repo.CreateJobDefinition(ctx, j); err != nil {
		return nil, err
	}

	if j.Enabled {
		m.startTask(ctx, j.ID, j.TenantID)
	}
	return j, nil
}

// ListJobs lists JobDefinitions for the given tenant.
func (m *SchedulerManager) ListJobs(ctx context.Context, tenantID string) ([]models.JobDefinition, error) {
	return m.repo.ListJobDefinitions(ctx, tenantID, 100, 0)
}

// GetJob gets a single JobDefinition.
func (m *SchedulerManager) GetJob(ctx context.Context, tenantID, id string) (*models.JobDefinition, error) {
	return m.repo.GetJobDefinition(ctx, tenantID, id)
}

// UpdateJob updates a JobDefinition (name, cron_expr, job_type, config).
func (m *SchedulerManager) UpdateJob(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.JobDefinition, error) {
	if jobType, ok := updates["job_type"]; ok {
		if _, ok2 := m.getJob(jobType.(string)); !ok2 {
			return nil, fmt.Errorf("job type %q not registered", jobType)
		}
	}
	if cronExpr, ok := updates["cron_expr"]; ok {
		if err := m.repo.IsValidCronExpression(cronExpr.(string)); err != nil {
			return nil, err
		}
	}
	if cfg, ok := updates["config"]; ok {
		if config, ok2 := cfg.(map[string]string); ok2 && config != nil {
			b, err := json.Marshal(config)
			if err != nil {
				return nil, err
			}
			updates["config"] = string(b)
		}
	}

	prev, err := m.repo.GetJobDefinition(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	result, err := m.repo.UpdateJobDefinition(ctx, tenantID, id, updates)
	if err != nil {
		return nil, err
	}

	if prev.CronExpr != result.CronExpr || prev.JobType != result.JobType {
		m.stopTask(id)
		if result.Enabled {
			m.startTask(ctx, id, tenantID)
		}
	}

	return result, nil
}

// EnableJob enables a JobDefinition and starts its scheduler task.
func (m *SchedulerManager) EnableJob(ctx context.Context, tenantID, id string) error {
	if err := m.repo.SetJobEnabled(ctx, tenantID, id, true); err != nil {
		return err
	}
	m.startTask(ctx, id, tenantID)
	return nil
}

// DisableJob disables a JobDefinition and stops its scheduler task.
func (m *SchedulerManager) DisableJob(ctx context.Context, tenantID, id string) error {
	m.stopTask(id)
	return m.repo.SetJobEnabled(ctx, tenantID, id, false)
}

// RunJobNow manually triggers a job immediately. Respects timeout.
func (m *SchedulerManager) RunJobNow(ctx context.Context, tenantID, jobID string) (*models.JobExecutionLog, error) {
	j, err := m.repo.GetJobDefinition(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	handler, ok := m.getJob(j.JobType)
	if !ok {
		return nil, fmt.Errorf("job type %q not registered", j.JobType)
	}

	return m.executeJob(ctx, j, handler, time.Duration(j.TimeoutSec)*time.Second)
}

// GetExecutionLogs returns recent execution logs for a job.
func (m *SchedulerManager) GetExecutionLogs(ctx context.Context, tenantID, jobID string, limit int) ([]models.JobExecutionLog, error) {
	_, err := m.repo.GetJobDefinition(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	return m.repo.ListJobExecutionLogs(ctx, jobID, limit)
}

// RegisteredJobs returns the list of registered job type names.
func (m *SchedulerManager) RegisteredJobs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.jobs))
	for n := range m.jobs {
		names = append(names, n)
	}
	return names
}

// getJob returns the IJob handler for the given (lower-cased) job type.
func (m *SchedulerManager) getJob(jobType string) (IJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[strings.ToLower(jobType)]
	return j, ok
}

// startTask starts the per-job scheduler goroutine.
func (m *SchedulerManager) startTask(_ context.Context, jobID, tenantID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if old, ok := m.tasks[jobID]; ok {
		select {
		case <-old.quit:
		default:
			close(old.quit)
		}
	}

	t := &schedTask{
		quit:     make(chan struct{}),
		done:     make(chan struct{}),
		jobID:    jobID,
		tenantID: tenantID,
	}
	m.tasks[jobID] = t

	m.wg.Add(1)
	go m.runTask(t)
}

// stopTask stops a single job scheduler goroutine.
func (m *SchedulerManager) stopTask(jobID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if t, ok := m.tasks[jobID]; ok {
		select {
		case <-t.quit:
		default:
			close(t.quit)
		}
		delete(m.tasks, jobID)
	}
}

// runTask is the per-job scheduling loop.
func (m *SchedulerManager) runTask(t *schedTask) {
	defer m.wg.Done()
	defer close(t.done)

	for {
		select {
		case <-t.quit:
			return
		case <-m.stopCh:
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		j, err := m.repo.GetJobDefinitionByJobIDInternal(ctx, t.jobID)
		cancel()
		if err != nil {
			m.logger.Debug("scheduler: job not found, exiting task", zap.String("job_id", t.jobID), zap.Error(err))
			return
		}
		if !j.Enabled {
			m.logger.Debug("scheduler: job disabled, exiting task", zap.String("job_id", t.jobID))
			return
		}

		handler, ok := m.getJob(j.JobType)
		if !ok {
			m.logger.Warn("scheduler: job type not registered",
				zap.String("job_type", j.JobType), zap.String("job_id", t.jobID))
			return
		}

		parser := cronparser.NewParser()
		sched, err := parser.Parse(j.CronExpr)
		if err != nil {
			m.logger.Error("scheduler: invalid cron expression",
				zap.String("job_id", t.jobID), zap.String("expr", j.CronExpr), zap.Error(err))
			return
		}
		next := sched.Next(time.Now().UTC())

		timer := time.NewTimer(time.Until(next))

		dbCtx, dbCancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = m.repo.UpdateJobStatus(dbCtx, j.TenantID, t.jobID, "enabled", nil, &next, "")
		dbCancel()

		m.logger.Debug("scheduler: next run",
			zap.String("job_id", t.jobID), zap.String("job_type", j.JobType),
			zap.Time("next", next))

		select {
		case <-t.quit:
			timer.Stop()
			return
		case <-m.stopCh:
			// let the job fire once more if close to deadline
		case <-timer.C:
		}

		m.logger.Info("scheduler: firing job",
			zap.String("job_id", t.jobID), zap.String("job_type", j.JobType))

		timeout := time.Duration(j.TimeoutSec) * time.Second
		if timeout == 0 {
			timeout = 300 * time.Second
		}
		execCtx, execCancel := context.WithTimeout(context.Background(), timeout)
		log, _ := m.executeJob(execCtx, j, handler, timeout)
		execCancel()

		dbCtx2, dbCancel2 := context.WithTimeout(context.Background(), 5*time.Second)
		status := log.Status
		errMsg := log.Error
		if log.FinishedAt != nil && errMsg != "" {
			status = "error"
		}
		_ = m.repo.UpdateJobStatus(dbCtx2, j.TenantID, t.jobID, status, log.FinishedAt, nil, errMsg)
		dbCancel2()
	}
}

// executeJob runs a single job execution with timeout and log persistence.
func (m *SchedulerManager) executeJob(ctx context.Context, j *models.JobDefinition, handler IJob, timeout time.Duration) (*models.JobExecutionLog, error) {
	now := time.Now().UTC()
	log := &models.JobExecutionLog{
		JobID:     j.ID,
		Status:    "running",
		StartedAt: now,
	}

	handlerCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var result string
	var err error

	done := make(chan struct{})
	go func() {
		result, err = handler.Execute(handlerCtx, m.parseConfig(j.Config))
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		err = errors.New("job timed out")
	}

	elapsed := time.Since(now)
	log.DurationMs = elapsed.Milliseconds()
	finishedAt := time.Now().UTC()
	log.FinishedAt = &finishedAt

	if err != nil {
		log.Status = "failed"
		log.Error = err.Error()
		log.Output = ""
		m.logger.Error("scheduler: job execution failed",
			zap.String("job_id", j.ID), zap.String("job_type", j.JobType),
			zap.Error(err), zap.Duration("elapsed", elapsed))
	} else {
		log.Status = "completed"
		log.Output = result
		log.Error = ""
		m.logger.Info("scheduler: job execution completed",
			zap.String("job_id", j.ID), zap.String("job_type", j.JobType),
			zap.Duration("elapsed", elapsed), zap.String("result", result))
	}

	dbCtx, dbCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = m.repo.CreateJobExecutionLog(dbCtx, log)
	dbCancel()

	return log, nil
}

// parseConfig parses a JSON config string back into map[string]string.
func (m *SchedulerManager) parseConfig(raw string) map[string]string {
	if raw == "" || raw == "null" {
		return nil
	}
	cfg := make(map[string]string)
	err := json.Unmarshal([]byte(raw), &cfg)
	if err != nil {
		m.logger.Warn("scheduler: failed to parse job config", zap.Error(err))
		return nil
	}
	return cfg
}
