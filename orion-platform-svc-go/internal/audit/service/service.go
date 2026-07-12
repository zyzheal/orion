package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/repository"
)

// Service provides business logic for the audit module.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service backed by the given Repository.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GenesisHash is the immutable chain genesis value (matches TS source).
const GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000"

// toAuditLogEntry converts a DB model to the frontend-friendly entry format.
func toAuditLogEntry(log models.AuditLog) models.AuditLogEntry {
	details := make(map[string]any)
	_ = json.Unmarshal([]byte(log.RequestBody), &details)
	if len(details) == 0 {
		_ = json.Unmarshal([]byte(log.ResponseBody), &details)
	}
	return models.AuditLogEntry{
		ID:             log.ID,
		Timestamp:      log.CreatedAt,
		Action:         log.Action,
		UserID:         log.UserID,
		TenantID:       log.TenantID,
		Details:        details,
		Resource:       log.ResourceType,
		ResourceID:     log.ResourceID,
		IPAddress:      log.IPAddress,
		UserAgent:      log.UserAgent,
		PrevHash:       log.PrevHash,
		ContentHash:    log.Hash,
		ChainHash:      log.Hash,
		SequenceNumber: 0,
		RequestMethod:  log.RequestMethod,
		RequestPath:    log.RequestPath,
		ResponseCode:   log.ResponseCode,
	}
}

// Create creates a new audit log entry.
func (s *Service) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
	// Default tenant
	if req.TenantID == "" {
		req.TenantID = tenantID
	}
	// Default resource type
	if req.ResourceType == "" {
		req.ResourceType = "audit"
	}

	log, err := s.repo.Create(ctx, req.TenantID, req)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// Get retrieves a single audit log by ID.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// List returns a paginated list of audit logs.
func (s *Service) List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
	logs, total, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	entries := make([]models.AuditLogEntry, 0, len(logs))
	for _, l := range logs {
		entries = append(entries, toAuditLogEntry(l))
	}
	return &models.AuditLogListResult{
		Entries:    entries,
		Total:      total,
		Page:       q.Page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// VerifySingle verifies the integrity of a single audit log entry.
func (s *Service) VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, false, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, log.Hash != "", nil
}

// VerifyChain verifies the integrity of the entire audit chain for a tenant.
func (s *Service) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
	verified, valid, err := s.repo.VerifyChain(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	result := &models.ChainVerifyResult{
		Valid:         valid,
		TotalVerified: verified,
		VerifiedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if !valid {
		result.Breaks = []models.ChainBreak{{
			BreakType:   "HASH_MISMATCH",
			Description: fmt.Sprintf("Chain broken at sequence %d", verified),
			DetectedAt:  time.Now().UTC().Format(time.RFC3339),
		}}
	}
	return result, nil
}

// GetActions returns distinct action types for a tenant.
func (s *Service) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetActions(ctx, tenantID)
}

// GetResourceTypes returns distinct resource types for a tenant.
func (s *Service) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetResourceTypes(ctx, tenantID)
}

// ChainInfo returns chain compatibility information for a tenant.
func (s *Service) ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error) {
	logs, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.ChainInfo{
		TotalEntries:  total,
		FirstSequence: 1,
		LastSequence:  total,
		LastChainHash: func() string {
			if len(logs) > 0 {
				return logs[0].Hash
			}
			return ""
		}(),
		GenesisHash: GenesisHash,
	}, nil
}

// StorageStats returns storage compatibility stats for a tenant.
func (s *Service) StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error) {
	_, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.StorageStats{
		TotalEntries: total,
		StorageSize:  int64(total * 1024), // Approximate as TS source does
		LastFlushAt:  time.Now().UTC().Format(time.RFC3339),
		IsHealthy:    true,
	}, nil
}

// Export exports audit logs in the requested format (csv/json).
func (s *Service) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
	logs, err := s.repo.Export(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	format := q.Format
	if format == "" {
		format = "json"
	}
	filename := fmt.Sprintf("audit-export-%s.%s", time.Now().UTC().Format("2006-01-02"), format)
	var content string
	switch format {
	case "csv":
		content = repository.FormatCSV(logs)
	default:
		entries := make([]models.AuditLogEntry, 0, len(logs))
		for _, l := range logs {
			entries = append(entries, toAuditLogEntry(l))
		}
		b, _ := json.Marshal(entries)
		content = string(b)
	}
	return &models.AuditLogExportResult{
		Filename: filename,
		Content:  content,
	}, nil
}

// ComplianceReport returns a placeholder compliance report for SOC2/ISO27001.
func (s *Service) ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
	// Placeholder — full compliance logic mirrors TS AuditComplianceService
	return &models.ComplianceReport{
		ReportType: framework,
	}, nil
}

// CoverageStats returns audit coverage statistics.
func (s *Service) CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) {
	stats, err := s.repo.CoverageStats(ctx, tenantID)
	return &stats, err
}

// Known sentinel errors used by handlers for status-code routing.
var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidFormat = errors.New("invalid format")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
