package main

import (
	"context"
	"go.uber.org/zap"
	"time"

	"orion/go-common/pkg/database"

	visor_handler "orion/platform-svc-go/internal/visor-exec/handler"
	visor_models "orion/platform-svc-go/internal/visor-exec/models"
	visor_repo "orion/platform-svc-go/internal/visor-exec/repository"
	visor_service "orion/platform-svc-go/internal/visor-exec/service"
)

var visorExecH *visor_handler.Handler

func wireVisorExec(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := visor_repo.NewRepository(db.DB)
	// Adapter: concrete repo expects tenantID-bearing methods; the service
	// interface is tenant-free. Pass "" as tenant placeholder.
	svc := visor_service.NewService(&visorTenantBridge{repo: repo})
	visorExecH = visor_handler.NewHandler(svc)
}

// visorTenantBridge adapts the concrete repository's tenant-bearing methods
// to the tenant-free signatures expected by the service layer.
type visorTenantBridge struct {
	repo *visor_repo.Repository
}

func (r *visorTenantBridge) CreateCommandLog(ctx context.Context, log *visor_models.CommandLog) error {
	return r.repo.CreateCommandLog(ctx, log)
}
func (r *visorTenantBridge) CreateCommandLogDetails(ctx context.Context, details []visor_models.CommandLogDetail) error {
	return r.repo.CreateCommandLogDetails(ctx, "", details)
}
func (r *visorTenantBridge) ListCommandLogs(ctx context.Context, tenantID string, page, pageSize int) ([]visor_models.CommandLog, error) {
	return r.repo.ListCommandLogs(ctx, tenantID, page, pageSize)
}
func (r *visorTenantBridge) CountCommandLogs(ctx context.Context, tenantID string) (int, error) {
	return r.repo.CountCommandLogs(ctx, tenantID)
}
func (r *visorTenantBridge) GetCommandLogByID(ctx context.Context, id string) (*visor_models.CommandLog, error) {
	return r.repo.GetCommandLogByID(ctx, "", id)
}
func (r *visorTenantBridge) GetCommandLogDetailsByCommandID(ctx context.Context, id string) ([]visor_models.CommandLogDetail, error) {
	return r.repo.GetCommandLogDetailsByCommandID(ctx, "", id)
}
func (r *visorTenantBridge) CreateTemplate(ctx context.Context, tmpl *visor_models.Template) error {
	return r.repo.CreateTemplate(ctx, tmpl)
}
func (r *visorTenantBridge) ListTemplates(ctx context.Context) ([]visor_models.Template, error) {
	return r.repo.ListTemplates(ctx, "")
}
func (r *visorTenantBridge) CountTemplates(ctx context.Context) (int, error) {
	return r.repo.CountTemplates(ctx, "")
}
func (r *visorTenantBridge) GetTemplateByID(ctx context.Context, id string) (*visor_models.Template, error) {
	return r.repo.GetTemplateByID(ctx, "", id)
}
func (r *visorTenantBridge) UpdateTemplate(ctx context.Context, id string, updates map[string]interface{}) error {
	return r.repo.UpdateTemplate(ctx, "", id, updates)
}
func (r *visorTenantBridge) DeleteTemplate(ctx context.Context, id string) error {
	return r.repo.DeleteTemplate(ctx, "", id)
}
func (r *visorTenantBridge) CreateCronJob(ctx context.Context, job *visor_models.CronJob) error {
	return r.repo.CreateCronJob(ctx, job)
}
func (r *visorTenantBridge) ListCronJobs(ctx context.Context) ([]visor_models.CronJob, error) {
	return r.repo.ListCronJobs(ctx, "")
}
func (r *visorTenantBridge) CountCronJobs(ctx context.Context) (int, error) {
	return r.repo.CountCronJobs(ctx, "")
}
func (r *visorTenantBridge) GetCronJobByID(ctx context.Context, id string) (*visor_models.CronJob, error) {
	return r.repo.GetCronJobByID(ctx, "", id)
}
func (r *visorTenantBridge) UpdateCronJob(ctx context.Context, id string, updates map[string]interface{}) error {
	return r.repo.UpdateCronJob(ctx, "", id, updates)
}
func (r *visorTenantBridge) DeleteCronJob(ctx context.Context, id string) error {
	return r.repo.DeleteCronJob(ctx, "", id)
}
func (r *visorTenantBridge) ToggleCronJob(ctx context.Context, id string, enabled bool) error {
	return r.repo.ToggleCronJob(ctx, "", id, enabled)
}
func (r *visorTenantBridge) UpdateCronJobLastRun(ctx context.Context, id string, lastRunAt time.Time) error {
	return r.repo.UpdateCronJobLastRun(ctx, "", id, lastRunAt)
}
func (r *visorTenantBridge) CreateCronJobLog(ctx context.Context, log *visor_models.CronJobLog) error {
	return r.repo.CreateCronJobLog(ctx, log)
}
func (r *visorTenantBridge) ListCronJobLogsByJobID(ctx context.Context, jobID string, page, pageSize int) ([]visor_models.CronJobLog, error) {
	return r.repo.ListCronJobLogsByJobID(ctx, "", jobID, page, pageSize)
}
func (r *visorTenantBridge) CountCronJobLogsByJobID(ctx context.Context, jobID string) (int, error) {
	return r.repo.CountCronJobLogsByJobID(ctx, "", jobID)
}
func (r *visorTenantBridge) CreateUploadTask(ctx context.Context, task *visor_models.UploadTask) error {
	return r.repo.CreateUploadTask(ctx, task)
}
func (r *visorTenantBridge) ListUploadTasks(ctx context.Context) ([]visor_models.UploadTask, error) {
	return r.repo.ListUploadTasks(ctx, "")
}
func (r *visorTenantBridge) CountUploadTasks(ctx context.Context) (int, error) {
	return r.repo.CountUploadTasks(ctx, "")
}
func (r *visorTenantBridge) GetUploadTaskByID(ctx context.Context, id string) (*visor_models.UploadTask, error) {
	return r.repo.GetUploadTaskByID(ctx, "", id)
}
func (r *visorTenantBridge) UpdateUploadTask(ctx context.Context, id string, updates map[string]interface{}) error {
	return r.repo.UpdateUploadTask(ctx, "", id, updates)
}
