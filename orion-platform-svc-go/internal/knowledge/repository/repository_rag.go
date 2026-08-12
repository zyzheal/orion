package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"

	"github.com/google/uuid"
)

// ============================================================================
// Conversation repository
// ============================================================================

func (r *Repository) CreateConversation(ctx context.Context, conv *models.Conversation) error {
	conv.ID = uuid.New().String()
	conv.CreatedAt = time.Now().UTC()
	conv.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_conversations (id, tenant_id, user_id, title, space_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		conv.ID, conv.TenantID, conv.UserID, conv.Title, conv.SpaceID, conv.CreatedAt, conv.UpdatedAt,
	)
	return err
}

func (r *Repository) GetConversation(ctx context.Context, id, tenantID string) (*models.Conversation, error) {
	var conv models.Conversation
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, user_id, title, space_id, created_at, updated_at
		 FROM rag_conversations WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(
		&conv.ID, &conv.TenantID, &conv.UserID, &conv.Title, &conv.SpaceID, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *Repository) ListConversations(ctx context.Context, tenantID string, userID string, limit int) ([]models.Conversation, error) {
	var items []models.Conversation
	query := `SELECT id, tenant_id, user_id, title, space_id, created_at, updated_at FROM rag_conversations WHERE tenant_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT $3`
	rows, err := r.db.QueryContext(ctx, query, tenantID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c models.Conversation
		var spaceID sql.NullString
		if err := rows.Scan(&c.ID, &c.TenantID, &c.UserID, &c.Title, &spaceID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.SpaceID = spaceID.String
		items = append(items, c)
	}
	return items, nil
}

// ============================================================================
// Chat message repository
// ============================================================================

func (r *Repository) SaveMessage(ctx context.Context, msg *models.ChatMessage) error {
	var sourcesJSON string
	if len(msg.Sources) > 0 {
		b, err := json.Marshal(msg.Sources)
		if err == nil {
			sourcesJSON = string(b)
		}
	}
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_chat_messages (conversation_id, tenant_id, role, content, sources, confidence, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		msg.ConvID, msg.TenantID, msg.Role, msg.Content, sourcesJSON, msg.Confidence, now,
	)
	return err
}

func (r *Repository) GetMessagesByConversation(ctx context.Context, convID string, limit int) ([]models.ChatMessage, error) {
	var items []models.ChatMessage
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, conversation_id, tenant_id, role, content, sources, confidence, created_at
		 FROM rag_chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`, convID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var m models.ChatMessage
		var sourcesRaw sql.NullString
		if err := rows.Scan(&m.ID, &m.ConvID, &m.TenantID, &m.Role, &m.Content, &sourcesRaw, &m.Confidence, &m.CreatedAt); err != nil {
			return nil, err
		}
		if sourcesRaw.String != "" {
			json.Unmarshal([]byte(sourcesRaw.String), &m.Sources)
		}
		items = append(items, m)
	}
	return items, nil
}

// ============================================================================
// Feedback repository
// ============================================================================

func (r *Repository) SaveFeedback(ctx context.Context, fb *models.FeedbackEvent) error {
	fb.ID = uuid.New().String()
	fb.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_feedback_events (id, tenant_id, user_id, conversation_id, message_id, is_positive, corrected_answer, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		fb.ID, fb.TenantID, fb.UserID, fb.ConvID, fb.MessageID, fb.IsPositive, fb.CorrectedAnswer, fb.CreatedAt,
	)
	return err
}

func (r *Repository) GetFeedbackByConversation(ctx context.Context, convID string) ([]models.FeedbackEvent, error) {
	var items []models.FeedbackEvent
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, user_id, conversation_id, message_id, is_positive, corrected_answer, created_at
		 FROM rag_feedback_events WHERE conversation_id = $1 ORDER BY created_at DESC`, convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var fb models.FeedbackEvent
		var corrected sql.NullString
		if err := rows.Scan(&fb.ID, &fb.TenantID, &fb.UserID, &fb.ConvID, &fb.MessageID, &fb.IsPositive, &corrected, &fb.CreatedAt); err != nil {
			return nil, err
		}
		fb.CorrectedAnswer = corrected.String
		items = append(items, fb)
	}
	return items, nil
}

// ============================================================================
// User correction repository (cross-session memory)
// ============================================================================

func (r *Repository) SaveUserCorrection(ctx context.Context, uc *models.UserCorrection) error {
	uc.ID = uuid.New().String()
	uc.SimilarityHash = computeQueryHash(uc.Query)
	uc.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_user_corrections (id, tenant_id, user_id, query, original_answer, corrected_answer, similarity_hash, applied_count, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		uc.ID, uc.TenantID, uc.UserID, uc.Query, uc.OriginalAnswer, uc.CorrectedAnswer, uc.SimilarityHash, 0, uc.CreatedAt,
	)
	return err
}

func (r *Repository) GetUserCorrections(ctx context.Context, tenantID, userID, hash string) ([]models.UserCorrection, error) {
	var items []models.UserCorrection
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, user_id, query, original_answer, corrected_answer, similarity_hash, applied_count, created_at
		 FROM rag_user_corrections WHERE tenant_id = $1 AND user_id = $2 AND similarity_hash = $3 ORDER BY created_at DESC LIMIT 5`,
		tenantID, userID, hash)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var uc models.UserCorrection
		var orig, corr sql.NullString
		if err := rows.Scan(&uc.ID, &uc.TenantID, &uc.UserID, &uc.Query, &orig, &corr, &uc.SimilarityHash, &uc.AppliedCount, &uc.CreatedAt); err != nil {
			return nil, err
		}
		uc.OriginalAnswer = orig.String
		uc.CorrectedAnswer = corr.String
		items = append(items, uc)
	}
	return items, nil
}

func (r *Repository) GetCorrectionsBySimilarity(ctx context.Context, tenantID, userID, hash string) ([]models.UserCorrection, error) {
	return r.GetUserCorrections(ctx, tenantID, userID, hash)
}

func (r *Repository) IncrementAppliedCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		 `UPDATE rag_user_corrections SET applied_count = applied_count + 1 WHERE id = $1`, id)
	return err
}

// ============================================================================
// Semantic cache repository
// ============================================================================

func (r *Repository) GetSemanticCache(ctx context.Context, tenantID, queryHash string) (*models.SemanticCache, error) {
	var sc models.SemanticCache
	var sourcesRaw, cachedAnswer, origQuery sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, query_hash, original_query, cached_answer, sources, hit_count, last_accessed_at, expires_at, created_at
		 FROM rag_semantic_cache WHERE tenant_id = $1 AND query_hash = $2 AND expires_at > NOW() ORDER BY hit_count DESC LIMIT 1`,
		tenantID, queryHash).Scan(
		&sc.ID, &sc.TenantID, &sc.QueryHash, &origQuery, &cachedAnswer, &sourcesRaw,
		&sc.HitCount, &sc.LastAccessedAt, &sc.ExpiresAt, &sc.CreatedAt)
	if err != nil {
		return nil, err
	}
	sc.OriginalQuery = origQuery.String
	sc.CachedAnswer = cachedAnswer.String
	if sourcesRaw.String != "" {
		json.Unmarshal([]byte(sourcesRaw.String), &sc.Sources)
	}
	return &sc, nil
}

func (r *Repository) SaveSemanticCache(ctx context.Context, sc *models.SemanticCache, ttlHours int) error {
	if sc.ID == "" {
		sc.ID = uuid.New().String()
	}
	sc.CreatedAt = time.Now().UTC()
	sc.LastAccessedAt = time.Now().UTC()
	sc.ExpiresAt = time.Now().UTC().Add(time.Duration(ttlHours) * time.Hour)

	var sourcesJSON string
	if len(sc.Sources) > 0 {
		b, err := json.Marshal(sc.Sources)
		if err == nil {
			sourcesJSON = string(b)
		}
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_semantic_cache (id, tenant_id, query_hash, original_query, cached_answer, sources, hit_count, last_accessed_at, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (tenant_id, query_hash) DO UPDATE SET cached_answer = EXCLUDED.cached_answer,
		 hit_count = rag_semantic_cache.hit_count + 1, last_accessed_at = EXCLUDED.last_accessed_at,
		 expires_at = EXCLUDED.expires_at`,
		sc.ID, sc.TenantID, sc.QueryHash, sc.OriginalQuery, sc.CachedAnswer,
		sourcesJSON, 1, sc.LastAccessedAt, sc.ExpiresAt, sc.CreatedAt,
	)
	return err
}

func (r *Repository) EvictExpiredCache(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM rag_semantic_cache WHERE expires_at < NOW()`)
	return err
}

// ============================================================================
// Prompt template repository
// ============================================================================

func (r *Repository) SavePromptTemplate(ctx context.Context, tmpl *models.PromptTemplate) error {
	tmpl.ID = uuid.New().String()
	if !tmpl.IsActive {
		tmpl.IsActive = true
	}
	tmpl.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_prompt_templates (id, name, version, content, is_active, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		tmpl.ID, tmpl.Name, tmpl.Version, tmpl.Content, tmpl.IsActive, tmpl.CreatedAt,
	)
	return err
}

func (r *Repository) GetActivePromptTemplate(ctx context.Context, name string) (*models.PromptTemplate, error) {
	var tmpl models.PromptTemplate
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, version, content, is_active, created_at FROM rag_prompt_templates
		 WHERE name = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`, name).Scan(
		&tmpl.ID, &tmpl.Name, &tmpl.Version, &tmpl.Content, &tmpl.IsActive, &tmpl.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func (r *Repository) ListPromptTemplates(ctx context.Context) ([]models.PromptTemplate, error) {
	var items []models.PromptTemplate
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, version, content, is_active, created_at FROM rag_prompt_templates ORDER BY name, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t models.PromptTemplate
		if err := rows.Scan(&t.ID, &t.Name, &t.Version, &t.Content, &t.IsActive, &t.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, nil
}

// ============================================================================
// Evaluation ground truth repository
// ============================================================================

func (r *Repository) SaveEvalGroundTruth(ctx context.Context, gt *models.EvalGroundTruth) error {
	gt.ID = uuid.New().String()
	gt.CreatedAt = time.Now().UTC()
	var sourcesJSON string
	if len(gt.GoldSources) > 0 {
		b, err := json.Marshal(gt.GoldSources)
		if err == nil {
			sourcesJSON = string(b)
		}
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_eval_ground_truth (id, tenant_id, query, gold_answer, gold_sources, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		gt.ID, gt.TenantID, gt.Query, gt.GoldAnswer, sourcesJSON, gt.CreatedAt,
	)
	return err
}

func (r *Repository) ListEvalGroundTruth(ctx context.Context, tenantID string) ([]models.EvalGroundTruth, error) {
	var items []models.EvalGroundTruth
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, query, gold_answer, gold_sources, created_at FROM rag_eval_ground_truth
		 WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var gt models.EvalGroundTruth
		var sourcesRaw sql.NullString
		if err := rows.Scan(&gt.ID, &gt.TenantID, &gt.Query, &gt.GoldAnswer, &sourcesRaw, &gt.CreatedAt); err != nil {
			return nil, err
		}
		if sourcesRaw.String != "" {
			json.Unmarshal([]byte(sourcesRaw.String), &gt.GoldSources)
		}
		items = append(items, gt)
	}
	return items, nil
}

func (r *Repository) DeleteEvalGroundTruth(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM rag_eval_ground_truth WHERE id = $1`, id)
	return err
}

// ============================================================================
// RAG Query Audit
// ============================================================================

func (r *Repository) SaveQueryAuditLog(ctx context.Context, log *models.RAGQueryAuditLog) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO rag_query_audit
			(id, tenant_id, user_id, query_text, query_hash, query_type, confidence,
			 latency_ms, source_count, answer_length,
			 has_feedback, feedback_positive, has_correction, correction_text,
			 safety_flagged, safety_reason, ip_address, user_agent, created_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7,
			 $8, $9, $10,
			 $11, $12, $13, $14,
			 $15, $16, $17, $18, $19)`,
		log.ID, log.TenantID, log.UserID, log.QueryText, log.QueryHash, log.QueryType, log.Confidence,
		log.LatencyMs, log.SourceCount, log.AnswerLength,
		log.HasFeedback, log.FeedbackPositive, log.HasCorrection, log.CorrectionText,
		log.SafetyFlagged, log.SafetyReason, log.IPAddress, log.UserAgent, log.CreatedAt)
	return err
}

func (r *Repository) ListQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, user_id, query_text, query_hash, query_type, confidence,
			latency_ms, source_count, answer_length,
			has_feedback, feedback_positive, has_correction, correction_text,
			safety_flagged, safety_reason, ip_address, user_agent, created_at
		 FROM rag_query_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAuditRows(rows)
}

func (r *Repository) ListFlaggedQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, user_id, query_text, query_hash, query_type, confidence,
			latency_ms, source_count, answer_length,
			has_feedback, feedback_positive, has_correction, correction_text,
			safety_flagged, safety_reason, ip_address, user_agent, created_at
		 FROM rag_query_audit WHERE tenant_id = $1 AND safety_flagged = true ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAuditRows(rows)
}

func (r *Repository) CountQueryAuditLogs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM rag_query_audit WHERE tenant_id = $1`, tenantID).Scan(&count)
	return count, err
}

func scanAuditRows(rows *sql.Rows) ([]models.RAGQueryAuditLog, error) {
	var logs []models.RAGQueryAuditLog
	for rows.Next() {
		var l models.RAGQueryAuditLog
		if err := rows.Scan(
			&l.ID, &l.TenantID, &l.UserID, &l.QueryText, &l.QueryHash, &l.QueryType, &l.Confidence,
			&l.LatencyMs, &l.SourceCount, &l.AnswerLength,
			&l.HasFeedback, &l.FeedbackPositive, &l.HasCorrection, &l.CorrectionText,
			&l.SafetyFlagged, &l.SafetyReason, &l.IPAddress, &l.UserAgent, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}
// Eval metric repository
// ============================================================================

func (r *Repository) SaveEvalMetric(ctx context.Context, m *models.EvalMetric) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rag_eval_metrics (id, tenant_id, query_id, recall_at_5, precision, ndcg, hallucination_rate, latency_ms, score, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		m.ID, m.TenantID, m.QueryID, m.RecallAt5, m.Precision, m.NDCG,
		m.HallucinationRate, m.LatencyMs, m.Score, m.CreatedAt,
	)
	return err
}

func (r *Repository) GetEvalMetrics(ctx context.Context, tenantID string) (*models.EvalMetric, error) {
	var agg models.EvalMetric
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(AVG(recall_at_5),0), COALESCE(AVG(precision),0), COALESCE(AVG(ndcg),0),
			   COALESCE(AVG(hallucination_rate),0), COALESCE(AVG(latency_ms),0),
			   COALESCE(AVG(score),0), COUNT(*)
		 FROM rag_eval_metrics WHERE tenant_id = $1`, tenantID).Scan(
		&agg.RecallAt5, &agg.Precision, &agg.NDCG, &agg.HallucinationRate, &agg.LatencyMs, &agg.Score, &count)
	if err != nil {
		return nil, err
	}
	return &agg, nil
}

// ============================================================================
// Helper
// ============================================================================

func computeQueryHash(query string) string {
	h := sha256.Sum256([]byte(query))
	return hex.EncodeToString(h[:32])
}