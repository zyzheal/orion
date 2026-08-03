package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/test-execution-engine/models"
)

type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req *models.CreateExecutionRequest) (*models.TestExecution, error)
	Get(ctx context.Context, tenantID, id string) (*models.TestExecution, error)
	List(ctx context.Context, tenantID string, q models.ListExecutionsQuery) (*models.ExecutionListResponse, error)
	UpdateStatus(ctx context.Context, id string, status models.TestStatus) error
	SubmitResults(ctx context.Context, id string, req *models.SubmitResultRequest) error
	GetSuites(ctx context.Context, executionID string) ([]models.TestSuite, error)
	GetTestCases(ctx context.Context, suiteID string) ([]models.TestCase, error)
}

type Repository struct {
	mu       sync.RWMutex
	execs    map[string]*models.TestExecution
	suites   map[string][]*models.TestSuite
	cases    map[string][]*models.TestCase
}

func NewRepository() *Repository {
	return &Repository{
		execs:  make(map[string]*models.TestExecution),
		suites: make(map[string][]*models.TestSuite),
		cases:  make(map[string][]*models.TestCase),
	}
}

func (r *Repository) Create(ctx context.Context, tenantID string, req *models.CreateExecutionRequest) (*models.TestExecution, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	exec := &models.TestExecution{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Framework:   req.Framework,
		Status:      models.TestStatusPending,
		TriggeredBy: "",
		PipelineID:  req.PipelineID,
		CreatedAt:   now,
	}
	r.execs[exec.ID] = exec
	return exec, nil
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.TestExecution, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	exec, ok := r.execs[id]
	if !ok || exec.TenantID != tenantID {
		return nil, fmt.Errorf("execution not found: %s", id)
	}
	return exec, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListExecutionsQuery) (*models.ExecutionListResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var items []models.TestExecution
	for _, exec := range r.execs {
		if exec.TenantID != tenantID {
			continue
		}
		items = append(items, *exec)
	}
	page := q.Page
	if page < 1 { page = 1 }
	pageSize := q.PageSize
	if pageSize < 1 { pageSize = 20 }
	start := (page - 1) * pageSize
	if start > len(items) { start = len(items) }
	end := start + pageSize
	if end > len(items) { end = len(items) }
	return &models.ExecutionListResponse{
		Items: items[start:end], Total: len(items), Page: page, PageSize: pageSize,
	}, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id string, status models.TestStatus) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	exec, ok := r.execs[id]
	if !ok {
		return fmt.Errorf("execution not found: %s", id)
	}
	exec.Status = status
	if status == models.TestStatusPassed || status == models.TestStatusFailed || status == models.TestStatusCancelled {
		now := time.Now()
		exec.CompletedAt = &now
	}
	return nil
}

func (r *Repository) SubmitResults(ctx context.Context, id string, req *models.SubmitResultRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	exec, ok := r.execs[id]
	if !ok {
		return fmt.Errorf("execution not found: %s", id)
	}
	exec.Status = models.TestStatusPassed
	if req.Failed > 0 || req.Errors > 0 {
		exec.Status = models.TestStatusFailed
	}
	exec.TotalTests = req.TotalTests
	exec.Passed = req.Passed
	exec.Failed = req.Failed
	exec.Skipped = req.Skipped
	exec.Errors = req.Errors
	exec.DurationMS = req.DurationMS
	exec.ReportURL = req.ReportURL
	now := time.Now()
	exec.CompletedAt = &now
	return nil
}

func (r *Repository) GetSuites(ctx context.Context, executionID string) ([]models.TestSuite, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	suites, ok := r.suites[executionID]
	if !ok {
		return []models.TestSuite{}, nil
	}
	result := make([]models.TestSuite, len(suites))
	for i, s := range suites {
		result[i] = *s
	}
	return result, nil
}

func (r *Repository) GetTestCases(ctx context.Context, suiteID string) ([]models.TestCase, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cases, ok := r.cases[suiteID]
	if !ok {
		return []models.TestCase{}, nil
	}
	result := make([]models.TestCase, len(cases))
	for i, c := range cases {
		result[i] = *c
	}
	return result, nil
}