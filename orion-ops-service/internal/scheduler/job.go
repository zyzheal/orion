package scheduler

import (
	"fmt"
	"sync"

	"gorm.io/gorm"
)

// JobManager manages job lifecycle
type JobManager struct {
	db        *gorm.DB
	executors map[string]JobExecutor
	mu        sync.RWMutex
}

// JobExecutor defines the interface for job execution
type JobExecutor interface {
	Execute(job *CronJob) error
}

// NewJobManager creates a new JobManager
func NewJobManager(db *gorm.DB) *JobManager {
	return &JobManager{
		db:        db,
		executors: make(map[string]JobExecutor),
	}
}

// RegisterExecutor registers a job executor for a specific command type
func (jm *JobManager) RegisterExecutor(commandType string, executor JobExecutor) {
	jm.mu.Lock()
	defer jm.mu.Unlock()
	jm.executors[commandType] = executor
}

// ExecuteJob manually executes a job
func (jm *JobManager) ExecuteJob(job *CronJob) error {
	jm.mu.RLock()
	executor, ok := jm.executors[job.Command]
	jm.mu.RUnlock()

	if !ok {
		// Default execution - just simulate
		return jm.defaultExecute(job)
	}

	return executor.Execute(job)
}

// GetJob retrieves a job by ID
func (jm *JobManager) GetJob(jobID string) (*CronJob, error) {
	var job CronJob
	if err := jm.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, fmt.Errorf("job not found: %w", err)
	}
	return &job, nil
}

// PauseJob pauses a cron job
func (jm *JobManager) PauseJob(jobID string) error {
	var job CronJob
	if err := jm.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	job.Status = JobStatusPaused
	if err := jm.db.Model(&job).Update("status", JobStatusPaused).Error; err != nil {
		return fmt.Errorf("failed to pause job: %w", err)
	}

	return nil
}

// ResumeJob resumes a paused cron job
func (jm *JobManager) ResumeJob(jobID string) error {
	var job CronJob
	if err := jm.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return fmt.Errorf("job not found: %w", err)
	}

	job.Status = JobStatusActive
	if err := jm.db.Model(&job).Update("status", JobStatusActive).Error; err != nil {
		return fmt.Errorf("failed to resume job: %w", err)
	}

	return nil
}

// defaultExecute is the default job execution logic
func (jm *JobManager) defaultExecute(job *CronJob) error {
	// In a real implementation, this would SSH to hosts and execute commands
	// For now, just log
	fmt.Printf("Executing job: %s with command: %s\n", job.Name, job.Command)
	return nil
}