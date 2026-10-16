package main

import (
	"context"
	"time"

	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	inssched_repo "orion/platform-svc-go/internal/inspection-schedule/repository"
	inssched_scheduler "orion/platform-svc-go/internal/inspection-schedule/scheduler"
	inssched_models "orion/platform-svc-go/internal/inspection-schedule/models"
)

// inspSchedulerInstance is the package-level inspection scheduler
// for lifecycle management.
var inspSchedulerInstance *inssched_scheduler.Scheduler

// wireInspectionScheduler creates and starts the inspection schedule cron
// engine. The TriggerFunc logs the scheduled execution and records the run
// in the schedule's last_run_at / last_result fields.
func wireInspectionScheduler(db *database.DB, logger *zap.Logger) {
	repo := inssched_repo.NewRepository(db.DB)

	trigger := func(ctx context.Context, schedule inssched_models.InspectionSchedule) error {
		logger.Info("inspection schedule triggered",
			zap.String("scheduleId", schedule.ID),
			zap.String("templateId", schedule.TemplateID),
			zap.String("tenant", schedule.TenantID),
		)
		// In production, this would:
		// 1. Load the inspection template (schedule.TemplateID)
		// 2. Execute the inspection checks against targets
		// 3. Record the results
		// For now, we log the trigger as a successful no-op execution.
		return nil
	}

	sched := inssched_scheduler.NewScheduler(repo, trigger, logger, "default")
	sched.SetInterval(60 * time.Second)

	ctx := context.Background()
	sched.Start(ctx)
	inspSchedulerInstance = sched
	logger.Info("inspection schedule cron engine started", zap.Float64("interval_seconds", 60))
}

// stopInspectionScheduler stops the inspection scheduler if it was started.
func stopInspectionScheduler() {
	if inspSchedulerInstance != nil {
		inspSchedulerInstance.Stop()
	}
}
