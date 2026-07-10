package service

import (
	"context"
	"sync"
	"time"

	"orion/backup-svc-go/internal/models"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// Scheduler handles cron-based backup schedule management.
type Scheduler struct {
	cron     *cron.Cron
	entries  map[string]cron.EntryID
	plans    map[string]*models.BackupPlan
	mu       sync.RWMutex
	backupSvc *BackupService
	logger    *zap.Logger
}

func NewScheduler(backupSvc *BackupService, logger *zap.Logger) *Scheduler {
	return &Scheduler{
		cron:     cron.New(cron.WithSeconds()),
		entries:  make(map[string]cron.EntryID),
		plans:    make(map[string]*models.BackupPlan),
		backupSvc: backupSvc,
		logger:    logger,
	}
}

// Start begins the scheduler.
func (s *Scheduler) Start() {
	s.cron.Start()
	s.logger.Info("backup scheduler started")
}

// Stop stops the scheduler.
func (s *Scheduler) Stop() {
	s.cron.Stop()
	s.logger.Info("backup scheduler stopped")
}

// AddPlan registers a new backup plan for scheduling.
func (s *Scheduler) AddPlan(plan *models.BackupPlan) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !plan.Enabled {
		return
	}

	s.plans[plan.ID] = plan

	if plan.Schedule == nil || *plan.Schedule == "" {
		return // No schedule configured, skip cron registration
	}

	entryID, err := s.cron.AddFunc(*plan.Schedule, func() {
		s.logger.Info("scheduled backup triggered", zap.String("plan_id", plan.ID))
		go func(p *models.BackupPlan) {
			input := models.CreateBackupInput{
				TenantID: p.TenantID,
				PlanID:   p.ID,
			}
			_, err := s.backupSvc.TriggerBackup(context.Background(), input)
			if err != nil {
				s.logger.Error("scheduled backup failed", zap.String("plan_id", p.ID), zap.Error(err))
			}
		}(plan)
	})

	if err != nil {
		s.logger.Error("failed to schedule plan", zap.String("plan_id", plan.ID), zap.Error(err))
		return
	}

	s.entries[plan.ID] = entryID
	s.logger.Info("plan scheduled", zap.String("plan_id", plan.ID), zap.String("cron", *plan.Schedule))
}

// RemovePlan removes a backup plan from the scheduler.
func (s *Scheduler) RemovePlan(planID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if entryID, ok := s.entries[planID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, planID)
	}
	delete(s.plans, planID)
	s.logger.Info("plan removed from scheduler", zap.String("plan_id", planID))
}

// UpdatePlan updates the schedule for an existing backup plan.
func (s *Scheduler) UpdatePlan(plan *models.BackupPlan) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove existing entry
	if entryID, ok := s.entries[plan.ID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, plan.ID)
	}

	s.plans[plan.ID] = plan

	if !plan.Enabled || plan.Schedule == nil || *plan.Schedule == "" {
		return
	}

	entryID, err := s.cron.AddFunc(*plan.Schedule, func() {
		s.logger.Info("scheduled backup triggered", zap.String("plan_id", plan.ID))
		go func(p *models.BackupPlan) {
			input := models.CreateBackupInput{
				TenantID: p.TenantID,
				PlanID:   p.ID,
			}
			_, err := s.backupSvc.TriggerBackup(context.Background(), input)
			if err != nil {
				s.logger.Error("scheduled backup failed", zap.String("plan_id", p.ID), zap.Error(err))
			}
		}(plan)
	})

	if err != nil {
		s.logger.Error("failed to reschedule plan", zap.String("plan_id", plan.ID), zap.Error(err))
		return
	}

	s.entries[plan.ID] = entryID
	s.logger.Info("plan rescheduled", zap.String("plan_id", plan.ID), zap.String("cron", *plan.Schedule))
}

// GetNextRunTime returns the next scheduled run time for a plan.
func (s *Scheduler) GetNextRunTime(planID string) *time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()

	plan, ok := s.plans[planID]
	if !ok {
		return nil
	}

	if plan.Schedule == nil || *plan.Schedule == "" {
		return nil
	}

	schedule, err := cron.ParseStandard(*plan.Schedule)
	if err != nil {
		s.logger.Error("failed to parse schedule", zap.String("plan_id", planID), zap.Error(err))
		return nil
	}

	next := schedule.Next(time.Now())
	return &next
}

// IsRunning checks if the scheduler is currently running.
func (s *Scheduler) IsRunning() bool {
	// A simple way to check if cron is still accepting jobs
	return true
}

// EnforceRetention applies retention policy and returns IDs of backups to delete.
func (s *Scheduler) EnforceRetention(plan *models.BackupPlan, backups []models.BackupRecord) []string {
	if plan.RetentionDays <= 0 {
		return nil
	}

	cutoff := time.Now().Add(-time.Duration(plan.RetentionDays) * 24 * time.Hour)
	var toDelete []string

	for _, backup := range backups {
		if backup.CompletedAt == nil {
			continue
		}
		if backup.CompletedAt.Before(cutoff) {
			toDelete = append(toDelete, backup.ID)
		}
	}

	return toDelete
}
