package cron

import (
	"time"

	"github.com/robfig/cron/v3"
)

// Job represents a single schedulable task registered with the Scheduler.
type Job struct {
	// Name is the unique identifier for this job within the scheduler.
	Name string

	// Spec is the cron expression (or standard interval string) governing when the job runs.
	Spec string

	// LastRun is the most recent time the job was executed. Set by the scheduler.
	LastRun time.Time

	// NextRun is the next scheduled execution time. Set by the scheduler.
	NextRun time.Time

	// cmd is the function invoked when the job fires. It is unexported so that
	// callers cannot mutate the registered behaviour after registration.
	cmd func()

	// entryID is the robfig/cron entry identifier managed by the Scheduler.
	entryID cron.EntryID
}

// Run invokes the job's command. It is called by the Scheduler's cron engine
// and should not be invoked manually by consumers.
func (j *Job) Run() {
	j.cmd()
}
