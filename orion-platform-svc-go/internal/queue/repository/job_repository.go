package repository

import (
	"context"
	"database/sql"
	"errors"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/queue/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrJobNotFound = errors.New("job not found")

type JobRepository struct {
	db *sqlx.DB
}

func NewJobRepository(db *sqlx.DB) *JobRepository {
	return &JobRepository{db: db}
}

// EnqueueJob inserts a new job and returns it with generated ID and timestamps.
func (r *JobRepository) EnqueueJob(ctx context.Context, job *models.Job) error {
	job.ID = uuid.New().String()
	now := time.Now().UnixMilli()
	job.CreatedAt = now
	job.UpdatedAt = now
	job.Status = models.JobStatusPending
	job.Attempts = 0

	payloadJSON, _ := json.Marshal(job.Payload)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO queue_jobs (id, tenant_id, queue_name, job_type, payload, status, priority, attempts, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		job.ID, job.TenantID, job.QueueName, job.Type, string(payloadJSON),
		job.Status, job.Priority, job.Attempts, job.CreatedAt, job.UpdatedAt)
	return err
}

// GetByID retrieves a job by its ID scoped to tenant.
func (r *JobRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Job, error) {
	job := &models.Job{}
	err := r.db.GetContext(ctx, job, `SELECT * FROM queue_jobs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, ErrJobNotFound
	}
	return job, nil
}

// DequeueJob finds the next pending job for the given queue (highest priority, oldest first),
// marks it as executing, and returns it. Uses SELECT ... FOR UPDATE SKIP LOCKED for safety.
func (r *JobRepository) DequeueJob(ctx context.Context, tenantID, queueName string) (*models.Job, error) {
	now := time.Now().UnixMilli()
	var jobID string
	err := r.db.QueryRowContext(ctx, `
		SELECT id FROM queue_jobs
		WHERE tenant_id = $1 AND queue_name = $2 AND status = $3
		ORDER BY priority DESC, created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED`, tenantID, queueName, models.JobStatusPending).Scan(&jobID)
	if err == sql.ErrNoRows {
		return nil, ErrJobNotFound
	}
	if err != nil {
		return nil, err
	}

	_, err = r.db.ExecContext(ctx, `
		UPDATE queue_jobs SET status = $1, attempts = attempts + 1, updated_at = $2
		WHERE id = $3`, models.JobStatusExecuting, now, jobID)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, tenantID, jobID)
}

// CompleteJob marks a job as completed, optionally storing a result payload.
func (r *JobRepository) CompleteJob(ctx context.Context, tenantID, id string, result map[string]interface{}) (*models.Job, error) {
	var resultJSON string
	if result != nil {
		b, _ := json.Marshal(result)
		resultJSON = string(b)
	}

	job := &models.Job{}
	err := r.db.GetContext(ctx, job, `
		UPDATE queue_jobs
		SET status = $1, result = COALESCE($2, NULL), updated_at = $3
		WHERE id = $4 AND tenant_id = $5
		RETURNING *`,
		models.JobStatusCompleted, resultJSON, time.Now().UnixMilli(), id, tenantID)
	if err != nil {
		return nil, ErrJobNotFound
	}
	return job, nil
}

// Update modifies selected fields on a job.
func (r *JobRepository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Job, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UnixMilli())
	idx++
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE queue_jobs SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}
