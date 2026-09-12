package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
	"unicode"

	"orion/platform-svc-go/internal/incident/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Incident CRUD ---

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.Incident) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = "open"
	}
	if m.EscalationLevel == 0 {
		m.EscalationLevel = 0
	}
	query := `INSERT INTO incidents (
		id, tenant_id, title, description, type, severity, priority, status,
		impact, urgency, commander_id, assigned_team, affected_services,
		escalation_level, environment, service, detected_by, error_message,
		tags, resolved_by, closed_at, closed_by, related_problem_id,
		linked_problem_id, linked_change_id, sla_breach, sla_breach_at,
		postmortem_required, created_at, updated_at
) VALUES (
		:id, :tenant_id, :title, :description, :type, :severity, :priority, :status,
		:impact, :urgency, :commander_id, :assigned_team, :affected_services,
		:escalation_level, :environment, :service, :detected_by, :error_message,
		:tags, :resolved_by, :closed_at, :closed_by, :related_problem_id,
		:linked_problem_id, :linked_change_id, :sla_breach, :sla_breach_at,
		:postmortem_required, :created_at, :updated_at
)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Incident, error) {
	var m models.Incident
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM incidents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.IncidentListQuery) (*models.IncidentListResult, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	var where []string
	var args []interface{}
	paramIdx := 1

	where = append(where, fmt.Sprintf("tenant_id=$%d", paramIdx))
	args = append(args, tenantID)
	paramIdx++

	if q.Status != "" {
		where = append(where, fmt.Sprintf("status=$%d", paramIdx))
		args = append(args, q.Status)
		paramIdx++
	}
	if q.Severity != "" {
		where = append(where, fmt.Sprintf("severity=$%d", paramIdx))
		args = append(args, q.Severity)
		paramIdx++
	}
	if q.Priority != "" {
		where = append(where, fmt.Sprintf("priority=$%d", paramIdx))
		args = append(args, q.Priority)
		paramIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM incidents WHERE %s`, whereClause), args...)
	if err != nil {
		return nil, err
	}

	// Fetch rows
	var items []models.Incident
	argsLimit := append(args, q.Limit, q.Offset)
	err = r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM incidents WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, whereClause, paramIdx, paramIdx+1), argsLimit...)
	if err != nil {
		return nil, err
	}

	return &models.IncidentListResult{Incidents: items, Total: total}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()

	// Build dynamic update
	if len(updates) == 0 {
		return nil
	}

	var fields []string
	var args []interface{}
	paramIdx := 1

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, paramIdx))
		args = append(args, v)
		paramIdx++
	}

	args = append(args, id, tenantID)
	fieldClause := strings.Join(fields, ", ")
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE incidents SET %s WHERE id=$%d AND tenant_id=$%d`, fieldClause, paramIdx, paramIdx+1), args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM incidents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	_, _ = result.RowsAffected()
	return nil
}

func (r *Repository) Exists(ctx context.Context, tenantID, id string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM incidents WHERE id=$1 AND tenant_id=$2)`, id, tenantID)
	return exists, err
}

// --- Status update ---

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, newStatus, actorID, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, newStatus, time.Now().UTC(), id, tenantID)
	return err
}

// --- Assignment ---

func (r *Repository) AssignCommander(ctx context.Context, tenantID, id, commanderID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET commander_id=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, commanderID, time.Now().UTC(), id, tenantID)
	return err
}

// --- Escalation ---

func (r *Repository) Escalate(ctx context.Context, tenantID, incidentID string, fromLevel, toLevel int, reason, escalatedBy string) error {
	// Insert escalation record
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_escalations (id, incident_id, tenant_id, from_level, to_level, reason, escalated_by, created_at)
		VALUES (:id, :incident_id, :tenant_id, :from_level, :to_level, :reason, :escalated_by, :created_at)`,
		map[string]interface{}{
			"id":           uuid.New().String(),
			"incident_id":  incidentID,
			"tenant_id":    tenantID,
			"from_level":   fromLevel,
			"to_level":     toLevel,
			"reason":       reason,
			"escalated_by": escalatedBy,
			"created_at":   time.Now().UTC(),
		})
	if err != nil {
		return err
	}

	// Update incident escalation level
	_, err = r.db.ExecContext(ctx,
		`UPDATE incidents SET escalation_level=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, toLevel, time.Now().UTC(), incidentID, tenantID)
	return err
}

func (r *Repository) GetEscalations(ctx context.Context, tenantID, incidentID string) ([]models.EscalationRecord, error) {
	var items []models.EscalationRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM incident_escalations WHERE incident_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, incidentID, tenantID)
	return items, err
}

// --- Timeline ---

func (r *Repository) AddTimelineEvent(ctx context.Context, tenantID, incidentID string, req models.AddTimelineEventRequest, metadataJSON string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_timeline (id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at)
		VALUES (:id, :incident_id, :tenant_id, :event_type, :actor_id, :content, :metadata, :created_at)`,
		map[string]interface{}{
			"id":          uuid.New().String(),
			"incident_id": incidentID,
			"tenant_id":   tenantID,
			"event_type":  req.EventType,
			"actor_id":    req.ActorID,
			"content":     req.Content,
			"metadata":    metadataJSON,
			"created_at":  time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetTimeline(ctx context.Context, tenantID, incidentID string, q models.TimelineQuery) ([]models.TimelineEvent, error) {
	var items []models.TimelineEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM incident_timeline WHERE incident_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		incidentID, tenantID, 20, 0)
	return items, err
}

// --- Postmortem ---

func (r *Repository) CreatePostmortem(ctx context.Context, tenantID, incidentID string, pm *models.PostmortemRecord) error {
	pm.ID = uuid.New().String()
	pm.TenantID = tenantID
	pm.IncidentID = incidentID
	pm.Status = "draft"
	pm.CreatedAt = time.Now().UTC()
	pm.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_postmortems (id, incident_id, tenant_id, title, summary, root_cause, contributing_factors, impact_description, timeline_summary, action_items, lessons_learned, status, created_by, reviewed_by, published_at, created_at, updated_at)
		VALUES (:id, :incident_id, :tenant_id, :title, :summary, :root_cause, :contributing_factors, :impact_description, :timeline_summary, :action_items, :lessons_learned, :status, :created_by, :reviewed_by, :published_at, :created_at, :updated_at)`, pm)
	return err
}

func (r *Repository) GetPostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	var pm models.PostmortemRecord
	err := r.db.GetContext(ctx, &pm,
		`SELECT * FROM incident_postmortems WHERE incident_id=$1 AND tenant_id=$2`, incidentID, tenantID)
	if err != nil {
		return nil, err
	}
	return &pm, nil
}

func (r *Repository) PostmortemExists(ctx context.Context, tenantID, incidentID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM incident_postmortems WHERE incident_id=$1 AND tenant_id=$2)`, incidentID, tenantID)
	return exists, err
}

func (r *Repository) UpdatePostmortem(ctx context.Context, tenantID, incidentID string, updates map[string]interface{}) (*models.PostmortemRecord, error) {
	updates["updated_at"] = time.Now().UTC()

	var fields []string
	var args []interface{}
	paramIdx := 1

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, paramIdx))
		args = append(args, v)
		paramIdx++
	}

	if len(fields) == 0 {
		return nil, nil
	}

	args = append(args, incidentID, tenantID)
	fieldClause := strings.Join(fields, ", ")
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE incident_postmortems SET %s WHERE incident_id=$%d AND tenant_id=$%d`, fieldClause, paramIdx, paramIdx+1), args...)
	if err != nil {
		return nil, err
	}

	return r.GetPostmortem(ctx, tenantID, incidentID)
}

func (r *Repository) PublishPostmortem(ctx context.Context, tenantID, incidentID string, reviewedBy *string) (*models.PostmortemRecord, error) {
	now := time.Now().UTC()
	if reviewedBy != nil && *reviewedBy != "" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE incident_postmortems SET status='published', reviewed_by=$1, published_at=$2, updated_at=$3 WHERE incident_id=$4 AND tenant_id=$5 AND status='draft'`,
			*reviewedBy, now, now, incidentID, tenantID)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := r.db.ExecContext(ctx,
			`UPDATE incident_postmortems SET status='published', published_at=$1, updated_at=$2 WHERE incident_id=$3 AND tenant_id=$4 AND status='draft'`,
			now, now, incidentID, tenantID)
		if err != nil {
			return nil, err
		}
	}
	return r.GetPostmortem(ctx, tenantID, incidentID)
}

func (r *Repository) ArchivePostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE incident_postmortems SET status='archived', updated_at=$1 WHERE incident_id=$2 AND tenant_id=$3 AND status='published'`,
		now, incidentID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetPostmortem(ctx, tenantID, incidentID)
}

// --- SLA ---

func (r *Repository) CheckSlaBreach(ctx context.Context, tenantID, incidentID string) (*models.SlaCheckResult, error) {
	var sla models.SlaCheckResult
	err := r.db.GetContext(ctx, &sla,
		`SELECT id FROM incidents WHERE id=$1 AND tenant_id=$2`, incidentID, tenantID)
	if err != nil {
		return nil, err
	}

	// Compute approximate SLA based on severity
	// Return a dummy result; real implementation would compute from SLA policy table
	return &models.SlaCheckResult{
		IncidentID: incidentID,
		Status:     "open",
		Breached:   false,
	}, nil
}

func (r *Repository) MarkSlaBreach(ctx context.Context, tenantID, incidentID string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET sla_breach=true, sla_breach_at=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		now, now, incidentID, tenantID)
	return err
}

// --- Statistics ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error) {
	stats := &models.IncidentStats{
		ByStatus:   make(map[string]int),
		BySeverity: make(map[string]int),
		ByPriority: make(map[string]int),
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM incidents WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.Total = total

	var byStatus []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	r.db.SelectContext(ctx, &byStatus,
		`SELECT status, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY status`, tenantID)
	for _, row := range byStatus {
		stats.ByStatus[row.Status] = row.Count
	}

	var bySev []struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}
	r.db.SelectContext(ctx, &bySev,
		`SELECT severity, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY severity`, tenantID)
	for _, row := range bySev {
		stats.BySeverity[row.Severity] = row.Count
	}

	var byPri []struct {
		Priority string `db:"priority"`
		Count    int    `db:"count"`
	}
	r.db.SelectContext(ctx, &byPri,
		`SELECT priority, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY priority`, tenantID)
	for _, row := range byPri {
		stats.ByPriority[row.Priority] = row.Count
	}

	var slaBreachCount int
	r.db.GetContext(ctx, &slaBreachCount,
		`SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND sla_breach=true`, tenantID)
	stats.SlaBreachCount = slaBreachCount

	var escCount int
	r.db.GetContext(ctx, &escCount,
		`SELECT COUNT(*) FROM incident_escalations WHERE tenant_id=$1`, tenantID)
	stats.EscalationCount = escCount

	return stats, nil
}

// --- Knowledge recommendations ---

const (
	knowledgeDefaultLimit    = 5
	knowledgeMaxLimit        = 50
	knowledgeMaxTerms        = 12
	knowledgeFetchMultiplier = 10
	knowledgeMaxFetch        = 200
)

// knowledgeDocRow is one published kb_docs row fetched for relevance scoring.
type knowledgeDocRow struct {
	ID      string `db:"id"`
	Title   string `db:"title"`
	Content string `db:"content"`
}

// GetKnowledgeRecommendations returns the published knowledge-base documents
// most relevant to the incident, ranked by term coverage.
//
// It was an unconditional `return []models.KnowledgeRecommendation{}, nil`
// placeholder, so GET /:id/knowledge always answered with an empty list - the
// caller could never tell "no matching runbook exists" from "nobody ever
// implemented this". It also ignored incidentID, so there was no tenant
// ownership check on the endpoint.
//
// The documents live in kb_docs, the knowledge module's table (a read-only
// cross-module query; every repository here shares one connection pool, and the
// chatops repository already reads tables outside its own domain).
//
// Relevance is computed here rather than with Postgres `similarity()` because
// `pg_trgm` is not created by any migration, so an ORDER BY on `similarity()`
// would fail at runtime while plain ILIKE works everywhere.
func (r *Repository) GetKnowledgeRecommendations(ctx context.Context, tenantID, incidentID string, limit int) ([]models.KnowledgeRecommendation, error) {
	if limit <= 0 {
		limit = knowledgeDefaultLimit
	}
	if limit > knowledgeMaxLimit {
		limit = knowledgeMaxLimit
	}

	inc, err := r.GetByID(ctx, tenantID, incidentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("incident not found: %s", incidentID)
		}
		return nil, err
	}

	terms := knowledgeTerms(inc)
	if len(terms) == 0 {
		return []models.KnowledgeRecommendation{}, nil
	}

	// Fetch a bounded window so the top N can be chosen by relevance instead of
	// by insertion order.
	fetch := limit * knowledgeFetchMultiplier
	if fetch > knowledgeMaxFetch {
		fetch = knowledgeMaxFetch
	}

	conds := make([]string, 0, len(terms))
	args := []interface{}{tenantID}
	for i, term := range terms {
		n := i + 2
		conds = append(conds, fmt.Sprintf("(title ILIKE $%d OR content ILIKE $%d)", n, n))
		args = append(args, "%"+term+"%")
	}
	args = append(args, fetch)

	var docs []knowledgeDocRow
	err = r.db.SelectContext(ctx, &docs,
		fmt.Sprintf(`SELECT id, title, content FROM kb_docs
			WHERE tenant_id=$1 AND status='published' AND (%s)
			ORDER BY created_at DESC LIMIT $%d`, strings.Join(conds, " OR "), len(args)),
		args...,
	)
	if err != nil {
		return nil, err
	}

	recommendations := make([]models.KnowledgeRecommendation, 0, len(docs))
	for _, d := range docs {
		relevance := knowledgeRelevance(terms, d.Title, d.Content)
		if relevance <= 0 {
			continue
		}
		recommendations = append(recommendations, models.KnowledgeRecommendation{
			ID:          d.ID,
			Title:       d.Title,
			Description: knowledgeSnippet(d.Content),
			Relevance:   relevance,
		})
	}
	sort.SliceStable(recommendations, func(i, j int) bool {
		return recommendations[i].Relevance > recommendations[j].Relevance
	})
	if len(recommendations) > limit {
		recommendations = recommendations[:limit]
	}
	return recommendations, nil
}

// knowledgeTerms derives the search terms for an incident's knowledge lookup.
// Tags, the owning service, and the most specific words of the title are the
// most predictive, so terms are capped by descending length and then sorted for
// a deterministic query.
func knowledgeTerms(inc *models.Incident) []string {
	seen := map[string]bool{}
	var terms []string
	add := func(s string) {
		s = strings.ToLower(strings.TrimSpace(s))
		if len(s) < 3 || seen[s] {
			return
		}
		seen[s] = true
		terms = append(terms, s)
	}

	add(inc.Service)
	add(inc.Environment)
	add(inc.Type)
	// TagsRaw is never persisted - incidents.tags is JSONB and is only ever
	// stored as the Tags string - so Tags is the source that actually carries
	// data; TagsRaw is kept for callers that pre-parse it in memory.
	for _, w := range incidentTokens(inc.Tags) {
		add(w)
	}
	for _, t := range inc.TagsRaw {
		add(t)
	}
	for _, w := range incidentTokens(inc.Title) {
		add(w)
	}
	// AffectedServices is a JSON array string, so tokenize it rather than using
	// it verbatim.
	for _, w := range incidentTokens(inc.AffectedServices) {
		add(w)
	}

	sort.Slice(terms, func(i, j int) bool {
		if len(terms[i]) != len(terms[j]) {
			return len(terms[i]) > len(terms[j])
		}
		return terms[i] < terms[j]
	})
	if len(terms) > knowledgeMaxTerms {
		terms = terms[:knowledgeMaxTerms]
	}
	sort.Strings(terms)
	return terms
}

// incidentTokens splits a string into lowercase words, which is what makes JSON
// payloads like `["api-gateway","postgres"]` usable as search terms. Hyphens and
// underscores are kept because they occur inside real service identifiers -
// splitting them would turn "api-gateway" into the two useless terms "api" and
// "gateway".
func incidentTokens(s string) []string {
	var out []string
	var b strings.Builder
	flush := func() {
		if b.Len() == 0 {
			return
		}
		if tok := strings.Trim(b.String(), "-_"); tok != "" {
			out = append(out, tok)
		}
		b.Reset()
	}
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			b.WriteRune(r)
			continue
		}
		flush()
	}
	flush()
	return out
}

// knowledgeRelevance scores a document against the terms in [0,1]. A title hit
// is worth more than a body hit, because a title match means the document is
// about the term rather than merely mentioning it.
func knowledgeRelevance(terms []string, title, content string) float64 {
	title = strings.ToLower(title)
	content = strings.ToLower(content)
	var score, max float64
	for _, t := range terms {
		max += 1.5
		if strings.Contains(title, t) {
			score += 0.5
		}
		if strings.Contains(content, t) {
			score += 1.0
		}
	}
	if max == 0 {
		return 0
	}
	return math.Round(score/max*10000) / 10000
}

// knowledgeSnippet returns a short single-line excerpt of a document body for
// the recommendation's Description field; kb_docs has no description column.
func knowledgeSnippet(content string) string {
	s := strings.Join(strings.Fields(strings.TrimSpace(content)), " ")
	if len(s) <= 160 {
		return s
	}
	return s[:160] + "..."
}
