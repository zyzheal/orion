package scheduler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inspection-schedule/models"
	insschedrepo "orion/platform-svc-go/internal/inspection-schedule/repository"
	"orion/platform-svc-go/internal/repository"
)

// TriggerFunc is called when a scheduled inspection is due. It receives the
// schedule that triggered and should perform the actual inspection work.
type TriggerFunc func(ctx context.Context, schedule models.InspectionSchedule) error

// Scheduler periodically checks for due inspection schedules and triggers
// their associated inspection templates. It runs as a background goroutine.
type Scheduler struct {
	repo     *insschedrepo.Repository
	logger   *zap.Logger
	trigger  TriggerFunc
	tenants  []string
	interval time.Duration

	cronParser cron.Parser
	stopCh     chan struct{}
	wg         sync.WaitGroup
}

// NewScheduler creates a new inspection schedule cron engine.
func NewScheduler(repo *insschedrepo.Repository, trigger TriggerFunc, logger *zap.Logger, tenants ...string) *Scheduler {
	return &Scheduler{
		repo:       repo,
		logger:     logger,
		trigger:    trigger,
		tenants:    tenants,
		interval:   60 * time.Second,
		cronParser: cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow),
		stopCh:     make(chan struct{}),
	}
}

// SetInterval overrides the default poll interval.
func (s *Scheduler) SetInterval(d time.Duration) {
	s.interval = d
}

// Start launches the background scheduling goroutine.
func (s *Scheduler) Start(ctx context.Context) {
	s.wg.Add(1)
	go s.run(ctx)
}

// Stop signals the background goroutine to stop and waits.
func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

// run is the main loop that periodically checks for due schedules.
func (s *Scheduler) run(ctx context.Context) {
	defer s.wg.Done()
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.tick(ctx); err != nil {
				s.logger.Error("scheduler tick failed", zap.Error(err))
			}
		}
	}
}

// tick checks all configured tenants for due schedules.
func (s *Scheduler) tick(ctx context.Context) error {
	for _, tenantID := range s.tenants {
		if err := s.checkTenant(ctx, tenantID); err != nil {
			s.logger.Warn("tenant schedule check failed",
				zap.String("tenant", tenantID),
				zap.Error(err))
		}
	}
	return nil
}

// checkTenant queries enabled schedules for a tenant and triggers any that
// are due.
func (s *Scheduler) checkTenant(ctx context.Context, tenantID string) error {
	ctx = repository.WithTenant(ctx, tenantID)
	schedules, _, err := s.repo.List(ctx, tenantID, &repository.ListQuery{Page: 1, PageSize: 1000})
	if err != nil {
		return fmt.Errorf("list schedules: %w", err)
	}

	now := time.Now().UTC()
	for _, sched := range schedules {
		if !sched.Enabled {
			continue
		}
		// Check if the schedule is due (NextRunAt is nil or in the past)
		if sched.NextRunAt != nil && sched.NextRunAt.After(now) {
			continue
		}

		// Trigger the inspection
		if s.trigger != nil {
			s.logger.Info("triggering inspection schedule",
				zap.String("schedule", sched.ID),
				zap.String("template", sched.TemplateID),
				zap.String("tenant", tenantID))
			if err := s.trigger(ctx, sched); err != nil {
				s.logger.Error("inspection trigger failed",
					zap.String("schedule", sched.ID),
					zap.Error(err))
			}
		}

		// Compute next run time and update the schedule
		nextRun, err := s.ComputeNextRun(sched.CronExpr, now)
		if err != nil {
			s.logger.Warn("invalid cron expression",
				zap.String("schedule", sched.ID),
				zap.String("cron", sched.CronExpr),
				zap.Error(err))
			continue
		}

		updates := map[string]interface{}{
			"next_run_at": nextRun,
			"last_run_at": now,
		}
		if err := s.repo.Update(ctx, tenantID, sched.ID, updates, 0); err != nil {
			s.logger.Error("failed to update schedule after trigger",
				zap.String("schedule", sched.ID),
				zap.Error(err))
		}
	}
	return nil
}

// ComputeNextRun parses the cron expression and returns the next scheduled
// time after "from". This is a pure function that can also be called
// synchronously from API handlers.
func (s *Scheduler) ComputeNextRun(cronExpr string, from time.Time) (time.Time, error) {
	sched, err := s.cronParser.Parse(cronExpr)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse cron %q: %w", cronExpr, err)
	}
	return sched.Next(from), nil
}

// ComputeNextRunStatic is a standalone helper that doesn't require a
// Scheduler instance. It uses the standard 5-field cron parser.
func ComputeNextRunStatic(cronExpr string, from time.Time) (time.Time, error) {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(cronExpr)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse cron %q: %w", cronExpr, err)
	}
	return sched.Next(from), nil
}
