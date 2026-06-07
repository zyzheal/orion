package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"orion/scheduler-svc-go/internal/models"
	"orion/scheduler-svc-go/internal/repository"
)

var (
	ErrJobNotFound       = errors.New("job not found")
	ErrInvalidStatus     = errors.New("invalid status transition")
	ErrScheduleNotFound  = errors.New("schedule not found")
	ErrValidation        = errors.New("validation error")
	ErrLockNotAcquired   = errors.New("could not acquire lock")
)

// ═══════════════════════════════════════════════════════════════════════════
// SchedulerService — Cron Job CRUD + Execution + Tick Loop
// ═══════════════════════════════════════════════════════════════════════════

const defaultTickInterval = 60 * time.Second

// SchedulerService manages cron jobs, their execution, and the periodic tick loop.
type SchedulerService struct {
	repo   *repository.SchedulerRepository
	ticker *time.Ticker
	done   chan struct{}
}

func NewSchedulerService(repo *repository.SchedulerRepository) *SchedulerService {
	return &SchedulerService{
		repo: repo,
		done: make(chan struct{}),
	}
}

// ── Job CRUD ──────────────────────────────────────────────────────────────

// CreateJob validates the request, computes the next run time, and persists the job.
func (s *SchedulerService) CreateJob(ctx context.Context, j *models.Job) error {
	if j.Status == "" {
		j.Status = models.JobActive
	}
	// Compute next_run_at from cron expression or interval.
	if j.NextRunAt == nil {
		next := s.computeNextRun(j)
		j.NextRunAt = next
	}
	return s.repo.CreateJob(ctx, j)
}

func (s *SchedulerService) GetJobByID(ctx context.Context, tenantID, id string) (*models.Job, error) {
	return s.repo.GetJobByID(ctx, tenantID, id)
}

func (s *SchedulerService) ListJobs(ctx context.Context, tenantID string, offset, limit int) ([]models.Job, error) {
	return s.repo.ListJobs(ctx, tenantID, offset, limit)
}

// UpdateJob applies partial updates to an existing job.
func (s *SchedulerService) UpdateJob(ctx context.Context, tenantID, id string, req *models.UpdateJobRequest) error {
	return s.repo.UpdateJob(ctx, tenantID, id, req)
}

// PauseJob transitions an active job to paused.
func (s *SchedulerService) PauseJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status != models.JobActive {
		return ErrInvalidStatus
	}
	return s.repo.UpdateJobStatus(ctx, tenantID, id, models.JobPaused)
}

// ResumeJob transitions a paused job back to active.
func (s *SchedulerService) ResumeJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status != models.JobPaused {
		return ErrInvalidStatus
	}
	if err := s.repo.UpdateJobStatus(ctx, tenantID, id, models.JobActive); err != nil {
		return err
	}
	// Recompute next_run_at when resuming.
	next := s.computeNextRun(job)
	if next != nil {
		return s.repo.UpdateJobNextRun(ctx, tenantID, id, *next)
	}
	return nil
}

// DisableJob transitions a job to disabled (terminal state).
func (s *SchedulerService) DisableJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status == models.JobDisabled {
		return ErrInvalidStatus
	}
	return s.repo.UpdateJobStatus(ctx, tenantID, id, models.JobDisabled)
}

// Delete removes a job by ID, scoped to a tenant.
func (s *SchedulerService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *SchedulerService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ── Execution ─────────────────────────────────────────────────────────────

// ExecuteJob manually triggers a job run, persists the execution record, and
// updates the job's last_run_at / run_count / next_run_at.
func (s *SchedulerService) ExecuteJob(ctx context.Context, tenantID, jobID string) (*models.JobRun, error) {
	job, err := s.repo.GetJobByID(ctx, tenantID, jobID)
	if err != nil {
		return nil, ErrJobNotFound
	}

	jr := &models.JobRun{
		JobID:  jobID,
		Status: "running",
	}
	if err := s.repo.CreateJobRun(ctx, jr); err != nil {
		return nil, fmt.Errorf("create job run: %w", err)
	}

	start := time.Now()
	// Execute the actual task (placeholder — dispatch to registered handler in production).
	output := s.executeTask(job)
	elapsed := time.Since(start).Milliseconds()

	status := "success"
	var errStr *string
	if output != "" {
		errStr = &output
	}

	if err := s.repo.CompleteJobRun(ctx, jr.ID, status, errStr, elapsed); err != nil {
		return nil, fmt.Errorf("complete job run: %w", err)
	}
	if err := s.repo.UpdateJobRunInfo(ctx, tenantID, jobID); err != nil {
		return nil, fmt.Errorf("update job run info: %w", err)
	}
	// Recompute next_run_at.
	next := s.computeNextRun(job)
	if next != nil {
		_ = s.repo.UpdateJobNextRun(ctx, tenantID, jobID, *next)
	}

	jr.Status = status
	jr.Error = errStr
	jr.DurationMs = elapsed
	now := time.Now()
	jr.EndedAt = &now
	return jr, nil
}

// RecordRun is used by the tick loop to record an execution.
func (s *SchedulerService) RecordRun(ctx context.Context, tenantID, jobID, status string, errStr *string, durationMs int64) error {
	jr := &models.JobRun{
		JobID:  jobID,
		Status: "running",
	}
	if err := s.repo.CreateJobRun(ctx, jr); err != nil {
		return err
	}
	if err := s.repo.CompleteJobRun(ctx, jr.ID, status, errStr, durationMs); err != nil {
		return err
	}
	return s.repo.UpdateJobRunInfo(ctx, tenantID, jobID)
}

func (s *SchedulerService) GetJobRuns(ctx context.Context, jobID string, limit int) ([]models.JobRun, error) {
	return s.repo.GetJobRuns(ctx, jobID, limit)
}

// GetExecutionHistory returns all executions for a tenant, optionally filtered by jobID.
func (s *SchedulerService) GetExecutionHistory(ctx context.Context, tenantID, jobID string, limit int) ([]models.JobRun, error) {
	return s.repo.GetExecutionHistory(ctx, tenantID, jobID, limit)
}

// ── Scheduler Tick Loop ───────────────────────────────────────────────────

// Start launches a background goroutine that checks for due jobs every tickInterval.
func (s *SchedulerService) Start(ctx context.Context) {
	s.ticker = time.NewTicker(defaultTickInterval)
	log.Printf("scheduler tick loop started (interval=%s)", defaultTickInterval)

	go func() {
		// Run immediately on start.
		s.tick(ctx)
		for {
			select {
			case <-s.ticker.C:
				s.tick(ctx)
			case <-s.done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Stop halts the tick loop.
func (s *SchedulerService) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.done)
	log.Println("scheduler tick loop stopped")
}

// tick finds all jobs whose next_run_at is in the past and executes them.
func (s *SchedulerService) tick(ctx context.Context) {
	// Try to acquire an advisory lock so only one instance runs the tick.
	acquired, err := s.repo.AcquireAdvisoryLock(ctx, "scheduler_tick")
	if err != nil {
		log.Printf("scheduler tick: lock error: %v", err)
		return
	}
	if !acquired {
		log.Println("scheduler tick: lock held by another instance, skipping")
		return
	}
	defer func() {
		_ = s.repo.ReleaseAdvisoryLock(ctx, "scheduler_tick")
	}()

	tenantIDs, err := s.repo.GetDistinctTenantIDs(ctx)
	if err != nil {
		log.Printf("scheduler tick: get tenant IDs error: %v", err)
		return
	}

	now := time.Now()
	for _, tenantID := range tenantIDs {
		jobs, err := s.repo.FindJobsDueForExecution(ctx, tenantID, now)
		if err != nil {
			log.Printf("scheduler tick: find due jobs error for tenant %s: %v", tenantID, err)
			continue
		}

		for _, job := range jobs {
			start := time.Now()
			s.executeTask(&job)
			elapsed := time.Since(start).Milliseconds()

			if err := s.RecordRun(ctx, tenantID, job.ID, "success", nil, elapsed); err != nil {
				log.Printf("scheduler tick: record run error for job %s: %v", job.ID, err)
			}
			// Recompute next_run_at.
			next := s.computeNextRun(&job)
			if next != nil {
				_ = s.repo.UpdateJobNextRun(ctx, tenantID, job.ID, *next)
			}
		}
	}
}

// executeTask dispatches the task to a registered handler. For now it logs and returns.
func (s *SchedulerService) executeTask(job *models.Job) string {
	log.Printf("executing task for job %s (type=%s)", job.ID, job.Type)
	return ""
}

// ── Cron Next-Run Computation ─────────────────────────────────────────────

// computeNextRun calculates the next execution time for a job.
// For cron-type jobs it parses the 5-field cron expression.
// For interval-type jobs it adds interval_sec to now.
func (s *SchedulerService) computeNextRun(job *models.Job) *time.Time {
	now := time.Now().UTC()
	switch job.Type {
	case models.JobTypeCron:
		if job.CronExpr == nil {
			return nil
		}
		next, err := NextCronTime(*job.CronExpr, now)
		if err != nil {
			log.Printf("computeNextRun: invalid cron %q for job %s: %v", *job.CronExpr, job.ID, err)
			return nil
		}
		return &next
	case models.JobTypeInterval:
		if job.IntervalSec == nil {
			return nil
		}
		next := now.Add(time.Duration(*job.IntervalSec) * time.Second)
		return &next
	case models.JobTypeOnce:
		// One-shot jobs have no next run.
		return nil
	default:
		return nil
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// OnCallService — On-Call Schedule CRUD + Rotation + Override + Escalation
// ═══════════════════════════════════════════════════════════════════════════

// OnCallService manages on-call rotation schedules, assignments, and overrides.
type OnCallService struct {
	repo *repository.SchedulerRepository
}

func NewOnCallService(repo *repository.SchedulerRepository) *OnCallService {
	return &OnCallService{repo: repo}
}

// ── Schedule CRUD ─────────────────────────────────────────────────────────

// CreateSchedule validates input, persists the schedule, and generates rotation assignments.
func (s *OnCallService) CreateSchedule(ctx context.Context, tenantID string, req *models.CreateScheduleRequest) (*models.OnCallSchedule, error) {
	if req.Name == "" || len(req.TeamMembers) == 0 {
		return nil, fmt.Errorf("%w: name and team_members are required", ErrValidation)
	}

	if req.RotationStartHour < 0 || req.RotationStartHour > 23 {
		req.RotationStartHour = 9 // default to 9 AM
	}

	id := fmt.Sprintf("schedule_%d", time.Now().UnixNano())
	now := time.Now()

	schedule := &models.OnCallSchedule{
		ID:                id,
		TenantID:          tenantID,
		Name:              req.Name,
		Timezone:          req.Timezone,
		RotationType:      req.RotationType,
		RotationStartHour: req.RotationStartHour,
		TeamMembers:       req.TeamMembers,
		StartDate:         now,
		Escalations:       req.Escalations,
	}

	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, fmt.Errorf("persist schedule: %w", err)
	}

	// Generate rotation assignments for all team members.
	if err := s.generateAssignments(ctx, schedule); err != nil {
		log.Printf("warning: failed to generate assignments for schedule %s: %v", id, err)
	}

	log.Printf("on-call schedule created: %s (%s)", schedule.ID, schedule.Name)
	return schedule, nil
}

// ListSchedules returns all on-call schedules for a tenant.
func (s *OnCallService) ListSchedules(ctx context.Context, tenantID string) ([]models.OnCallSchedule, error) {
	return s.repo.ListSchedules(ctx, tenantID)
}

// GetSchedule returns a single schedule by ID, scoped to tenant.
func (s *OnCallService) GetSchedule(ctx context.Context, tenantID, id string) (*models.OnCallSchedule, error) {
	return s.repo.GetScheduleByID(ctx, tenantID, id)
}

// DeleteSchedule removes a schedule and all its assignments/overrides, scoped to tenant.
func (s *OnCallService) DeleteSchedule(ctx context.Context, tenantID, id string) (bool, error) {
	deleted, err := s.repo.DeleteSchedule(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if deleted {
		// Cascading deletes are handled by ON DELETE CASCADE in the DB,
		// but we also explicitly clean up in case foreign keys are not set.
		_ = s.repo.DeleteAssignmentsByScheduleID(ctx, id)
		_ = s.repo.DeleteOverridesByScheduleID(ctx, id)
	}
	return deleted, nil
}

// ── Current On-Call ───────────────────────────────────────────────────────

// GetCurrentOnCall determines who is on-call for a schedule right now.
// It checks overrides first, then active assignments, then falls back to the first team member.
func (s *OnCallService) GetCurrentOnCall(ctx context.Context, tenantID, scheduleID string) (*models.OnCallCheckResult, error) {
	schedule, err := s.repo.GetScheduleByID(ctx, tenantID, scheduleID)
	if err != nil {
		return &models.OnCallCheckResult{IsOnCall: false}, nil
	}

	now := time.Now()

	// 1. Check for an active override.
	override, err := s.repo.FindActiveOverride(ctx, scheduleID, now)
	if err == nil && override != nil {
		escTargets := s.getEscalationTargets(schedule, override.OverrideUserID)
		return &models.OnCallCheckResult{
			IsOnCall:          true,
			PrimaryUserID:     &override.OverrideUserID,
			EscalationTargets: escTargets,
		}, nil
	}

	// 2. Check for an active assignment.
	assignment, err := s.repo.FindActiveAssignment(ctx, scheduleID, now)
	if err == nil && assignment != nil {
		escTargets := s.getEscalationTargets(schedule, assignment.UserID)
		return &models.OnCallCheckResult{
			IsOnCall:          true,
			PrimaryUserID:     &assignment.UserID,
			EscalationTargets: escTargets,
		}, nil
	}

	// 3. Fallback: first team member.
	var fallback *string
	if len(schedule.TeamMembers) > 0 {
		fb := schedule.TeamMembers[0]
		fallback = &fb
	}
	escTargets := []string{}
	if fallback != nil {
		escTargets = s.getEscalationTargets(schedule, *fallback)
	}

	log.Printf("no active assignment for schedule %s, using fallback", scheduleID)
	return &models.OnCallCheckResult{
		IsOnCall:          false,
		PrimaryUserID:     fallback,
		EscalationTargets: escTargets,
	}, nil
}

// ── Override ──────────────────────────────────────────────────────────────

// CreateOverride inserts a temporary substitution for an on-call user, scoped to tenant.
func (s *OnCallService) CreateOverride(ctx context.Context, tenantID, scheduleID string, req *models.CreateOverrideRequest) (*models.OnCallOverride, error) {
	if req.OriginalUserID == "" || req.OverrideUserID == "" {
		return nil, fmt.Errorf("%w: original_user_id and override_user_id are required", ErrValidation)
	}
	if !req.EndTime.After(req.StartTime) {
		return nil, fmt.Errorf("%w: end_time must be after start_time", ErrValidation)
	}

	id := fmt.Sprintf("override_%d", time.Now().UnixNano())
	override := &models.OnCallOverride{
		ID:             id,
		TenantID:       tenantID,
		ScheduleID:     scheduleID,
		OriginalUserID: req.OriginalUserID,
		OverrideUserID: req.OverrideUserID,
		StartTime:      req.StartTime,
		EndTime:        req.EndTime,
		Reason:         req.Reason,
	}

	if err := s.repo.CreateOverride(ctx, override); err != nil {
		return nil, fmt.Errorf("persist override: %w", err)
	}

	log.Printf("on-call override created: %s", override.ID)
	return override, nil
}

// ── Assignment Generation ─────────────────────────────────────────────────

// generateAssignments creates rotation assignment records for all team members.
// Each member gets a contiguous time window based on the rotation type.
func (s *OnCallService) generateAssignments(ctx context.Context, schedule *models.OnCallSchedule) error {
	current := time.Now().UTC()
	// Align to rotation start hour.
	current = time.Date(current.Year(), current.Month(), current.Day(),
		schedule.RotationStartHour, 0, 0, 0, time.UTC)
	if current.Before(time.Now()) {
		current = current.Add(24 * time.Hour)
	}

	for i, userID := range schedule.TeamMembers {
		endTime := getEndOfRotation(schedule.RotationType, current)
		assignment := &models.OnCallAssignment{
			ID:         fmt.Sprintf("assign_%d_%d", time.Now().UnixNano(), i),
			TenantID:   schedule.TenantID,
			ScheduleID: schedule.ID,
			UserID:     userID,
			StartTime:  current,
			EndTime:    endTime,
		}
		if err := s.repo.CreateAssignment(ctx, assignment); err != nil {
			return fmt.Errorf("create assignment for user %s: %w", userID, err)
		}
		current = endTime
	}
	return nil
}

// getEndOfRotation computes the end time of a rotation period.
func getEndOfRotation(rotType models.RotationType, start time.Time) time.Time {
	switch rotType {
	case models.RotationDaily:
		return start.AddDate(0, 0, 1)
	case models.RotationWeekly:
		return start.AddDate(0, 0, 7)
	case models.RotationMonthly:
		return start.AddDate(0, 1, 0)
	default:
		return start.AddDate(0, 0, 1)
	}
}

// getEscalationTargets returns all team members except the current on-call user.
func (s *OnCallService) getEscalationTargets(schedule *models.OnCallSchedule, excludeUserID string) []string {
	var targets []string
	for _, uid := range schedule.TeamMembers {
		if uid != excludeUserID {
			targets = append(targets, uid)
		}
	}
	return targets
}

// ListAssignments returns all assignments for a schedule.
func (s *OnCallService) ListAssignments(ctx context.Context, scheduleID string) ([]models.OnCallAssignment, error) {
	return s.repo.ListAssignments(ctx, scheduleID)
}

// ═══════════════════════════════════════════════════════════════════════════
// DistributedLockService — PostgreSQL Advisory Lock Wrapper
// ═══════════════════════════════════════════════════════════════════════════

// DistributedLockService provides distributed locking via PostgreSQL advisory locks.
type DistributedLockService struct {
	repo        *repository.SchedulerRepository
	retryCount  int
	retryDelay  time.Duration
}

func NewDistributedLockService(repo *repository.SchedulerRepository) *DistributedLockService {
	return &DistributedLockService{
		repo:       repo,
		retryCount: 3,
		retryDelay: 1 * time.Second,
	}
}

// AcquireLock tries to acquire an advisory lock with retry logic.
func (s *DistributedLockService) AcquireLock(ctx context.Context, key string) error {
	for i := 0; i < s.retryCount; i++ {
		acquired, err := s.repo.AcquireAdvisoryLock(ctx, key)
		if err != nil {
			return fmt.Errorf("acquire lock attempt %d: %w", i+1, err)
		}
		if acquired {
			log.Printf("lock acquired: %s (attempt %d)", key, i+1)
			return nil
		}
		if i < s.retryCount-1 {
			time.Sleep(s.retryDelay)
		}
	}
	return fmt.Errorf("%w: %s after %d attempts", ErrLockNotAcquired, key, s.retryCount)
}

// ReleaseLock releases an advisory lock.
func (s *DistributedLockService) ReleaseLock(ctx context.Context, key string) error {
	return s.repo.ReleaseAdvisoryLock(ctx, key)
}

// ExecuteWithLock runs fn while holding the advisory lock for the given key.
func (s *DistributedLockService) ExecuteWithLock(ctx context.Context, key string, fn func() error) error {
	if err := s.AcquireLock(ctx, key); err != nil {
		return err
	}
	defer func() {
		_ = s.ReleaseLock(ctx, key)
	}()
	return fn()
}

// ═══════════════════════════════════════════════════════════════════════════
// Cron Expression Parser (5-field: minute hour day month weekday)
// ═══════════════════════════════════════════════════════════════════════════

// NextCronTime computes the next occurrence of a 5-field cron expression
// after the given time.  Fields: minute hour dayOfMonth month dayOfWeek.
// Supports: *, N, N-M, */N, N,M.
// Maximum search horizon: 2 years.
func NextCronTime(expr string, after time.Time) (time.Time, error) {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return time.Time{}, fmt.Errorf("cron expression must have 5 fields, got %d", len(fields))
	}

	minutes, err := parseCronField(fields[0], 0, 59)
	if err != nil {
		return time.Time{}, fmt.Errorf("minute field: %w", err)
	}
	hours, err := parseCronField(fields[1], 0, 23)
	if err != nil {
		return time.Time{}, fmt.Errorf("hour field: %w", err)
	}
	days, err := parseCronField(fields[2], 1, 31)
	if err != nil {
		return time.Time{}, fmt.Errorf("day field: %w", err)
	}
	months, err := parseCronField(fields[3], 1, 12)
	if err != nil {
		return time.Time{}, fmt.Errorf("month field: %w", err)
	}
	weekdays, err := parseCronField(fields[4], 0, 7)
	if err != nil {
		return time.Time{}, fmt.Errorf("weekday field: %w", err)
	}
	// Normalize Sunday: 7 -> 0.
	if weekdays[7] {
		weekdays[0] = true
	}

	// Start searching from the next minute.
	t := after.UTC().Add(time.Minute).Truncate(time.Minute)
	maxSearch := after.AddDate(2, 0, 0) // 2-year horizon

	for t.Before(maxSearch) {
		if months[t.Month()] &&
			days[t.Day()] &&
			hours[t.Hour()] &&
			minutes[t.Minute()] &&
			weekdays[int(t.Weekday())] {
			return t, nil
		}
		t = t.Add(time.Minute)
	}
	return time.Time{}, fmt.Errorf("no matching time found within 2 years for cron %q", expr)
}

// parseCronField parses a single cron field into a boolean lookup table.
func parseCronField(field string, min, max int) ([]bool, error) {
	size := max + 1
	table := make([]bool, size)

	if field == "*" {
		for i := min; i <= max; i++ {
			table[i] = true
		}
		return table, nil
	}

	// Handle */N step syntax.
	if strings.HasPrefix(field, "*/") {
		step, err := strconv.Atoi(field[2:])
		if err != nil || step <= 0 {
			return nil, fmt.Errorf("invalid step: %s", field)
		}
		for i := min; i <= max; i += step {
			table[i] = true
		}
		return table, nil
	}

	// Handle comma-separated values.
	for _, part := range strings.Split(field, ",") {
		// Check for step within a range: N-M/S
		if idx := strings.Index(part, "/"); idx >= 0 {
			rangePart := part[:idx]
			stepStr := part[idx+1:]
			step, err := strconv.Atoi(stepStr)
			if err != nil || step <= 0 {
				return nil, fmt.Errorf("invalid step in %s", part)
			}
			rangeMin, rangeMax := min, max
			if rangePart != "*" {
				bounds := strings.SplitN(rangePart, "-", 2)
				rangeMin, err = strconv.Atoi(bounds[0])
				if err != nil {
					return nil, fmt.Errorf("invalid range start in %s", part)
				}
				if len(bounds) == 2 {
					rangeMax, err = strconv.Atoi(bounds[1])
					if err != nil {
						return nil, fmt.Errorf("invalid range end in %s", part)
					}
				}
			}
			for i := rangeMin; i <= rangeMax; i += step {
				if i >= min && i <= max {
					table[i] = true
				}
			}
			continue
		}

		// Check for range N-M.
		if strings.Contains(part, "-") {
			bounds := strings.SplitN(part, "-", 2)
			lo, err := strconv.Atoi(bounds[0])
			if err != nil {
				return nil, fmt.Errorf("invalid range start in %s", part)
			}
			hi, err := strconv.Atoi(bounds[1])
			if err != nil {
				return nil, fmt.Errorf("invalid range end in %s", part)
			}
			for i := lo; i <= hi; i++ {
				if i >= min && i <= max {
					table[i] = true
				}
			}
			continue
		}

		// Single value.
		val, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid value: %s", part)
		}
		if val >= min && val <= max {
			table[val] = true
		}
	}
	return table, nil
}
