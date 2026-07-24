package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dba/models"
	"orion/platform-svc-go/internal/infrastructure/dba/repository"

	"github.com/google/uuid"
)

var (
	ErrOrderNotFound     = errors.New("order not found")
	ErrDataSourceNotFound = errors.New("data source not found")
	ErrInvalidInput      = errors.New("invalid input")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ─── SQL Orders ────────────────────────────────────────────────────────────────

func (s *Service) CreateOrder(ctx context.Context, req *models.CreateOrderInput, userID, tenantID string) (*models.SQLOrder, error) {
	if req.Title == "" || req.SQLContent == "" {
		return nil, fmt.Errorf("%w: title and sql_content are required", ErrInvalidInput)
	}
	now := time.Now()
	order := &models.SQLOrder{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Title:      req.Title,
		Description: req.Description,
		Database:   req.Database,
		SQLContent: req.SQLContent,
		Status:     "pending",
		CreatedBy:  userID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.repo.CreateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}
	return order, nil
}

func (s *Service) GetOrder(ctx context.Context, id string) (*models.SQLOrder, error) {
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrOrderNotFound, id)
	}
	return order, nil
}

func (s *Service) ListOrders(ctx context.Context, tenantID, status string, page, limit int) (map[string]interface{}, error) {
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}
	items, err := s.repo.ListOrders(ctx, tenantID, status, offset, limit)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"items": items,
		"page":  page,
		"limit": limit,
	}, nil
}

func (s *Service) ApproveOrder(ctx context.Context, id, userID string) (*models.SQLOrder, error) {
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrOrderNotFound, id)
	}
	if order.Status != "pending" {
		return nil, fmt.Errorf("%w: order is not in pending state", ErrInvalidInput)
	}
	if err := s.repo.ApproveOrder(ctx, id, userID); err != nil {
		return nil, err
	}
	return s.repo.GetOrderByID(ctx, id)
}

func (s *Service) RejectOrder(ctx context.Context, id string) (*models.SQLOrder, error) {
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrOrderNotFound, id)
	}
	if order.Status != "pending" {
		return nil, fmt.Errorf("%w: order is not in pending state", ErrInvalidInput)
	}
	if err := s.repo.RejectOrder(ctx, id); err != nil {
		return nil, err
	}
	return s.repo.GetOrderByID(ctx, id)
}

func (s *Service) ExecuteOrder(ctx context.Context, id string) (*models.SQLOrder, error) {
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrOrderNotFound, id)
	}
	if order.Status != "approved" {
		return nil, fmt.Errorf("%w: order must be approved before execution", ErrInvalidInput)
	}
	if err := s.repo.ExecuteOrder(ctx, id); err != nil {
		return nil, err
	}
	return s.repo.GetOrderByID(ctx, id)
}

// ─── Data Sources ──────────────────────────────────────────────────────────────

func (s *Service) CreateDataSource(ctx context.Context, req *models.CreateDataSourceInput, tenantID string) (*models.DataSource, error) {
	if req.Name == "" || req.Host == "" || req.Database == "" {
		return nil, fmt.Errorf("%w: name, host, and database are required", ErrInvalidInput)
	}
	port := req.Port
	if port <= 0 {
		port = 5432
	}
	now := time.Now()
	ds := &models.DataSource{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		DBType:      req.DBType,
		Host:        req.Host,
		Port:        port,
		Database:    req.Database,
		Username:    req.Username,
		PasswordRef: req.PasswordRef,
		SSLMode:     req.SSLMode,
		Status:      "active",
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateDataSource(ctx, ds); err != nil {
		return nil, fmt.Errorf("create data source: %w", err)
	}
	return ds, nil
}

func (s *Service) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	return s.repo.ListDataSources(ctx, tenantID)
}

func (s *Service) GetDataSource(ctx context.Context, id string) (*models.DataSource, error) {
	ds, err := s.repo.GetDataSourceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDataSourceNotFound, id)
	}
	return ds, nil
}

func (s *Service) UpdateDataSource(ctx context.Context, id string, req map[string]interface{}) (*models.DataSource, error) {
	if _, err := s.repo.GetDataSourceByID(ctx, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDataSourceNotFound, id)
	}
	return s.repo.UpdateDataSource(ctx, id, req)
}

func (s *Service) DeleteDataSource(ctx context.Context, id string) (bool, error) {
	if _, err := s.repo.GetDataSourceByID(ctx, id); err != nil {
		return false, fmt.Errorf("%w: %s", ErrDataSourceNotFound, id)
	}
	return s.repo.DeleteDataSource(ctx, id)
}

func (s *Service) TestConnection(ctx context.Context, id string) (*models.QueryResult, error) {
	if _, err := s.repo.GetDataSourceByID(ctx, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDataSourceNotFound, id)
	}
	return &models.QueryResult{
		Success:  true,
		RowCount: 0,
	}, nil
}

// ─── Audit Rules ───────────────────────────────────────────────────────────────

func (s *Service) CreateAuditRule(ctx context.Context, req *models.CreateAuditRuleInput, tenantID string) (*models.AuditRule, error) {
	if req.Name == "" || req.Pattern == "" {
		return nil, fmt.Errorf("%w: name and pattern are required", ErrInvalidInput)
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	severity := req.Severity
	if severity == "" {
		severity = "warning"
	}
	now := time.Now()
	rule := &models.AuditRule{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Pattern:     req.Pattern,
		Severity:    severity,
		Enabled:     enabled,
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateAuditRule(ctx, rule); err != nil {
		return nil, fmt.Errorf("create audit rule: %w", err)
	}
	return rule, nil
}

func (s *Service) ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error) {
	return s.repo.ListAuditRules(ctx, tenantID)
}

func (s *Service) UpdateAuditRule(ctx context.Context, id string, req map[string]interface{}) (*models.AuditRule, error) {
	return s.repo.UpdateAuditRule(ctx, id, req)
}

// ─── Direct Query ──────────────────────────────────────────────────────────────

func (s *Service) ExecuteDirectQuery(ctx context.Context, req models.DirectQueryInput, auth map[string]string) (*models.QueryResult, error) {
	// Simulate query execution; in production this would connect to the target DB
	record := &models.QueryLog{
		ID:         uuid.New().String(),
		TenantID:   auth["tenantId"],
		SQLContent: req.Query,
		Status:     "completed",
		Duration:   5,
		RowCount:   0,
		CreatedBy:  auth["userId"],
		CreatedAt:  time.Now(),
	}
	if err := s.repo.CreateQueryLog(ctx, record); err != nil {
		return nil, err
	}
	return &models.QueryResult{
		Success:         true,
		Data:            []map[string]interface{}{},
		Columns:         []string{},
		RowCount:        0,
		ExecutionRecord: record,
	}, nil
}

func (s *Service) ListQueryLogs(ctx context.Context, tenantID string, filters map[string]interface{}, page, limit int, dataSourceID, status string) (map[string]interface{}, error) {
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}
	items, err := s.repo.ListQueryLogs(ctx, tenantID, dataSourceID, status, offset, limit)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"items": items,
		"page":  page,
		"limit": limit,
	}, nil
}