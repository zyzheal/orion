package service

import (
	"context"
	"fmt"
	"log"
	"orion/cron-svc-go/internal/models"
	"orion/cron-svc-go/internal/repository"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

var ErrCronJobNotFound = fmt.Errorf("cron job not found")
var ErrOnCallScheduleNotFound = fmt.Errorf("oncall schedule not found")

const defaultTickInterval = 60 * time.Second

// ── Service ──────────────────────────────────────────────────

type Service struct {
	repo *repository.Repository

	// Scheduler state
	running       bool
	ticker        *time.Ticker
	stopCh        chan struct{}
	runningJobIDs map[string]struct{}
	mu            sync.Mutex
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo:          repo,
		runningJobIDs: make(map[string]struct{}),
		stopCh:        make(chan struct{}),
	}
}

// ═══════════════════════════════════════════════════════════════
//  Scheduler Lifecycle
// ═══════════════════════════════════════════════════════════════

// Start launches the scheduler loop that ticks every 60 seconds.
// It also restores enabled jobs from the database.
func (s *Service) Start(ctx context.Context) {
	if s.running {
		log.Println("scheduler already running")
		return
	}
	s.running = true
	s.ticker = time.NewTicker(defaultTickInterval)

	// Restore enabled jobs
	jobs, err := s.repo.FindEnabledCronJobs(ctx)
	if err != nil {
		log.Printf("failed to restore enabled jobs: %v", err)
	} else {
		log.Printf("restored %d enabled cron jobs from DB", len(jobs))
	}

	go func() {
		for {
			select {
			case <-s.stopCh:
				return
			case <-s.ticker.C:
				s.tick(ctx)
			}
		}
	}()
	log.Println("cron scheduler started")
}

// Stop halts the scheduler loop.
func (s *Service) Stop() {
	if !s.running {
		return
	}
	s.running = false
	s.ticker.Stop()
	close(s.stopCh)
	log.Println("cron scheduler stopped")
}

// tick checks all enabled jobs and executes those that are due.
func (s *Service) tick(ctx context.Context) {
	jobs, err := s.repo.FindEnabledCronJobs(ctx)
	if err != nil {
		log.Printf("scheduler tick: failed to load jobs: %v", err)
		return
	}

	now := time.Now()
	for _, job := range jobs {
		if !job.Enabled {
			continue
		}
		s.mu.Lock()
		_, alreadyRunning := s.runningJobIDs[job.ID]
		s.mu.Unlock()
		if alreadyRunning {
			continue
		}

		if s.shouldExecute(job, now) {
			log.Printf("scheduler tick: executing job %s (%s)", job.ID, job.Name)
			go func(j models.CronJob) {
				if _, err := s.ExecuteJob(ctx, j.TenantID, j.ID); err != nil {
					log.Printf("scheduler tick: job %s failed: %v", j.ID, err)
				}
			}(job)
		}
	}
}

// shouldExecute determines if a cron job should run at the given time.
// It parses the cron expression and checks if the previous scheduled
// time falls within the tick window (60s + 5s tolerance).
func (s *Service) shouldExecute(job models.CronJob, now time.Time) bool {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(job.Schedule)
	if err != nil {
		log.Printf("invalid cron expression for job %s: %v", job.ID, err)
		return false
	}

	// Walk backwards to find the most recent scheduled time before now.
	prev := now.Add(-defaultTickInterval)
	var lastScheduled time.Time
	for t := sched.Next(prev); !t.After(now); t = sched.Next(t) {
		lastScheduled = t
	}
	if lastScheduled.IsZero() {
		return false
	}

	diff := now.Sub(lastScheduled)
	return diff < defaultTickInterval+5*time.Second
}

// computeNextRun returns the next execution time for a cron expression.
func computeNextRun(expression string) *time.Time {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(expression)
	if err != nil {
		return nil
	}
	next := sched.Next(time.Now())
	return &next
}

// ═══════════════════════════════════════════════════════════════
//  CronJob CRUD
// ═══════════════════════════════════════════════════════════════

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateCronJobRequest) (*models.CronJob, error) {
	// Validate cron expression
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	if _, err := parser.Parse(req.Schedule); err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}

	payload := req.Payload
	if payload == nil {
		payload = models.JSONB{}
	}

	j := &models.CronJob{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Schedule:  req.Schedule,
		Command:   req.Command,
		Payload:   payload,
		Enabled:   true,
		NextRunAt: computeNextRun(req.Schedule),
	}
	if err := s.repo.CreateCronJob(ctx, j); err != nil {
		return nil, err
	}
	return j, nil
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CronJob, error) {
	return s.repo.ListCronJobs(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return s.repo.GetCronJobByID(ctx, tenantID, id)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateCronJobRequest) error {
	if req.Schedule != nil {
		parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
		if _, err := parser.Parse(*req.Schedule); err != nil {
			return fmt.Errorf("invalid cron expression: %w", err)
		}
	}
	return s.repo.UpdateCronJob(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCronJob(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountCronJobs(ctx, tenantID)
}

func (s *Service) Enable(ctx context.Context, tenantID, id string) error {
	return s.repo.EnableCronJob(ctx, tenantID, id)
}

func (s *Service) Disable(ctx context.Context, tenantID, id string) error {
	return s.repo.DisableCronJob(ctx, tenantID, id)
}

// ═══════════════════════════════════════════════════════════════
//  CronJob Execution
// ═══════════════════════════════════════════════════════════════

// ExecuteJob runs a cron job, records the execution, and updates the job's last-run metadata.
func (s *Service) ExecuteJob(ctx context.Context, tenantID, jobID string) (*models.CronExecution, error) {
	job, err := s.repo.GetCronJobByID(ctx, tenantID, jobID)
	if err != nil {
		return nil, ErrCronJobNotFound
	}

	executionID := fmt.Sprintf("exec_%d_%s", time.Now().UnixMilli(), job.ID)
	now := time.Now()

	exec := &models.CronExecution{
		ID:        executionID,
		JobID:     job.ID,
		StartedAt: now,
		Status:    "running",
	}

	// Track running state
	s.mu.Lock()
	s.runningJobIDs[job.ID] = struct{}{}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.runningJobIDs, job.ID)
		s.mu.Unlock()
	}()

	// Persist execution start
	if err := s.repo.CreateExecution(ctx, exec); err != nil {
		log.Printf("failed to persist execution record: %v", err)
	}

	// Execute the task
	output, execErr := s.executeTask(job)

	completedAt := time.Now()
	exec.CompletedAt = &completedAt

	nextRun := computeNextRun(job.Schedule)

	if execErr != nil {
		exec.Status = "failed"
		errMsg := execErr.Error()
		exec.Error = &errMsg

		_ = s.repo.CompleteExecution(ctx, executionID, "failed", nil, &errMsg)
		if nextRun != nil {
			_ = s.repo.UpdateCronJobLastRun(ctx, job.ID, completedAt, "failed", *nextRun)
		}
		log.Printf("cron job %s execution failed: %v", job.ID, execErr)
	} else {
		exec.Status = "success"
		exec.Output = &output

		_ = s.repo.CompleteExecution(ctx, executionID, "success", &output, nil)
		if nextRun != nil {
			_ = s.repo.UpdateCronJobLastRun(ctx, job.ID, completedAt, "success", *nextRun)
		}
		log.Printf("cron job %s executed successfully", job.ID)
	}

	return exec, nil
}

// executeTask dispatches the actual task logic.
// In production this would dispatch to registered task handlers.
func (s *Service) executeTask(job *models.CronJob) (string, error) {
	log.Printf("executing cron task: %s (handler=%s)", job.ID, job.Command)
	return fmt.Sprintf("Task %q executed successfully at %s", job.Command, time.Now().UTC().Format(time.RFC3339)), nil
}

func (s *Service) GetExecutionHistory(ctx context.Context, jobID string, offset, limit int) ([]models.CronExecution, error) {
	if jobID != "" {
		return s.repo.GetExecutionHistory(ctx, jobID, offset, limit)
	}
	return s.repo.ListAllExecutions(ctx, offset, limit)
}

func (s *Service) GetRunningJobIDs() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	ids := make([]string, 0, len(s.runningJobIDs))
	for id := range s.runningJobIDs {
		ids = append(ids, id)
	}
	return ids
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Schedules
// ═══════════════════════════════════════════════════════════════

func (s *Service) CreateOnCallSchedule(ctx context.Context, tenantID string, req *models.CreateOnCallScheduleRequest) (*models.OnCallSchedule, error) {
	if len(req.TeamMembers) == 0 {
		return nil, fmt.Errorf("team_members is required and must not be empty")
	}

	tz := req.Timezone
	if tz == "" {
		tz = "UTC"
	}
	startHour := req.RotationStartHour
	if startHour == 0 {
		startHour = 9
	}

	escalations := req.Escalations
	if escalations == nil {
		escalations = []models.EscalationRule{}
	}

	now := time.Now()
	schedule := &models.OnCallSchedule{
		ID:                fmt.Sprintf("schedule_%s", uuid.New().String()),
		TenantID:          tenantID,
		Name:              req.Name,
		Timezone:          tz,
		RotationType:      req.RotationType,
		RotationStartHour: startHour,
		TeamMembers:       models.StringSlice(req.TeamMembers),
		StartDate:         now,
		Escalations:       models.EscalationSlice(escalations),
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.CreateOnCallSchedule(ctx, schedule); err != nil {
		return nil, err
	}

	// Generate rotation assignments
	if err := s.generateAssignments(ctx, schedule); err != nil {
		log.Printf("failed to generate assignments for schedule %s: %v", schedule.ID, err)
	}

	return schedule, nil
}

func (s *Service) GetOnCallSchedule(ctx context.Context, tenantID, id string) (*models.OnCallSchedule, error) {
	return s.repo.GetOnCallScheduleByID(ctx, tenantID, id)
}

func (s *Service) ListOnCallSchedules(ctx context.Context, tenantID string) ([]models.OnCallSchedule, error) {
	return s.repo.ListOnCallSchedules(ctx, tenantID)
}

func (s *Service) DeleteOnCallSchedule(ctx context.Context, tenantID, id string) error {
	// Clean up assignments and overrides first
	_ = s.repo.DeleteAssignmentsBySchedule(ctx, id)
	_ = s.repo.DeleteOverridesBySchedule(ctx, id)
	return s.repo.DeleteOnCallSchedule(ctx, tenantID, id)
}

// generateAssignments creates rotation assignments for each team member.
func (s *Service) generateAssignments(ctx context.Context, schedule *models.OnCallSchedule) error {
	current := time.Now()
	for i := 0; i < len(schedule.TeamMembers); i++ {
		userID := schedule.TeamMembers[i%len(schedule.TeamMembers)]
		endTime := endOfRotation(schedule.RotationType, current)

		assignment := &models.OnCallAssignment{
			ID:         fmt.Sprintf("assign_%s", uuid.New().String()),
			ScheduleID: schedule.ID,
			UserID:     userID,
			StartTime:  current,
			EndTime:    endTime,
		}

		if err := s.repo.CreateOnCallAssignment(ctx, assignment); err != nil {
			return fmt.Errorf("failed to create assignment for user %s: %w", userID, err)
		}
		current = endTime
	}
	return nil
}

func endOfRotation(rotationType string, start time.Time) time.Time {
	switch rotationType {
	case "daily":
		return start.AddDate(0, 0, 1)
	case "weekly":
		return start.AddDate(0, 0, 7)
	case "monthly":
		return start.AddDate(0, 1, 0)
	default:
		return start.AddDate(0, 0, 1)
	}
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Check
// ═══════════════════════════════════════════════════════════════

// GetCurrentOnCall returns the current on-call person for a schedule.
// It checks overrides first, then falls back to the active assignment.
func (s *Service) GetCurrentOnCall(ctx context.Context, tenantID, scheduleID string) (*models.OnCallCheckResult, error) {
	schedule, err := s.repo.GetOnCallScheduleByID(ctx, tenantID, scheduleID)
	if err != nil {
		return &models.OnCallCheckResult{IsOnCall: false}, nil
	}

	now := time.Now()

	// Check for active override
	override, _ := s.repo.FindActiveOverride(ctx, scheduleID, now)
	if override != nil {
		escalations := getEscalationTargets(schedule, override.OverrideUserID)
		return &models.OnCallCheckResult{
			IsOnCall:          true,
			PrimaryUserID:     &override.OverrideUserID,
			EscalationTargets: escalations,
		}, nil
	}

	// Find active assignment
	assignment, _ := s.repo.FindActiveAssignment(ctx, scheduleID, now)
	if assignment != nil {
		escalations := getEscalationTargets(schedule, assignment.UserID)
		return &models.OnCallCheckResult{
			IsOnCall:          true,
			PrimaryUserID:     &assignment.UserID,
			EscalationTargets: escalations,
		}, nil
	}

	// No active assignment - use fallback
	var fallback *string
	if len(schedule.TeamMembers) > 0 {
		fb := schedule.TeamMembers[0]
		fallback = &fb
	}
	return &models.OnCallCheckResult{
		IsOnCall:          false,
		PrimaryUserID:     fallback,
		EscalationTargets: getEscalationTargets(schedule, ""),
	}, nil
}

// getEscalationTargets returns all team members except the excluded user.
func getEscalationTargets(schedule *models.OnCallSchedule, excludeUserID string) []string {
	targets := make([]string, 0)
	for _, member := range schedule.TeamMembers {
		if member != excludeUserID {
			targets = append(targets, member)
		}
	}
	return targets
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Overrides
// ═══════════════════════════════════════════════════════════════

func (s *Service) CreateOnCallOverride(ctx context.Context, scheduleID string, req *models.CreateOnCallOverrideRequest) (*models.OnCallOverride, error) {
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid start_time: %w", err)
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid end_time: %w", err)
	}

	override := &models.OnCallOverride{
		ID:             fmt.Sprintf("override_%s", uuid.New().String()),
		ScheduleID:     scheduleID,
		OriginalUserID: req.OriginalUserID,
		OverrideUserID: req.OverrideUserID,
		StartTime:      startTime,
		EndTime:        endTime,
		Reason:         req.Reason,
	}

	if err := s.repo.CreateOnCallOverride(ctx, override); err != nil {
		return nil, err
	}
	return override, nil
}
