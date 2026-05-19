package scheduler

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

// CronScheduler manages scheduled cron jobs
type CronScheduler struct {
	db      *gorm.DB
	cron    *cron.Cron
	jobs    map[string]cron.EntryID
	mu      sync.RWMutex
	running bool
}

// NewCronScheduler creates a new CronScheduler
func NewCronScheduler(db *gorm.DB) *CronScheduler {
	return &CronScheduler{
		db:   db,
		cron: cron.New(),
		jobs: make(map[string]cron.EntryID),
	}
}

// CreateCronJob creates a new cron job
func (cs *CronScheduler) CreateCronJob(job *CronJob) error {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}

	if job.Status == "" {
		job.Status = JobStatusActive
	}

	// Validate cron expression
	if _, err := cron.ParseStandard(job.Schedule); err != nil {
		return fmt.Errorf("invalid cron expression: %w", err)
	}

	// Save to database
	if err := cs.db.Create(job).Error; err != nil {
		return fmt.Errorf("failed to create job: %w", err)
	}

	// Add to scheduler if running
	cs.mu.Lock()
	if cs.running && job.Status == JobStatusActive {
		entryID, err := cs.cron.AddFunc(job.Schedule, func() {
			cs.executeJob(job)
		})
		if err != nil {
			cs.mu.Unlock()
			return fmt.Errorf("failed to schedule job: %w", err)
		}
		cs.jobs[job.ID] = entryID
	}
	cs.mu.Unlock()

	// Calculate next run time
	nextRun := cs.calculateNextRun(job.Schedule)
	job.NextRunAt = &nextRun
	cs.db.Model(job).Update("next_run_at", nextRun)

	return nil
}

// UpdateCronJob updates an existing cron job
func (cs *CronScheduler) UpdateCronJob(id string, job *CronJob) error {
	var existingJob CronJob
	if err := cs.db.Where("id = ?", id).First(&existingJob).Error; err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	// Validate cron expression if changed
	if job.Schedule != existingJob.Schedule {
		if _, err := cron.ParseStandard(job.Schedule); err != nil {
			return fmt.Errorf("invalid cron expression: %w", err)
		}
	}

	// Update in database
	job.UpdatedAt = time.Now()
	if err := cs.db.Model(&existingJob).Updates(job).Error; err != nil {
		return fmt.Errorf("failed to update job: %w", err)
	}

	// Update scheduler
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// Remove old entry
	if entryID, ok := cs.jobs[id]; ok {
		cs.cron.Remove(entryID)
		delete(cs.jobs, id)
	}

	// Add new entry if running and active
	if cs.running && job.Status == JobStatusActive {
		entryID, err := cs.cron.AddFunc(job.Schedule, func() {
			cs.executeJob(&existingJob)
		})
		if err != nil {
			return fmt.Errorf("failed to reschedule job: %w", err)
		}
		cs.jobs[id] = entryID
	}

	return nil
}

// DeleteCronJob deletes a cron job
func (cs *CronScheduler) DeleteCronJob(id string) error {
	var job CronJob
	if err := cs.db.Where("id = ?", id).First(&job).Error; err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	// Remove from scheduler
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if entryID, ok := cs.jobs[id]; ok {
		cs.cron.Remove(entryID)
		delete(cs.jobs, id)
	}

	// Delete from database
	if err := cs.db.Delete(&job).Error; err != nil {
		return fmt.Errorf("failed to delete job: %w", err)
	}

	return nil
}

// ListCronJobs returns all cron jobs
func (cs *CronScheduler) ListCronJobs() ([]CronJob, error) {
	var jobs []CronJob
	if err := cs.db.Find(&jobs).Error; err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}
	return jobs, nil
}

// Start starts the scheduler
func (cs *CronScheduler) Start() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if cs.running {
		return nil
	}

	// Load active jobs from database
	var jobs []CronJob
	if err := cs.db.Where("status = ?", JobStatusActive).Find(&jobs).Error; err != nil {
		return fmt.Errorf("failed to load jobs: %w", err)
	}

	// Schedule each job
	for _, job := range jobs {
		entryID, err := cs.cron.AddFunc(job.Schedule, func() {
			cs.executeJob(&job)
		})
		if err != nil {
			continue
		}
		cs.jobs[job.ID] = entryID
	}

	cs.cron.Start()
	cs.running = true

	return nil
}

// Stop stops the scheduler
func (cs *CronScheduler) Stop() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if !cs.running {
		return nil
	}

	ctx := cs.cron.Stop()
	<-ctx.Done()

	cs.running = false
	cs.jobs = make(map[string]cron.EntryID)

	return nil
}

// executeJob runs a cron job
func (cs *CronScheduler) executeJob(job *CronJob) {
	now := time.Now()

	// Update last run time
	job.LastRunAt = &now
	cs.db.Model(job).Update("last_run_at", now)

	// In a real implementation, would execute the command via SSH
	// For now, just log and update
	fmt.Printf("Executing cron job: %s (%s)\n", job.Name, job.Command)

	// Calculate next run
	nextRun := cs.calculateNextRun(job.Schedule)
	job.NextRunAt = &nextRun
	cs.db.Model(job).Update("next_run_at", nextRun)
}

// calculateNextRun calculates the next run time from a cron expression
func (cs *CronScheduler) calculateNextRun(cronExpr string) time.Time {
	schedule, err := cron.ParseStandard(cronExpr)
	if err != nil {
		return time.Time{}
	}
	return schedule.Next(time.Now())
}