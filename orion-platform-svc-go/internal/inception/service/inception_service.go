package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/inception/models"
	"orion/platform-svc-go/internal/inception/repository"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

var (
	ErrBlacklisted              = errors.New("sql blocked by blacklist")
	ErrInvalidStatus            = errors.New("invalid status transition")
	ErrInceptionProjectNotFound = errors.New("project not found")
)

// Service provides business logic for the inception SQL audit engine.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// SQL Audit History
// ---------------------------------------------------------------------------

// CreateAudit validates and records a SQL audit entry. If the SQL matches a
// blacklist pattern, the audit is rejected immediately.
func (s *Service) CreateAudit(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
	// Normalize operation type
	opType := strings.ToLower(strings.TrimSpace(req.OperationType))
	if opType == "" {
		opType = "audit"
	}
	validOps := map[string]bool{"audit": true, "parse": true, "execute": true, "validate": true}
	if !validOps[opType] {
		return nil, fmt.Errorf("invalid operation_type %q; allowed: audit, parse, execute, validate", opType)
	}

	// Check blacklist
	blocked, reason, err := s.repo.IsBlacklisted(ctx, tenantID, req.SQLStatement)
	if err != nil {
		return nil, fmt.Errorf("blacklist check failed: %w", err)
	}
	if blocked {
		return nil, fmt.Errorf("%w: %s", ErrBlacklisted, reason)
	}

	a := &models.SQLAuditHistory{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		DBName:        req.DBName,
		SQLStatement:  req.SQLStatement,
		OperationType: opType,
		DryRun:        req.DryRun,
		Status:        "pending",
		Errors:        models.JSONArray{},
		Warnings:      models.JSONArray{},
	}
	if req.AuditedBy != "" {
		a.AuditedBy = &req.AuditedBy
	}
	if req.RequestID != "" {
		a.RequestID = &req.RequestID
	}

	if err := s.repo.CreateAudit(ctx, a); err != nil {
		return nil, fmt.Errorf("create audit failed: %w", err)
	}
	return a, nil
}

// ListAudits returns paginated audit history.
func (s *Service) ListAudits(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
	return s.repo.ListAudits(ctx, tenantID, offset, limit)
}

// ListAuditsByStatus returns paginated audit history filtered by status.
func (s *Service) ListAuditsByStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.SQLAuditHistory, error) {
	validStatuses := map[string]bool{"pending": true, "success": true, "failed": true}
	if !validStatuses[status] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.ListAuditsByStatus(ctx, tenantID, status, offset, limit)
}

// GetAuditByID returns a single audit record.
func (s *Service) GetAuditByID(ctx context.Context, tenantID, id string) (*models.SQLAuditHistory, error) {
	a, err := s.repo.GetAuditByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: audit %s", sentinel.NotFound, id)
	}
	return a, nil
}

// UpdateAuditStatus updates the status and execution results of an audit.
func (s *Service) UpdateAuditStatus(ctx context.Context, tenantID, id, status string, errors, warnings models.JSONArray, affectedRows, execTimeMs *int) error {
	validStatuses := map[string]bool{"pending": true, "success": true, "failed": true}
	if !validStatuses[status] {
		return fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.UpdateAuditStatus(ctx, tenantID, id, status, errors, warnings, affectedRows, execTimeMs)
}

// CountAudits returns total audit count for a tenant.
func (s *Service) CountAudits(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountAudits(ctx, tenantID)
}

// DeleteAudit removes an audit record.
func (s *Service) DeleteAudit(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteAudit(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// SQL Blacklist
// ---------------------------------------------------------------------------

// CreateBlacklist adds a new blacklist pattern.
func (s *Service) CreateBlacklist(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest) (*models.SQLBlacklist, error) {
	severity := strings.ToLower(strings.TrimSpace(req.Severity))
	if severity == "" {
		severity = "high"
	}
	validSeverities := map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
	if !validSeverities[severity] {
		return nil, fmt.Errorf("invalid severity %q; allowed: low, medium, high, critical", severity)
	}

	b := &models.SQLBlacklist{
		ID:       uuid.New().String(),
		TenantID: &tenantID,
		Pattern:  req.Pattern,
		Severity: severity,
		Enabled:  true,
	}
	if req.Description != "" {
		b.Description = &req.Description
	}
	if req.CreatedBy != "" {
		b.CreatedBy = &req.CreatedBy
	}

	if err := s.repo.CreateBlacklist(ctx, b); err != nil {
		return nil, fmt.Errorf("create blacklist entry failed: %w", err)
	}
	return b, nil
}

// ListBlacklists returns paginated blacklist entries.
func (s *Service) ListBlacklists(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLBlacklist, error) {
	return s.repo.ListBlacklists(ctx, tenantID, offset, limit)
}

// GetBlacklistByID returns a single blacklist entry.
func (s *Service) GetBlacklistByID(ctx context.Context, id string) (*models.SQLBlacklist, error) {
	b, err := s.repo.GetBlacklistByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: blacklist %s", sentinel.NotFound, id)
	}
	return b, nil
}

// UpdateBlacklist updates a blacklist entry.
func (s *Service) UpdateBlacklist(ctx context.Context, id string, req *models.UpdateBlacklistRequest) error {
	if req.Severity != nil {
		validSeverities := map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
		if !validSeverities[*req.Severity] {
			return fmt.Errorf("invalid severity %q", *req.Severity)
		}
	}
	return s.repo.UpdateBlacklist(ctx, id, req.Pattern, req.Description, req.Severity, req.Enabled)
}

// CountBlacklists returns total blacklist count for a tenant.
func (s *Service) CountBlacklists(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountBlacklists(ctx, tenantID)
}

// DeleteBlacklist removes a blacklist entry.
func (s *Service) DeleteBlacklist(ctx context.Context, id string) error {
	return s.repo.DeleteBlacklist(ctx, id)
}

// ---------------------------------------------------------------------------
// Inception Config
// ---------------------------------------------------------------------------

// UpsertConfig creates or updates the inception config for a tenant.
func (s *Service) UpsertConfig(ctx context.Context, tenantID string, req *models.CreateConfigRequest) (*models.InceptionConfig, error) {
	port := req.Port
	if port == 0 {
		port = 6669
	}
	timeoutMs := req.TimeoutMs
	if timeoutMs == 0 {
		timeoutMs = 30000
	}

	c := &models.InceptionConfig{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Host:              req.Host,
		Port:              port,
		User:              req.User,
		EncryptedPassword: &req.Password,
		TimeoutMs:         timeoutMs,
		Enabled:           true,
	}
	if req.DefaultDB != "" {
		c.DefaultDB = &req.DefaultDB
	}

	if err := s.repo.UpsertConfig(ctx, c); err != nil {
		return nil, fmt.Errorf("upsert config failed: %w", err)
	}
	return c, nil
}

// GetConfigByTenant returns the inception config for a tenant.
func (s *Service) GetConfigByTenant(ctx context.Context, tenantID string) (*models.InceptionConfig, error) {
	c, err := s.repo.GetConfigByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("%w: config for tenant %s", sentinel.NotFound, tenantID)
	}
	return c, nil
}

// ListConfigs returns paginated inception configs.
func (s *Service) ListConfigs(ctx context.Context, offset, limit int) ([]models.InceptionConfig, error) {
	return s.repo.ListConfigs(ctx, offset, limit)
}

// UpdateConfig updates an inception config.
func (s *Service) UpdateConfig(ctx context.Context, tenantID string, req *models.UpdateConfigRequest) error {
	return s.repo.UpdateConfig(ctx, tenantID, req.Host, req.User, req.Password, req.DefaultDB, req.Port, req.TimeoutMs, req.Enabled)
}

// CountConfigs returns total config count.
func (s *Service) CountConfigs(ctx context.Context) (int, error) {
	return s.repo.CountConfigs(ctx)
}

// DeleteConfig removes an inception config.
func (s *Service) DeleteConfig(ctx context.Context, tenantID string) error {
	return s.repo.DeleteConfig(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// Audit Reports
// ---------------------------------------------------------------------------

// CreateReport creates a new audit report record.
func (s *Service) CreateReport(ctx context.Context, tenantID string, req *models.CreateReportRequest) (*models.AuditReport, error) {
	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "json"
	}
	validFormats := map[string]bool{"json": true, "csv": true, "pdf": true}
	if !validFormats[format] {
		return nil, fmt.Errorf("invalid format %q; allowed: json, csv, pdf", format)
	}

	rpt := &models.AuditReport{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		ReportName: req.ReportName,
		Format:     format,
		Status:     "generating",
		Filters:    models.JSONB{},
	}
	if req.GeneratedBy != "" {
		rpt.GeneratedBy = &req.GeneratedBy
	}

	if err := s.repo.CreateReport(ctx, rpt); err != nil {
		return nil, fmt.Errorf("create report failed: %w", err)
	}
	return rpt, nil
}

// ListReports returns paginated audit reports.
func (s *Service) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.AuditReport, error) {
	return s.repo.ListReports(ctx, tenantID, offset, limit)
}

// GetReportByID returns a single audit report.
func (s *Service) GetReportByID(ctx context.Context, tenantID, id string) (*models.AuditReport, error) {
	rpt, err := s.repo.GetReportByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: report %s", sentinel.NotFound, id)
	}
	return rpt, nil
}

// UpdateReportStatus updates the status and file path of a report.
func (s *Service) UpdateReportStatus(ctx context.Context, tenantID, id, status string, filePath *string) error {
	validStatuses := map[string]bool{"generating": true, "ready": true, "failed": true}
	if !validStatuses[status] {
		return fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.UpdateReportStatus(ctx, tenantID, id, status, filePath)
}

// CountReports returns total report count for a tenant.
func (s *Service) CountReports(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountReports(ctx, tenantID)
}

// DeleteReport removes an audit report.
func (s *Service) DeleteReport(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteReport(ctx, tenantID, id)
}

// PurgeExpiredReports deletes expired reports. Returns number of deleted rows.
func (s *Service) PurgeExpiredReports(ctx context.Context) (int64, error) {
	return s.repo.PurgeExpiredReports(ctx)
}

// ---------------------------------------------------------------------------
// Engine / Status helpers
// ---------------------------------------------------------------------------

// Health returns the engine health status.
func (s *Service) Health(ctx context.Context) (string, error) {
	return "ok", nil
}

// Status returns the inception engine configuration status for a tenant.
func (s *Service) Status(ctx context.Context, tenantID string) (enabled bool, message string, err error) {
	cfg, err := s.GetConfigByTenant(ctx, tenantID)
	if err != nil {
		return false, "Inception not configured", nil
	}
	if cfg.Enabled {
		return true, "Inception configured and enabled", nil
	}
	return false, "Inception configured but disabled", nil
}

// ListDatabases returns distinct database names from the audit history for a tenant.
func (s *Service) ListDatabases(ctx context.Context, tenantID string) ([]string, error) {
	audits, err := s.repo.ListAudits(ctx, tenantID, 0, 10000)
	if err != nil {
		return nil, fmt.Errorf("list databases failed: %w", err)
	}
	seen := make(map[string]bool)
	var dbs []string
	for _, a := range audits {
		if a.DBName != "" && !seen[a.DBName] {
			seen[a.DBName] = true
			dbs = append(dbs, a.DBName)
		}
	}
	return dbs, nil
}
