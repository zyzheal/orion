package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"orion/build-svc-go/internal/models"
	"orion/build-svc-go/internal/repository"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var (
	ErrBuildNotFound     = errors.New("build not found")
	ErrEnvNotFound       = errors.New("build environment not found")
	ErrArtifactNotFound  = errors.New("artifact not found")
	ErrInvalidStatus     = errors.New("invalid status transition")
	ErrInvalidInput      = errors.New("invalid input")
)

var tracer = otel.Tracer("orion-build-svc/service")

// BuildService handles all business logic for builds, environments, and artifacts.
type BuildService struct {
	repo   *repository.BuildRepository
	logger *zap.Logger
}

func NewBuildService(repo *repository.BuildRepository, logger *zap.Logger) *BuildService {
	return &BuildService{repo: repo, logger: logger}
}

// ==================== Builds ====================

// Create creates a new build record in pending state.
func (s *BuildService) Create(ctx context.Context, b *models.Build) error {
	ctx, span := tracer.Start(ctx, "BuildService.Create",
		trace.WithAttributes(attribute.String("tenant_id", b.TenantID)))
	defer span.End()

	if b.Status == "" {
		b.Status = "pending"
	}
	if b.BuildArgs == nil {
		b.BuildArgs = json.RawMessage("{}")
	}
	return s.repo.Create(ctx, b)
}

// CreateFromInput creates a build from a CreateBuildInput payload.
func (s *BuildService) CreateFromInput(ctx context.Context, input models.CreateBuildInput) (*models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.CreateFromInput",
		trace.WithAttributes(attribute.String("tenant_id", input.TenantID)))
	defer span.End()

	if input.TenantID == "" {
		return nil, fmt.Errorf("%w: tenant_id is required", ErrInvalidInput)
	}

	buildArgs := input.BuildArgs
	if buildArgs == nil {
		buildArgs = json.RawMessage("{}")
	}

	b := &models.Build{
		TenantID:      input.TenantID,
		Branch:        input.Branch,
		CommitSHA:     input.CommitSHA,
		Status:        "pending",
		BuildArgs:     buildArgs,
	}
	if input.ProjectID != "" {
		b.ProjectID = &input.ProjectID
	}
	if input.PipelineRunID != "" {
		b.PipelineRunID = &input.PipelineRunID
	}
	if input.RepoID != "" {
		b.RepoID = &input.RepoID
	}
	if input.Image != "" {
		b.Image = &input.Image
	}
	if input.Tag != "" {
		b.Tag = &input.Tag
	}
	if input.SourceRef != "" {
		b.SourceRef = &input.SourceRef
	}

	if err := s.repo.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BuildService) GetByID(ctx context.Context, tenantID, id string) (*models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.GetByID",
		trace.WithAttributes(
			attribute.String("tenant_id", tenantID),
			attribute.String("build_id", id),
		))
	defer span.End()

	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *BuildService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.List",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	return s.repo.List(ctx, tenantID, models.ListBuildsFilter{}, offset, limit)
}

// ListWithFilter lists builds with optional project and status filters, scoped to tenant.
func (s *BuildService) ListWithFilter(ctx context.Context, tenantID string, filter models.ListBuildsFilter, offset, limit int) ([]models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.ListWithFilter",
		trace.WithAttributes(
			attribute.String("tenant_id", tenantID),
			attribute.String("status", filter.Status),
			attribute.String("project_id", filter.ProjectID),
		))
	defer span.End()

	return s.repo.List(ctx, tenantID, filter, offset, limit)
}

// ListPaginated returns a paginated result with total count, scoped to tenant.
func (s *BuildService) ListPaginated(ctx context.Context, tenantID string, filter models.ListBuildsFilter, offset, limit int) (*models.PaginatedResult, error) {
	ctx, span := tracer.Start(ctx, "BuildService.ListPaginated")
	defer span.End()

	builds, err := s.repo.List(ctx, tenantID, filter, offset, limit)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountFiltered(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}

	page := (offset / limit) + 1
	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	return &models.PaginatedResult{
		Data:       builds,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *BuildService) Update(ctx context.Context, b *models.Build) error {
	ctx, span := tracer.Start(ctx, "BuildService.Update",
		trace.WithAttributes(attribute.String("build_id", b.ID)))
	defer span.End()

	return s.repo.Update(ctx, b)
}

func (s *BuildService) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "BuildService.Delete",
		trace.WithAttributes(attribute.String("build_id", id)))
	defer span.End()

	return s.repo.Delete(ctx, tenantID, id)
}

func (s *BuildService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// TriggerBuild starts a pending build. Corresponds to Node.js BuildService.startBuild.
func (s *BuildService) TriggerBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.TriggerBuild",
		trace.WithAttributes(
			attribute.String("tenant_id", tenantID),
			attribute.String("build_id", id),
		))
	defer span.End()

	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "build not found")
		return nil, ErrBuildNotFound
	}

	if build.Status != "pending" {
		err := fmt.Errorf("%w: can only trigger pending builds, current status: %s", ErrInvalidStatus, build.Status)
		span.RecordError(err)
		return nil, err
	}

	updated, err := s.repo.StartBuild(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to start build")
		return nil, fmt.Errorf("failed to start build: %w", err)
	}

	// Trigger async build execution (mirrors Node.js fire-and-forget pattern)
	go s.executeBuild(tenantID, id)

	return updated, nil
}

// executeBuild simulates build execution. In production, this would invoke
// a container builder (Kaniko, BuildKit, etc.) via K8s.
func (s *BuildService) executeBuild(tenantID, buildID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	ctx, span := tracer.Start(ctx, "BuildService.executeBuild",
		trace.WithAttributes(attribute.String("build_id", buildID)))
	defer span.End()

	build, err := s.repo.GetByID(ctx, tenantID, buildID)
	if err != nil || build == nil {
		return
	}

	// Simulate build work
	time.Sleep(500 * time.Millisecond)

	// Generate image tag from build metadata
	imageTag := fmt.Sprintf("app:%s", buildID[:8])
	if build.ProjectID != nil && *build.ProjectID != "" {
		imageTag = fmt.Sprintf("%s:%s", *build.ProjectID, buildID[:8])
	}

	// Mark build as successful
	build.Status = "success"
	build.Image = &imageTag
	tag := "latest"
	build.Tag = &tag

	if err := s.repo.Update(ctx, build); err != nil {
		s.logger.Error("failed to update build after execution",
			zap.String("build_id", buildID), zap.Error(err))
		span.RecordError(err)

		// Attempt to mark as failed
		_, _ = s.repo.CompleteBuild(ctx, tenantID, buildID, "failed", err.Error())
	}
}

// GetBuildStatus returns the current status and progress of a build.
func (s *BuildService) GetBuildStatus(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	ctx, span := tracer.Start(ctx, "BuildService.GetBuildStatus",
		trace.WithAttributes(attribute.String("build_id", id)))
	defer span.End()

	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBuildNotFound
	}

	result := map[string]interface{}{
		"id":         build.ID,
		"status":     build.Status,
		"started_at": build.StartedAt,
	}
	if build.Image != nil {
		result["image"] = *build.Image
	}
	if build.Tag != nil {
		result["tag"] = *build.Tag
	}
	if build.CompletedAt != nil {
		result["completed_at"] = build.CompletedAt
	}
	if build.DurationMs != nil {
		result["duration_ms"] = *build.DurationMs
	}
	if build.ErrorMessage != nil {
		result["error_message"] = *build.ErrorMessage
	}
	return result, nil
}

// CancelBuild cancels a pending or running build.
func (s *BuildService) CancelBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.CancelBuild",
		trace.WithAttributes(attribute.String("build_id", id)))
	defer span.End()

	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBuildNotFound
	}

	if build.Status != "pending" && build.Status != "running" {
		return nil, fmt.Errorf("%w: can only cancel pending or running builds, current status: %s",
			ErrInvalidStatus, build.Status)
	}

	completed, err := s.repo.CompleteBuild(ctx, tenantID, id, "cancelled", "Cancelled by user")
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to cancel build: %w", err)
	}
	return completed, nil
}

// RetryBuild creates a new build from a failed/cancelled build's parameters.
func (s *BuildService) RetryBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	ctx, span := tracer.Start(ctx, "BuildService.RetryBuild",
		trace.WithAttributes(attribute.String("original_build_id", id)))
	defer span.End()

	original, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBuildNotFound
	}

	if original.Status != "failed" && original.Status != "cancelled" {
		return nil, fmt.Errorf("%w: can only retry failed or cancelled builds, current status: %s",
			ErrInvalidStatus, original.Status)
	}

	// Create a new build with the same parameters
	newBuild := &models.Build{
		TenantID:      original.TenantID,
		ProjectID:     original.ProjectID,
		PipelineRunID: original.PipelineRunID,
		RepoID:        original.RepoID,
		Branch:        original.Branch,
		CommitSHA:     original.CommitSHA,
		SourceRef:     original.SourceRef,
		BuildArgs:     original.BuildArgs,
		Status:        "pending",
	}

	if err := s.repo.Create(ctx, newBuild); err != nil {
		return nil, fmt.Errorf("failed to create retry build: %w", err)
	}

	// Immediately trigger the new build
	return s.TriggerBuild(ctx, tenantID, newBuild.ID)
}

// GetBuildByPipelineRun finds a build by its associated pipeline run.
func (s *BuildService) GetBuildByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error) {
	return s.repo.FindByPipelineRun(ctx, tenantID, pipelineRunID)
}

// GetBuildStats returns aggregated build statistics.
func (s *BuildService) GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error) {
	ctx, span := tracer.Start(ctx, "BuildService.GetBuildStats",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	return s.repo.GetBuildStats(ctx, tenantID)
}

// GetBuildLogs returns the log content of a build.
func (s *BuildService) GetBuildLogs(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	ctx, span := tracer.Start(ctx, "BuildService.GetBuildLogs",
		trace.WithAttributes(attribute.String("build_id", id)))
	defer span.End()

	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBuildNotFound
	}

	logs := ""
	if build.Logs != nil {
		logs = *build.Logs
	}

	return map[string]interface{}{
		"build_id": build.ID,
		"status":   build.Status,
		"logs":     logs,
	}, nil
}

// ==================== Build Environments ====================

func (s *BuildService) CreateEnvironment(ctx context.Context, input models.CreateEnvironmentInput) (*models.BuildEnvironment, error) {
	ctx, span := tracer.Start(ctx, "BuildService.CreateEnvironment",
		trace.WithAttributes(attribute.String("tenant_id", input.TenantID)))
	defer span.End()

	if input.TenantID == "" {
		return nil, fmt.Errorf("%w: tenant_id is required", ErrInvalidInput)
	}

	env := &models.BuildEnvironment{
		TenantID:    input.TenantID,
		Name:        input.Name,
		Type:        input.Type,
		Image:       input.Image,
		Status:      "active",
	}
	if input.Description != "" {
		env.Description = &input.Description
	}
	if input.Config != nil {
		env.Config = input.Config
	} else {
		env.Config = json.RawMessage("{}")
	}

	if err := s.repo.CreateEnvironment(ctx, env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *BuildService) GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error) {
	return s.repo.GetEnvironmentByID(ctx, tenantID, id)
}

func (s *BuildService) ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error) {
	return s.repo.ListEnvironments(ctx, tenantID)
}

func (s *BuildService) UpdateEnvironment(ctx context.Context, tenantID, id string, input models.CreateEnvironmentInput) (*models.BuildEnvironment, error) {
	ctx, span := tracer.Start(ctx, "BuildService.UpdateEnvironment",
		trace.WithAttributes(attribute.String("env_id", id)))
	defer span.End()

	env, err := s.repo.GetEnvironmentByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvNotFound
	}

	if input.Name != "" {
		env.Name = input.Name
	}
	if input.Type != "" {
		env.Type = input.Type
	}
	if input.Image != "" {
		env.Image = input.Image
	}
	if input.Description != "" {
		env.Description = &input.Description
	}
	if input.Config != nil {
		env.Config = input.Config
	}

	if err := s.repo.UpdateEnvironment(ctx, env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *BuildService) DeleteEnvironment(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetEnvironmentByID(ctx, tenantID, id)
	if err != nil {
		return ErrEnvNotFound
	}
	return s.repo.DeleteEnvironment(ctx, tenantID, id)
}

// ==================== Artifacts ====================

func (s *BuildService) CreateArtifact(ctx context.Context, input models.CreateArtifactInput) (*models.Artifact, error) {
	ctx, span := tracer.Start(ctx, "BuildService.CreateArtifact",
		trace.WithAttributes(
			attribute.String("tenant_id", input.TenantID),
			attribute.String("run_id", input.RunID),
		))
	defer span.End()

	if input.TenantID == "" {
		input.TenantID = "00000000-0000-0000-0000-000000000000"
	}
	if input.StorageType == "" {
		input.StorageType = "local"
	}

	a := &models.Artifact{
		TenantID:       input.TenantID,
		Name:           input.Name,
		Type:           input.Type,
		StorageType:    input.StorageType,
		StoragePath:    input.StoragePath,
		SizeBytes:      input.SizeBytes,
		RunID:          input.RunID,
		DownloadedCount: 0,
	}
	if input.ChecksumSHA256 != "" {
		a.ChecksumSHA256 = &input.ChecksumSHA256
	}
	if input.StageID != "" {
		a.StageID = &input.StageID
	}
	if input.ExpiresAt != nil {
		a.ExpiresAt = input.ExpiresAt
	}
	if input.Metadata != nil {
		a.Metadata = input.Metadata
	} else {
		a.Metadata = json.RawMessage("{}")
	}

	if err := s.repo.CreateArtifact(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *BuildService) GetArtifact(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	return s.repo.GetArtifactByID(ctx, tenantID, id)
}

func (s *BuildService) ListArtifacts(ctx context.Context, tenantID string, filter models.ListArtifactFilter, offset, limit int) ([]models.Artifact, error) {
	return s.repo.ListArtifacts(ctx, tenantID, filter, offset, limit)
}

func (s *BuildService) DeleteArtifact(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteArtifact(ctx, tenantID, id)
}

func (s *BuildService) RecordArtifactDownload(ctx context.Context, tenantID, id string) error {
	return s.repo.IncrementDownloadCount(ctx, tenantID, id)
}

func (s *BuildService) CleanupExpiredArtifacts(ctx context.Context, tenantID string) (int, error) {
	ctx, span := tracer.Start(ctx, "BuildService.CleanupExpiredArtifacts")
	defer span.End()

	count, err := s.repo.CleanupExpiredArtifacts(ctx, tenantID)
	if err != nil {
		span.RecordError(err)
		return 0, err
	}
	span.SetAttributes(attribute.Int("cleaned", count))
	return count, nil
}

func (s *BuildService) CleanupArtifactsByRun(ctx context.Context, tenantID, runID string) (int, error) {
	return s.repo.CleanupArtifactsByRun(ctx, tenantID, runID)
}
