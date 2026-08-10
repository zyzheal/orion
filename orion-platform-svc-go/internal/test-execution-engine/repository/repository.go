package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/test-execution-engine/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
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
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, req *models.CreateExecutionRequest) (*models.TestExecution, error) {
	now := time.Now().UTC()
	exec := &models.TestExecution{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Framework:   req.Framework,
		Status:      models.TestStatusPending,
		PipelineID:  req.PipelineID,
		CreatedAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO test_executions (id, tenant_id, name, framework, status, pipeline_id, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :framework, :status, :pipeline_id, :created_at, NOW())`,
		exec)
	if err != nil {
		return nil, err
	}
	return exec, nil
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.TestExecution, error) {
	var exec models.TestExecution
	err := r.db.GetContext(ctx, &exec, `SELECT * FROM test_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &exec, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListExecutionsQuery) (*models.ExecutionListResponse, error) {
	var total int
	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM test_executions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	var items []models.TestExecution
	offset := (page - 1) * pageSize

	switch {
	case q.Status != nil && q.PipelineID != "":
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM test_executions WHERE tenant_id=$1 AND status=$2 AND pipeline_id=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`, tenantID, string(*q.Status), q.PipelineID, pageSize, offset)
	case q.Status != nil:
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM test_executions WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, string(*q.Status), pageSize, offset)
	case q.PipelineID != "":
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM test_executions WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, q.PipelineID, pageSize, offset)
	default:
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM test_executions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, pageSize, offset)
	}
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.TestExecution{}
	}

	return &models.ExecutionListResponse{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id string, status models.TestStatus) error {
	now := time.Now().UTC()
	completedAt := sql.NullTime{}
	if status == models.TestStatusPassed || status == models.TestStatusFailed || status == models.TestStatusCancelled {
		completedAt = sql.NullTime{Time: now, Valid: true}
	}
	_, err := r.db.ExecContext(ctx, `UPDATE test_executions SET status=$1, completed_at=$2, updated_at=$3 WHERE id=$4`,
		string(status), completedAt, now, id)
	if err != nil {
		return err
	}
	res, _ := r.db.ExecContext(ctx, `SELECT 1 FROM test_executions WHERE id=$1`, id)
	_ = res
	return nil
}

func (r *Repository) SubmitResults(ctx context.Context, id string, req *models.SubmitResultRequest) error {
	now := time.Now().UTC()
	var status models.TestStatus
	if req.Failed > 0 || req.Errors > 0 {
		status = models.TestStatusFailed
	} else {
		status = models.TestStatusPassed
	}
	completedAt := sql.NullTime{Time: now, Valid: true}

	_, err := r.db.ExecContext(ctx, `
		UPDATE test_executions SET
			status=$1, total_tests=$2, passed=$3, failed=$4, skipped=$5, errors=$6,
			duration_ms=$7, report_url=$8, completed_at=$9, updated_at=$10
		WHERE id=$11`,
		string(status), req.TotalTests, req.Passed, req.Failed, req.Skipped, req.Errors,
		req.DurationMS, req.ReportURL, completedAt, now, id)
	if err != nil {
		return err
	}

	// Insert suites
	for i := range req.Suites {
		suite := req.Suites[i]
		sID := uuid.New().String()
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO test_suites (id, execution_id, name, tests, passed, failed, skipped, duration_ms)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			sID, id, suite.Name, suite.Tests, suite.Passed, suite.Failed, suite.Skipped, suite.DurationMS)
		if err != nil {
			return err
		}

		// Insert test cases for each suite
		for j := range suite.TestCases {
			tc := suite.TestCases[j]
			tcID := uuid.New().String()
			_, err := r.db.ExecContext(ctx, `
				INSERT INTO test_cases (id, suite_id, name, class_name, status, duration_ms, error_msg, stack_trace)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				tcID, sID, tc.Name, tc.ClassName, string(tc.Status), tc.DurationMS, tc.ErrorMsg, tc.StackTrace)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (r *Repository) GetSuites(ctx context.Context, executionID string) ([]models.TestSuite, error) {
	var suites []models.TestSuite
	err := r.db.SelectContext(ctx, &suites, `SELECT * FROM test_suites WHERE execution_id=$1 ORDER BY id`, executionID)
	if err != nil {
		return nil, err
	}
	if suites == nil {
		suites = []models.TestSuite{}
	}
	return suites, nil
}

func (r *Repository) GetTestCases(ctx context.Context, suiteID string) ([]models.TestCase, error) {
	var cases []models.TestCase
	err := r.db.SelectContext(ctx, &cases, `SELECT * FROM test_cases WHERE suite_id=$1 ORDER BY id`, suiteID)
	if err != nil {
		return nil, err
	}
	if cases == nil {
		cases = []models.TestCase{}
	}
	return cases, nil
}