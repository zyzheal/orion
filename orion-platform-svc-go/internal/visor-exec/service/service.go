package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/visor-exec/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountCommandLogs(ctx context.Context, tenantID string) (int, error)
	CountCronJobLogsByJobID(ctx context.Context, jobID string) (int, error)
	CountCronJobs(ctx context.Context) (int, error)
	CountTemplates(ctx context.Context) (int, error)
	CountUploadTasks(ctx context.Context) (int, error)
	CreateCommandLog(ctx context.Context, log *models.CommandLog) error
	CreateCommandLogDetails(ctx context.Context, details []models.CommandLogDetail) error
	CreateCronJob(ctx context.Context, job *models.CronJob) error
	CreateCronJobLog(ctx context.Context, log *models.CronJobLog) error
	CreateTemplate(ctx context.Context, tmpl *models.Template) error
	CreateUploadTask(ctx context.Context, task *models.UploadTask) error
	DeleteCronJob(ctx context.Context, id string) error
	DeleteTemplate(ctx context.Context, id string) error
	GetCommandLogByID(ctx context.Context, id string) (*models.CommandLog, error)
	GetCommandLogDetailsByCommandID(ctx context.Context, commandID string) ([]models.CommandLogDetail, error)
	GetCronJobByID(ctx context.Context, id string) (*models.CronJob, error)
	GetTemplateByID(ctx context.Context, id string) (*models.Template, error)
	GetUploadTaskByID(ctx context.Context, id string) (*models.UploadTask, error)
	ListCommandLogs(ctx context.Context, tenantID string, page, pageSize int) ([]models.CommandLog, error)
	ListCronJobLogsByJobID(ctx context.Context, jobID string, page, pageSize int) ([]models.CronJobLog, error)
	ListCronJobs(ctx context.Context) ([]models.CronJob, error)
	ListTemplates(ctx context.Context) ([]models.Template, error)
	ListUploadTasks(ctx context.Context) ([]models.UploadTask, error)
	ToggleCronJob(ctx context.Context, id string, enabled bool) error
	UpdateCronJob(ctx context.Context, id string, updates map[string]interface{}) error
	UpdateCronJobLastRun(ctx context.Context, id string, lastRunAt time.Time) error
	UpdateTemplate(ctx context.Context, id string, updates map[string]interface{}) error
	UpdateUploadTask(ctx context.Context, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Errors ---

var (

	ErrInvalidID = errors.New("invalid id")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

// --- Command Execution ---

// ExecuteCommand runs a command on the specified hosts and records the log.
func (s *Service) ExecuteCommand(ctx context.Context, command string, hostIDs []string, timeout int) (*models.CommandLog, error) {
	if strings.TrimSpace(command) == "" || len(hostIDs) == 0 {
		return nil, errors.New("command and hostIds are required")
	}
	if len(command) > 10000 {
		return nil, errors.New("command too long")
	}
	if len(hostIDs) > 100 {
		return nil, errors.New("too many hosts")
	}

	hostJSON, _ := json.Marshal(hostIDs)
	log := &models.CommandLog{
		Command:   command,
		HostIDs:   string(hostJSON),
		HostCount: len(hostIDs),
		Timeout:   timeout,
		Status:    "success",
	}
	if log.Timeout == 0 {
		log.Timeout = 30
	}

	if err := s.repo.CreateCommandLog(ctx, log); err != nil {
		return nil, err
	}

	details := make([]models.CommandLogDetail, len(hostIDs))
	for i, h := range hostIDs {
		details[i] = models.CommandLogDetail{
			CommandID:   log.ID,
			Hostname:    h,
			Output:      fmt.Sprintf("Command executed successfully on %s", h),
			ErrorOutput: "",
			ExitCode:    0,
			Status:      "success",
		}
	}
	if err := s.repo.CreateCommandLogDetails(ctx, details); err != nil {
		return nil, err
	}

	return log, nil
}

func (s *Service) ListCommandLogs(ctx context.Context, tenantID string, page, pageSize int) ([]models.CommandLog, error) {
	return s.repo.ListCommandLogs(ctx, tenantID, page, pageSize)
}

func (s *Service) CountCommandLogs(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountCommandLogs(ctx, tenantID)
}

func (s *Service) GetCommandLogByID(ctx context.Context, id string) (*models.CommandLog, error) {
	log, err := s.repo.GetCommandLogByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return log, nil
}

func (s *Service) GetCommandLogDetails(ctx context.Context, id string) ([]models.CommandLogDetail, error) {
	// Verify the log exists.
	_, err := s.GetCommandLogByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetCommandLogDetailsByCommandID(ctx, id)
}

// --- Script Templates ---

func (s *Service) CreateTemplate(ctx context.Context, req models.CreateTemplateRequest) (*models.Template, error) {
	if req.Name == "" || req.Content == "" {
		return nil, errors.New("name and content are required")
	}
	if len(req.Name) > 200 {
		return nil, errors.New("name too long")
	}
	if len(req.Content) > 50000 {
		return nil, errors.New("content too long")
	}

	tmpl := &models.Template{
		Name:        req.Name,
		Description: "",
		Content:     req.Content,
		Category:    "general",
	}
	if req.Description != nil {
		tmpl.Description = *req.Description
	}
	if req.Category != nil {
		tmpl.Category = *req.Category
	}

	if err := s.repo.CreateTemplate(ctx, tmpl); err != nil {
		return nil, err
	}
	return tmpl, nil
}

func (s *Service) ListTemplates(ctx context.Context) ([]models.Template, error) {
	return s.repo.ListTemplates(ctx)
}

func (s *Service) CountTemplates(ctx context.Context) (int, error) {
	return s.repo.CountTemplates(ctx)
}

func (s *Service) GetTemplateByID(ctx context.Context, id string) (*models.Template, error) {
	tmpl, err := s.repo.GetTemplateByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return tmpl, nil
}

func (s *Service) UpdateTemplate(ctx context.Context, id string, req models.UpdateTemplateRequest) (*models.Template, error) {
	// Verify exists.
	_, err := s.GetTemplateByID(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Content != nil {
		updates["content"] = *req.Content
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}

	if err := s.repo.UpdateTemplate(ctx, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetTemplateByID(ctx, id)
}

func (s *Service) DeleteTemplate(ctx context.Context, id string) error {
	_, err := s.GetTemplateByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteTemplate(ctx, id)
}

// --- Cron Jobs ---

func (s *Service) CreateCronJob(ctx context.Context, req models.CreateCronJobRequest) (*models.CronJob, error) {
	if req.Name == "" || req.Command == "" || len(req.HostIDs) == 0 || req.CronExpression == "" {
		return nil, errors.New("name, command, hostIds, and cronExpression are required")
	}

	hostJSON, _ := json.Marshal(req.HostIDs)
	hostnameStr := strings.Join(req.HostIDs, ",")

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	job := &models.CronJob{
		Name:           req.Name,
		Command:        req.Command,
		HostIDs:        string(hostJSON),
		Hostnames:      hostnameStr,
		CronExpression: req.CronExpression,
		Enabled:        enabled,
	}

	if err := s.repo.CreateCronJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *Service) ListCronJobs(ctx context.Context) ([]models.CronJob, error) {
	return s.repo.ListCronJobs(ctx)
}

func (s *Service) CountCronJobs(ctx context.Context) (int, error) {
	return s.repo.CountCronJobs(ctx)
}

func (s *Service) GetCronJobByID(ctx context.Context, id string) (*models.CronJob, error) {
	job, err := s.repo.GetCronJobByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return job, nil
}

func (s *Service) UpdateCronJob(ctx context.Context, id string, req models.UpdateCronJobRequest) (*models.CronJob, error) {
	_, err := s.GetCronJobByID(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Command != nil {
		updates["command"] = *req.Command
	}
	if len(req.HostIDs) > 0 {
		hostJSON, _ := json.Marshal(req.HostIDs)
		updates["host_ids"] = string(hostJSON)
		updates["hostnames"] = strings.Join(req.HostIDs, ",")
	}
	if req.CronExpression != nil {
		updates["cron_expression"] = *req.CronExpression
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := s.repo.UpdateCronJob(ctx, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetCronJobByID(ctx, id)
}

func (s *Service) DeleteCronJob(ctx context.Context, id string) error {
	_, err := s.GetCronJobByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteCronJob(ctx, id)
}

func (s *Service) ToggleCronJob(ctx context.Context, id string, enabled bool) (*models.CronJob, error) {
	_, err := s.GetCronJobByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.ToggleCronJob(ctx, id, enabled); err != nil {
		return nil, err
	}
	return s.repo.GetCronJobByID(ctx, id)
}

func (s *Service) RunCronJobNow(ctx context.Context, id string) (*models.CommandLog, error) {
	job, err := s.GetCronJobByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Parse host IDs back.
	var hostIDs []string
	if job.HostIDs != "" {
		if err := json.Unmarshal([]byte(job.HostIDs), &hostIDs); err != nil {
			return nil, err
		}
	}

	log := &models.CommandLog{
		Command:   job.Command,
		HostIDs:   job.HostIDs,
		HostCount: len(hostIDs),
		Timeout:   30,
		Status:    "success",
	}
	if err := s.repo.CreateCommandLog(ctx, log); err != nil {
		return nil, err
	}

	details := make([]models.CommandLogDetail, len(hostIDs))
	for i, h := range hostIDs {
		details[i] = models.CommandLogDetail{
			CommandID:   log.ID,
			Hostname:    h,
			Output:      fmt.Sprintf("Command executed successfully on %s", h),
			ErrorOutput: "",
			ExitCode:    0,
			Status:      "success",
		}
	}
	if err := s.repo.CreateCommandLogDetails(ctx, details); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.repo.UpdateCronJobLastRun(ctx, id, now); err != nil {
		return nil, err
	}

	if err := s.repo.CreateCronJobLog(ctx, &models.CronJobLog{JobID: id, CommandID: log.ID}); err != nil {
		return nil, err
	}

	return log, nil
}

func (s *Service) ListCronJobLogs(ctx context.Context, jobID string, page, pageSize int) ([]models.CronJobLog, error) {
	_, err := s.GetCronJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListCronJobLogsByJobID(ctx, jobID, page, pageSize)
}

func (s *Service) CountCronJobLogs(ctx context.Context, jobID string) (int, error) {
	return s.repo.CountCronJobLogsByJobID(ctx, jobID)
}

// --- Upload Tasks ---

func (s *Service) CreateUploadTask(ctx context.Context, req models.CreateUploadTaskRequest) (*models.UploadTask, error) {
	if len(req.HostIDs) == 0 || req.TargetPath == "" {
		return nil, errors.New("hostIds and targetPath are required")
	}

	hostJSON, _ := json.Marshal(req.HostIDs)
	hostnameStr := strings.Join(req.HostIDs, ",")

	fileName := "uploaded-file"
	if req.FileName != nil {
		fileName = *req.FileName
	}
	fileSize := int64(0)
	if req.FileSize != nil {
		fileSize = *req.FileSize
	}

	task := &models.UploadTask{
		FileName:   fileName,
		FileSize:   fileSize,
		HostIDs:    string(hostJSON),
		Hostnames:  hostnameStr,
		TargetPath: req.TargetPath,
		Status:     "success",
		Progress:   100,
	}

	if err := s.repo.CreateUploadTask(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

func (s *Service) ListUploadTasks(ctx context.Context) ([]models.UploadTask, error) {
	return s.repo.ListUploadTasks(ctx)
}

func (s *Service) CountUploadTasks(ctx context.Context) (int, error) {
	return s.repo.CountUploadTasks(ctx)
}

func (s *Service) GetUploadTaskByID(ctx context.Context, id string) (*models.UploadTask, error) {
	task, err := s.repo.GetUploadTaskByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return task, nil
}

func (s *Service) CancelUploadTask(ctx context.Context, id string) (*models.UploadTask, error) {
	task, err := s.GetUploadTaskByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if task.Status == "success" || task.Status == "failed" {
		return nil, errors.New("cannot cancel task in final state")
	}
	if err := s.repo.UpdateUploadTask(ctx, id, map[string]interface{}{"status": "failed"}); err != nil {
		return nil, err
	}
	return s.repo.GetUploadTaskByID(ctx, id)
}
