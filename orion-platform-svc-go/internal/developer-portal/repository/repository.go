package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/developer-portal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- DeveloperPortal (legacy) ----------

func (r *Repository) Create(ctx context.Context, m *models.DeveloperPortal) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO developer_portals (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error) {
	var m models.DeveloperPortal
	err := r.db.GetContext(ctx, &m, `SELECT * FROM developer_portals WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.DeveloperPortal
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM developer_portals WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]any) error {
	_, err := r.db.ExecContext(ctx, `UPDATE developer_portals SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM developer_portals WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Portal Document ----------

func (r *Repository) CreateDocument(ctx context.Context, doc *models.PortalDocument) error {
	doc.CreatedAt = time.Now().UTC()
	doc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO portal_documents (id, tenant_id, title, category, content, status, views, helpful, version, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :title, :category, :content, :status, :views, :helpful, :version, :created_by, :created_at, :updated_at)`, doc)
	return err
}

func (r *Repository) GetDocumentByID(ctx context.Context, tenantID, id string) (*models.PortalDocument, error) {
	var doc models.PortalDocument
	err := r.db.GetContext(ctx, &doc, `SELECT * FROM portal_documents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *Repository) ListDocuments(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	if page < 0 {
		page = 0
	}
	offset := page * pageSize
	var docs []models.PortalDocument
	err := r.db.SelectContext(ctx, &docs, `SELECT * FROM portal_documents WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, pageSize, offset)
	if err != nil {
		return nil, err
	}
	return docs, nil
}

func (r *Repository) SearchDocuments(ctx context.Context, tenantID, query string) ([]models.PortalDocument, error) {
	var docs []models.PortalDocument
	err := r.db.SelectContext(ctx, &docs, `SELECT * FROM portal_documents WHERE tenant_id=$1 AND status='published' AND (title ILIKE $2 OR content ILIKE $2 OR category ILIKE $2) ORDER BY views DESC`, tenantID, "%"+query+"%")
	if err != nil {
		return nil, err
	}
	return docs, nil
}

func (r *Repository) UpdateDocument(ctx context.Context, tenantID string, doc *models.PortalDocument) error {
	doc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE portal_documents SET title=:title, category=:category, content=:content, status=:status, version=:version, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, doc)
	return err
}

func (r *Repository) DeleteDocument(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM portal_documents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) IncrementViews(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE portal_documents SET views=views+1 WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Document Version ----------

func (r *Repository) CreateDocumentVersion(ctx context.Context, v *models.DocumentVersion) error {
	v.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO portal_document_versions (id, document_id, version, content, created_by, created_at) VALUES (:id, :document_id, :version, :content, :created_by, :created_at)`, v)
	return err
}

func (r *Repository) GetDocumentVersions(ctx context.Context, tenantID, documentID string) ([]models.DocumentVersion, error) {
	var versions []models.DocumentVersion
	err := r.db.SelectContext(ctx, &versions, `SELECT v.* FROM portal_document_versions v INNER JOIN portal_documents d ON d.id = v.document_id WHERE v.document_id=$1 AND d.tenant_id=$2 ORDER BY v.created_at DESC`, documentID, tenantID)
	if err != nil {
		return nil, err
	}
	return versions, nil
}

// ---------- Document Stats ----------

func (r *Repository) GetDocumentStats(ctx context.Context, tenantID string) (*models.DocumentStats, error) {
	var stats models.DocumentStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(*) as total, sum(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft, sum(CASE WHEN status='review' THEN 1 ELSE 0 END) as review, sum(CASE WHEN status='published' THEN 1 ELSE 0 END) as published, sum(views) as total_views FROM portal_documents WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// ---------- Categories ----------

func (r *Repository) GetCategories(ctx context.Context, tenantID string) ([]models.CategoryInfo, error) {
	var cats []models.CategoryInfo
	err := r.db.SelectContext(ctx, &cats, `SELECT category, count(*) as count FROM portal_documents WHERE tenant_id=$1 AND category != '' GROUP BY category ORDER BY category`, tenantID)
	if err != nil {
		return nil, err
	}
	return cats, nil
}

// ---------- Popular ----------

func (r *Repository) GetPopularDocuments(ctx context.Context, tenantID string) ([]models.PortalDocument, error) {
	var docs []models.PortalDocument
	err := r.db.SelectContext(ctx, &docs, `SELECT * FROM portal_documents WHERE tenant_id=$1 AND status='published' ORDER BY views DESC LIMIT 10`, tenantID)
	if err != nil {
		return nil, err
	}
	return docs, nil
}

// ---------- Helpful ----------

func (r *Repository) RecordHelpful(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error) {
	if helpful {
		_, err := r.db.ExecContext(ctx, `UPDATE portal_documents SET helpful=helpful+1 WHERE id=$1 AND tenant_id=$2`, id, tenantID)
		if err != nil {
			return nil, err
		}
	}
	return r.GetDocumentByID(ctx, tenantID, id)
}

// ---------- Mock Rule ----------

func (r *Repository) CreateMockRule(ctx context.Context, rule *models.MockRule) error {
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dev_portal_mock_rules (id, tenant_id, name, method, path, responses, enabled, created_at, updated_at) VALUES (:id, :tenant_id, :name, :method, :path, :responses, :enabled, :created_at, :updated_at)`, rule)
	return err
}

func (r *Repository) GetMockRuleByID(ctx context.Context, tenantID, id string) (*models.MockRule, error) {
	var rule models.MockRule
	err := r.db.GetContext(ctx, &rule, `SELECT * FROM dev_portal_mock_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) ListMockRules(ctx context.Context, tenantID string, filter models.MockRuleFilter) ([]models.MockRule, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	query := `SELECT * FROM dev_portal_mock_rules WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if filter.Enabled != nil {
		query += fmt.Sprintf(" AND enabled=$%d", argIdx)
		args = append(args, *filter.Enabled)
		argIdx++
	}
	if filter.Method != "" {
		query += fmt.Sprintf(" AND method=$%d", argIdx)
		args = append(args, filter.Method)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)
	var rules []models.MockRule
	err := r.db.SelectContext(ctx, &rules, query, args...)
	if err != nil {
		return nil, 0, err
	}
	// count
	countQuery := `SELECT count(*) FROM dev_portal_mock_rules WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if filter.Enabled != nil {
		countQuery += fmt.Sprintf(" AND enabled=$%d", ci)
		countArgs = append(countArgs, *filter.Enabled)
	}
	if filter.Method != "" {
		countQuery += fmt.Sprintf(" AND method=$%d", ci)
		countArgs = append(countArgs, filter.Method)
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return rules, total, nil
}

func (r *Repository) GetMockRuleStats(ctx context.Context, tenantID string) (*models.MockRuleStats, error) {
	var stats models.MockRuleStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(*) as total, sum(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled, sum(CASE WHEN NOT enabled THEN 1 ELSE 0 END) as disabled, 0 as total_hits FROM dev_portal_mock_rules WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) UpdateMockRule(ctx context.Context, tenantID string, rule *models.MockRule) error {
	rule.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dev_portal_mock_rules SET name=:name, method=:method, path=:path, responses=:responses, enabled=:enabled, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, rule)
	return err
}

func (r *Repository) DeleteMockRule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM dev_portal_mock_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- SDK Task ----------

func (r *Repository) CreateSDKTask(ctx context.Context, task *models.SDKTask) error {
	task.CreatedAt = time.Now().UTC()
	task.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dev_portal_sdk_tasks (id, tenant_id, name, language, status, output_url, error, created_at, updated_at) VALUES (:id, :tenant_id, :name, :language, :status, :output_url, :error, :created_at, :updated_at)`, task)
	return err
}

func (r *Repository) GetSDKTaskByID(ctx context.Context, tenantID, id string) (*models.SDKTask, error) {
	var task models.SDKTask
	err := r.db.GetContext(ctx, &task, `SELECT * FROM dev_portal_sdk_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *Repository) ListSDKTasks(ctx context.Context, tenantID string, filter models.SDKTaskFilter) ([]models.SDKTask, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	query := `SELECT * FROM dev_portal_sdk_tasks WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if filter.Language != "" {
		query += fmt.Sprintf(" AND language=$%d", argIdx)
		_ = args[argIdx-2] // placeholder
		args = append(args, filter.Language)
		argIdx++
	}
	if filter.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)
	var tasks []models.SDKTask
	err := r.db.SelectContext(ctx, &tasks, query, args...)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT count(*) FROM dev_portal_sdk_tasks WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if filter.Language != "" {
		countQuery += fmt.Sprintf(" AND language=$%d", ci)
		countArgs = append(countArgs, filter.Language)
		ci++
	}
	if filter.Status != "" {
		countQuery += fmt.Sprintf(" AND status=$%d", ci)
		countArgs = append(countArgs, filter.Status)
		ci++
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func (r *Repository) GetSDKTaskStats(ctx context.Context, tenantID string) (*models.SDKTaskStats, error) {
	var stats models.SDKTaskStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(*) as total, sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, sum(CASE WHEN status='generating' THEN 1 ELSE 0 END) as generating, sum(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, sum(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed FROM dev_portal_sdk_tasks WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) UpdateSDKTask(ctx context.Context, tenantID string, task *models.SDKTask) error {
	task.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dev_portal_sdk_tasks SET language=:language, status=:status, output_url=:output_url, error=:error, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, task)
	return err
}

func (r *Repository) DeleteSDKTask(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM dev_portal_sdk_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Subscription ----------

func (r *Repository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	sub.CreatedAt = time.Now().UTC()
	sub.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dev_portal_subscriptions (id, tenant_id, user_id, api_name, plan_name, quota_per_day, quota_per_month, used_per_day, used_per_month, reason, status, approved_by, reject_reason, created_at, updated_at) VALUES (:id, :tenant_id, :user_id, :api_name, :plan_name, :quota_per_day, :quota_per_month, :used_per_day, :used_per_month, :reason, :status, :approved_by, :reject_reason, :created_at, :updated_at)`, sub)
	return err
}

func (r *Repository) GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.GetContext(ctx, &sub, `SELECT * FROM dev_portal_subscriptions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *Repository) GetSubscriptionByUserAndAPI(ctx context.Context, tenantID, userID, apiName string) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.GetContext(ctx, &sub, `SELECT * FROM dev_portal_subscriptions WHERE tenant_id=$1 AND user_id=$2 AND api_name=$3 ORDER BY created_at DESC LIMIT 1`, tenantID, userID, apiName)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *Repository) ListSubscriptions(ctx context.Context, tenantID string, filter models.SubscriptionFilter) ([]models.Subscription, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	query := `SELECT * FROM dev_portal_subscriptions WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if filter.UserID != "" {
		query += fmt.Sprintf(" AND user_id=$%d", argIdx)
		args = append(args, filter.UserID)
		argIdx++
	}
	if filter.APIName != "" {
		query += fmt.Sprintf(" AND api_name=$%d", argIdx)
		args = append(args, filter.APIName)
		argIdx++
	}
	if filter.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)
	var subs []models.Subscription
	err := r.db.SelectContext(ctx, &subs, query, args...)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT count(*) FROM dev_portal_subscriptions WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if filter.UserID != "" {
		countQuery += fmt.Sprintf(" AND user_id=$%d", ci)
		countArgs = append(countArgs, filter.UserID)
		ci++
	}
	if filter.APIName != "" {
		countQuery += fmt.Sprintf(" AND api_name=$%d", ci)
		countArgs = append(countArgs, filter.APIName)
		ci++
	}
	if filter.Status != "" {
		countQuery += fmt.Sprintf(" AND status=$%d", ci)
		countArgs = append(countArgs, filter.Status)
		ci++
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return subs, total, nil
}

func (r *Repository) GetSubscriptionStats(ctx context.Context, tenantID string) (*models.SubscriptionStats, error) {
	var stats models.SubscriptionStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(*) as total, sum(CASE WHEN status='approved' THEN 1 ELSE 0 END) as active, sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, sum(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected, sum(CASE WHEN status='suspended' THEN 1 ELSE 0 END) as suspended, sum(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled FROM dev_portal_subscriptions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) UpdateSubscription(ctx context.Context, tenantID string, sub *models.Subscription) error {
	sub.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dev_portal_subscriptions SET status=:status, approved_by=:approved_by, reject_reason=:reject_reason, used_per_day=:used_per_day, used_per_month=:used_per_month, quota_per_day=:quota_per_day, quota_per_month=:quota_per_month, plan_name=:plan_name, reason=:reason, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, sub)
	return err
}

// ---------- Usage Record ----------

func (r *Repository) GetUsageRecords(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) ([]models.UsageRecord, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	var records []models.UsageRecord
	err := r.db.SelectContext(ctx, &records, `SELECT u.* FROM dev_portal_usage_records u INNER JOIN dev_portal_subscriptions s ON s.id = u.subscription_id WHERE u.subscription_id=$1 AND s.tenant_id=$2 ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`, subscriptionID, tenantID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT count(*) FROM dev_portal_usage_records u INNER JOIN dev_portal_subscriptions s ON s.id = u.subscription_id WHERE u.subscription_id=$1 AND s.tenant_id=$2`, subscriptionID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

// ---------- Playground Request ----------

func (r *Repository) CreatePlaygroundRequest(ctx context.Context, preq *models.PlaygroundRequest) error {
	preq.CreatedAt = time.Now().UTC()
	preq.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dev_portal_playground_requests (id, tenant_id, user_id, name, method, path, headers, body, created_at, updated_at) VALUES (:id, :tenant_id, :user_id, :name, :method, :path, :headers, :body, :created_at, :updated_at)`, preq)
	return err
}

func (r *Repository) GetPlaygroundRequestByID(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error) {
	var preq models.PlaygroundRequest
	err := r.db.GetContext(ctx, &preq, `SELECT * FROM dev_portal_playground_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &preq, nil
}

func (r *Repository) ListPlaygroundRequests(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) ([]models.PlaygroundRequest, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	query := `SELECT * FROM dev_portal_playground_requests WHERE tenant_id=$1 AND user_id=$2`
	args := []any{tenantID, userID}
	argIdx := 3
	if filter.Method != "" {
		query += fmt.Sprintf(" AND method=$%d", argIdx)
		args = append(args, filter.Method)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)
	var items []models.PlaygroundRequest
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT count(*) FROM dev_portal_playground_requests WHERE tenant_id=$1 AND user_id=$2`
	countArgs := []any{tenantID, userID}
	ci := 3
	if filter.Method != "" {
		countQuery += fmt.Sprintf(" AND method=$%d", ci)
		countArgs = append(countArgs, filter.Method)
		ci++
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) GetPlaygroundStats(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error) {
	var stats models.PlaygroundStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(*) as total_requests, 0 as total_executions, 0 as successful_execs, 0 as failed_execs FROM dev_portal_playground_requests WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) UpdatePlaygroundRequest(ctx context.Context, tenantID string, preq *models.PlaygroundRequest) error {
	preq.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dev_portal_playground_requests SET name=:name, method=:method, path=:path, headers=:headers, body=:body, updated_at=:updated_at WHERE id=:id AND tenant_id=:tenant_id`, preq)
	return err
}

func (r *Repository) DeletePlaygroundRequest(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM dev_portal_playground_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------- Response History ----------

func (r *Repository) GetResponseHistory(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) ([]models.ResponseHistoryEntry, int, error) {
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := filter.Page * pageSize
	var entries []models.ResponseHistoryEntry
	err := r.db.SelectContext(ctx, &entries, `SELECT * FROM dev_portal_response_history WHERE request_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, requestID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT count(*) FROM dev_portal_response_history WHERE request_id=$1`, requestID)
	if err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func (r *Repository) ClearHistory(ctx context.Context, tenantID, requestID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM dev_portal_response_history WHERE request_id=$1`, requestID)
	return err
}
