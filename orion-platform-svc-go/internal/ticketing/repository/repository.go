package repository

import (
	"context"
	"fmt"
	"sort"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ticketColumns is the explicit projection every SELECT against tickets uses.
// Never SELECT *: sqlx runs in safe mode, and 571 / 572 add deleted_at,
// created_by and updated_by to this table, none of which models.Ticket has a db
// destination for — a SELECT * fails the whole read even though none of those
// columns are needed. This is the same rule GetWorkflowHistory below already
// follows.
//
// The names are 076_create_ticketing_tables.sql's: metadata is omitted because
// models.Ticket.Metadata has no db tag, and type / assigned_to are declared in
// the struct but exist as no column at all. description, category and source
// are declared nullable in 076 but scan into non-pointer strings here, so NULL
// would fail the row; COALESCE gives them the empty string instead, which is
// what a missing value already means to every caller. The nullable columns
// whose destinations are pointers (assignee_id, source_id, resolved_at,
// closed_at) need no wrapping.
const ticketColumns = "id, tenant_id, title, COALESCE(description, '') AS description, COALESCE(category, '') AS category, priority, status, assignee_id, reporter_id, COALESCE(source, '') AS source, source_id, resolved_at, closed_at, created_at, updated_at"

// relationColumns is the same projection for ticket_relations. description is
// nullable in 696_add_ticket_relation_transfer_columns.sql but scans into a
// non-pointer string, so it is COALESCE'd for the same reason. created_by is
// omitted entirely: 572 adds it as UUID REFERENCES users(id), pre-572 rows hold
// NULL there, and NULL does not scan into a string. related_ticket_id and
// relation_type are struct fields that have no column, so they cannot be
// selected.
const relationColumns = "id, tenant_id, ticket_id, related_id, type, COALESCE(description, '') AS description, confidence, created_at"

// --- Ticket CRUD ---

func (r *Repository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	t.ID = uuid.New().String()
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO tickets (id, tenant_id, title, description, status, priority, category, assignee_id, reporter_id, source, source_id, metadata, created_at, updated_at)
		 VALUES (:id, :tenant_id, :title, :description, :status, :priority, :category, :assignee_id, :reporter_id, :source, :source_id, :metadata, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":          t.ID,
			"tenant_id":   t.TenantID,
			"title":       t.Title,
			"description": t.Description,
			"status":      t.Status,
			"priority":    t.Priority,
			"category":    t.Category,
			"assignee_id": t.AssigneeID,
			"reporter_id": t.ReporterID,
			"source":      t.Source,
			"source_id":   t.SourceID,
			"metadata":    t.Metadata,
			"created_at":  t.CreatedAt,
			"updated_at":  t.UpdatedAt,
		})
	return err
}

func (r *Repository) GetTicket(ctx context.Context, tenantID, id string) (*models.Ticket, error) {
	var t models.Ticket
	err := r.db.GetContext(ctx, &t,
		"SELECT "+ticketColumns+" FROM tickets WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var args []interface{}
	var whereClauses []string
	whereClauses = append(whereClauses, "tenant_id = $1")
	args = append(args, tenantID)

	param := 2
	if q.Status != nil {
		whereClauses = append(whereClauses, "status = $"+string(rune(param+'0')))
		args = append(args, *q.Status)
		param++
	}
	if q.Priority != nil {
		whereClauses = append(whereClauses, "priority = $"+string(rune(param+'0')))
		args = append(args, *q.Priority)
		param++
	}
	if q.Assignee != nil {
		whereClauses = append(whereClauses, "assignee_id = $"+string(rune(param+'0')))
		args = append(args, *q.Assignee)
		param++
	}
	if q.Category != nil {
		whereClauses = append(whereClauses, "category = $"+string(rune(param+'0')))
		args = append(args, *q.Category)
		param++
	}
	if q.Search != nil {
		whereClauses = append(whereClauses, "(title ILIKE $"+string(rune(param+'0'))+" OR description ILIKE $"+string(rune(param+'0'))+")")
		args = append(args, "%"+*q.Search+"%")
		param++
	}

	where := "WHERE " + joinSQL(whereClauses, " AND ")
	// The index is a number, not a rune. string(rune(len(args)+1)) without the
	// '+'0' would emit U+0002 (STX) instead of the digit "2", so the query read
	// "LIMIT $\x02" and GET /tickets answered 500 for every request. The LIMIT
	// and OFFSET come after every filter arg, so their positions are len(args)+1
	// and len(args)+2. An earlier draft built a `placeholders` slice for these
	// positions and never read it; that dead code is gone.
	sql := fmt.Sprintf("SELECT %s FROM tickets %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", ticketColumns, where, len(args)+1, len(args)+2)
	args = append(args, q.Limit, q.Offset)

	var items []models.Ticket
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// 655_create_ticketing_missing_tables.sql declares all of these tables with
// UUID PRIMARY KEY, and 571 / 572 add deleted_at, created_by, updated_by and
// updated_at to the ones they cover. Every SELECT in this file is therefore an
// explicit projection: SELECT * hands back columns the destination struct has
// no db:"..." name for, and sqlx safe mode fails the whole read.
//
// conditions and skills are JSONB in 655 but string in the models, so the
// projection casts them to text -- lib/pq returns JSONB as []byte, which does
// not scan into a string.
//
// Nullable UUIDs are COALESCEd to an empty string because a NULL never scans
// into a plain string, and start_at is COALESCEd to NOW() for the same reason
// -- neither cast is cosmetic, they are what lets these rows exist at all.
// transferHistoryColumns deliberately omits tenant_id: models.TransferHistoryEntry
// has no db:"tenant_id" destination, and a projected column with no destination
// is the exact failure this block exists to avoid.
const (
	assignmentRuleColumns   = "id, tenant_id, name, conditions::text AS conditions, action, COALESCE(target_id, '') AS target_id, enabled, created_at"
	slaTargetColumns        = "id, tenant_id, priority, response_hours, resolve_hours, enabled, created_at"
	slaPolicyColumns        = "id, tenant_id, name, priority, response_hours, resolve_hours, active, created_at, updated_at"
	slaBreachColumns        = "id, ticket_id, COALESCE(policy_id, '') AS policy_id, type, breached_at"
	automationRuleColumns   = "id, tenant_id, name, trigger, condition, action, enabled, created_at, updated_at"
	dispatchEngineerColumns = "id, tenant_id, COALESCE(user_id, '') AS user_id, name, skills::text AS skills, max_tickets, is_active, current_load, created_at, updated_at"
	dispatchRuleColumns     = "id, tenant_id, name, conditions::text AS conditions, strategy, weight, enabled, created_at"
	transferHistoryColumns  = "id, ticket_id, COALESCE(from_user_id, '') AS from_user_id, COALESCE(to_user_id, '') AS to_user_id, reason, created_at"
	suspendColumns          = "id, tenant_id, COALESCE(engineer_id, '') AS engineer_id, reason, type, COALESCE(start_at, NOW()) AS start_at, end_at, status, created_at"
)

// slaTrackingColumns and assignmentColumns cover the two tables created by
// 245_ticketing_schema_fixes.sql rather than 655. 245 declares exactly the
// columns in these two lists, but 571 adds deleted_at and 572 adds created_by
// and updated_by (plus updated_at to ticket_assignments), so the final tables
// carry 15 and 11 columns respectively. Both destinations below carry 12 and 7
// db:"..." names, so a SELECT * or RETURNING * on either one dies in sqlx safe
// mode with "missing destination name deleted_at" before any row is read.
//
// 245 also declares ticket_assignments.reason TEXT with no NOT NULL and no
// default, so a legacy row created before the reason column was added to the
// writer holds NULL. NULL never scans into the Reason string destination, so
// reason is COALESCE'd like the other nullable-into-string columns above.
const (
	slaTrackingColumns = "id, ticket_id, priority, target_resolution_time_ms, actual_resolution_time_ms, breached, breached_at, resolved_at, first_response_at, response_breached, created_at, updated_at"
	assignmentColumns  = "id, tenant_id, ticket_id, assignee, assigned_by, COALESCE(reason, '') AS reason, created_at"
)

// writableTicketColumns is the allow list for UpdateTicket's dynamic SET
// clause. The keys are hardcoded in the service layer today, but building SQL
// from an unchecked map would both reach for a column 076 does not have and
// make this method an injection point, so an unknown key is an error rather
// than a silent drop: silently ignoring a key is exactly how this method used
// to behave — it received the whole map and wrote only updated_at, which made
// every transition, assignment, escalation, resolve and close a no-op.
var writableTicketColumns = map[string]bool{
	"title":       true,
	"description": true,
	"category":    true,
	"priority":    true,
	"status":      true,
	"assignee_id": true,
	"reporter_id": true,
	"resolved_at": true,
	"closed_at":   true,
	"updated_at":  true,
}

// writableSLAPolicyColumns and writableAutomationRuleColumns are the same
// guard for the two 655 tables that take a dynamic map. Both lists stop short
// of id, tenant_id, name-of-tenant and created_at: those are identity or
// immutable.
var (
	writableSLAPolicyColumns = map[string]bool{
		"name":           true,
		"priority":       true,
		"response_hours": true,
		"resolve_hours":  true,
		"active":         true,
		"updated_at":     true,
	}
	writableAutomationRuleColumns = map[string]bool{
		"name":       true,
		"trigger":    true,
		"condition":  true,
		"action":     true,
		"enabled":    true,
		"updated_at": true,
	}
	// writableSLATrackingColumns guards UpdateSLATracking, which used to splice
	// every key of its map straight into the SET clause. ticket_sla_tracking has
	// no tenant_id and its primary key is id, so this table is keyed by
	// ticket_id and the allow list keeps id and ticket_id out of reach too.
	writableSLATrackingColumns = map[string]bool{
		"priority":                  true,
		"target_resolution_time_ms": true,
		"actual_resolution_time_ms": true,
		"breached":                  true,
		"breached_at":               true,
		"resolved_at":               true,
		"first_response_at":         true,
		"response_breached":         true,
		"updated_at":                true,
	}
)

// updateRows runs the shared "UPDATE <table> SET ... WHERE <where>" used by
// UpdateTicket, UpdateSLAPolicy, UpdateAutomationRule and UpdateSLATracking.
// The WHERE clause and its bound arguments are passed in rather than assumed,
// because ticket_sla_tracking is keyed by ticket_id and carries no tenant_id,
// so it cannot reuse the id/tenant_id predicate the other three take.
// buildSetClause keeps the placeholders deterministic (keys sorted) and
// rejects unknown keys.
func (r *Repository) updateRows(ctx context.Context, table, where string, allow map[string]bool, whereArgs []interface{}, updates map[string]interface{}) error {
	set, args, err := buildSetClause(allow, whereArgs, updates)
	if err != nil {
		return err
	}
	if set == "" {
		// Nothing writable was supplied: issuing the statement would either
		// produce an empty SET or write only updated_at.
		return nil
	}
	_, err = r.db.ExecContext(ctx, "UPDATE "+table+" SET "+set+" WHERE "+where, args...)
	return err
}

// buildSetClause sorts the map keys so the placeholder numbering is stable and
// refuses a key the allow list does not carry. The WHERE clause binds to
// $1..$len(whereArgs) and the first SET argument is the next number, so the
// caller cannot get the numbering wrong by construction. That is the off-by-one
// UpdateSLATracking used to get wrong, which emitted "breached=$\x02" because
// the index was formatted as a rune instead of a digit.
func buildSetClause(allow map[string]bool, whereArgs []interface{}, updates map[string]interface{}) (string, []interface{}, error) {
	if len(updates) == 0 {
		return "", nil, nil
	}
	keys := make([]string, 0, len(updates))
	for k := range updates {
		if !allow[k] {
			return "", nil, fmt.Errorf("update: %q is not a writable column", k)
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	args := append([]interface{}(nil), whereArgs...)
	set := make([]string, 0, len(keys)+1)
	for _, k := range keys {
		if k == "updated_at" {
			// Taken by the NOW() clause; a caller value would either duplicate
			// it or lose to it. An updated_at-only map must still emit a
			// well-formed statement rather than a no-op, so this branch cannot
			// return an empty SET.
			continue
		}
		set = append(set, fmt.Sprintf("%s=$%d", k, len(args)+1))
		args = append(args, updates[k])
	}
	set = append(set, "updated_at=NOW()")
	return joinSQL(set, ", "), args, nil
}

func (r *Repository) UpdateTicket(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return r.updateRows(ctx, "tickets", "id=$1 AND tenant_id=$2", writableTicketColumns, []interface{}{id, tenantID}, updates)
}

func (r *Repository) DeleteTicket(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM tickets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdateTicketStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tickets SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) AssignTicket(ctx context.Context, tenantID, id string, assigneeID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tickets SET assignee_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, assigneeID, id, tenantID)
	return err
}

func (r *Repository) CountTickets(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM tickets WHERE tenant_id=$1`, tenantID)
	return count, err
}

// --- Workflow History ---

func (r *Repository) AddWorkflowHistory(ctx context.Context, tenantID, ticketID, action, fromState, toState, userID, comment string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ticket_workflow_history (id, tenant_id, ticket_id, action, from_state, to_state, user_id, comment, created_at)
		 VALUES (:id, :tenant_id, :ticket_id, :action, :from_state, :to_state, :user_id, :comment, :created_at)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"tenant_id":  tenantID,
			"ticket_id":  ticketID,
			"action":     action,
			"from_state": fromState,
			"to_state":   toState,
			"user_id":    userID,
			"comment":    comment,
			"created_at": time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error) {
	// Explicit columns, not SELECT *: sqlx runs in safe mode, and 571 / 572 add
	// deleted_at, created_by, updated_by and updated_at to this table. A SELECT *
	// would hand back columns WorkflowHistoryEntry has no destination for and fail
	// every read, even though the service never needs them.
	var items []models.WorkflowHistoryEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, ticket_id, action, from_state, to_state, user_id, comment, created_at
		 FROM ticket_workflow_history WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at`, tenantID, ticketID)
	return items, err
}

// --- Assignment Rules ---

func (r *Repository) CreateAssignmentRule(ctx context.Context, tenantID string, req models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error) {
	now := time.Now().UTC()
	var ar models.AssignmentRule
	err := r.db.GetContext(ctx, &ar,
		`INSERT INTO ticketing_assignment_rules (tenant_id, name, conditions, action, target_id, enabled, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
		tenantID, req.Name, req.Conditions, req.Action, req.TargetID, true, now)
	if err != nil {
		return nil, err
	}
	ar.Name = req.Name
	ar.Conditions = req.Conditions
	ar.Action = req.Action
	ar.TargetID = req.TargetID
	ar.Enabled = true
	return &ar, nil
}

func (r *Repository) ListAssignmentRules(ctx context.Context, tenantID string) ([]models.AssignmentRule, error) {
	var items []models.AssignmentRule
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+assignmentRuleColumns+" FROM ticketing_assignment_rules WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) DeleteAssignmentRule(ctx context.Context, tenantID string, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ticketing_assignment_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Relations ---

func (r *Repository) AddRelation(ctx context.Context, tenantID, ticketID, relatedID, relType string) (*models.TicketRelation, error) {
	var tr models.TicketRelation
	err := r.db.GetContext(ctx, &tr,
		`INSERT INTO ticket_relations (id, tenant_id, ticket_id, related_id, type, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		uuid.New().String(), tenantID, ticketID, relatedID, relType, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	tr.TenantID = tenantID
	tr.TicketID = ticketID
	tr.RelatedID = relatedID
	tr.Type = relType
	return &tr, nil
}

func (r *Repository) GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	var items []models.TicketRelation
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+relationColumns+" FROM ticket_relations WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at", tenantID, ticketID)
	return items, err
}

func (r *Repository) FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	var items []models.TicketRelation
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+relationColumns+" FROM ticket_relations WHERE tenant_id=$1 AND (ticket_id=$2 OR related_id=$2) ORDER BY created_at", tenantID, ticketID)
	return items, err
}

func (r *Repository) DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	var items []models.TicketRelation
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+relationColumns+" FROM ticket_relations WHERE tenant_id=$1 AND ticket_id=$2 AND type='duplicate'", tenantID, ticketID)
	return items, err
}

// --- SLA Targets ---

func (r *Repository) CreateSLATarget(ctx context.Context, tenantID string, req models.CreateSLATargetRequest) (*models.SLATarget, error) {
	now := time.Now().UTC()
	var st models.SLATarget
	err := r.db.GetContext(ctx, &st,
		`INSERT INTO ticketing_sla_targets (tenant_id, priority, response_hours, resolve_hours, enabled, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
		tenantID, req.Priority, req.ResponseHrs, req.ResolveHrs, true, now)
	if err != nil {
		return nil, err
	}
	st.TenantID = tenantID
	st.Priority = req.Priority
	st.ResponseH = req.ResponseHrs
	st.ResolveH = req.ResolveHrs
	st.Enabled = true
	return &st, nil
}

func (r *Repository) GetSLATarget(ctx context.Context, tenantID, priority string) (*models.SLATarget, error) {
	var st models.SLATarget
	err := r.db.GetContext(ctx, &st,
		"SELECT "+slaTargetColumns+" FROM ticketing_sla_targets WHERE tenant_id=$1 AND priority=$2 AND enabled=true", tenantID, priority)
	return &st, err
}

// --- SLA Policies ---

func (r *Repository) CreateSLAPolicy(ctx context.Context, tenantID string, req models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	now := time.Now().UTC()
	var p models.SLAPolicy
	err := r.db.GetContext(ctx, &p,
		`INSERT INTO ticketing_sla_policies (tenant_id, name, priority, response_hours, resolve_hours, active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at`,
		tenantID, req.Name, req.Priority, req.ResponseH, req.ResolveH, true, now, now)
	if err != nil {
		return nil, err
	}
	p.TenantID = tenantID
	p.Name = req.Name
	p.Priority = req.Priority
	p.ResponseH = req.ResponseH
	p.ResolveH = req.ResolveH
	p.Active = true
	return &p, nil
}

func (r *Repository) ListSLAPolicies(ctx context.Context, tenantID string) ([]models.SLAPolicy, error) {
	var items []models.SLAPolicy
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+slaPolicyColumns+" FROM ticketing_sla_policies WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) GetSLAPolicy(ctx context.Context, tenantID string, policyID string) (*models.SLAPolicy, error) {
	var p models.SLAPolicy
	err := r.db.GetContext(ctx, &p,
		"SELECT "+slaPolicyColumns+" FROM ticketing_sla_policies WHERE id=$1 AND tenant_id=$2", policyID, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateSLAPolicy used to receive the whole map and write only updated_at, so
// PUT /tickets/sla/policies/:policyId silently discarded name, priority,
// response_hours, resolve_hours and active.
func (r *Repository) UpdateSLAPolicy(ctx context.Context, tenantID string, policyID string, updates map[string]interface{}) error {
	return r.updateRows(ctx, "ticketing_sla_policies", "id=$1 AND tenant_id=$2", writableSLAPolicyColumns, []interface{}{policyID, tenantID}, updates)
}

func (r *Repository) DeleteSLAPolicy(ctx context.Context, tenantID string, policyID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ticketing_sla_policies WHERE id=$1 AND tenant_id=$2`, policyID, tenantID)
	return err
}

func (r *Repository) GetSLABreaches(ctx context.Context, tenantID string) ([]models.SLABreach, error) {
	// 655_create_ticketing_missing_tables.sql gives ticketing_sla_breaches no
	// tenant_id column, so the tenant filter that used to live here was a Postgres
	// "column does not exist" on every call. The parameter is kept so the method
	// still satisfies RepositoryInterface.
	var items []models.SLABreach
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+slaBreachColumns+" FROM ticketing_sla_breaches ORDER BY breached_at DESC")
	return items, err
}

func (r *Repository) GetSLACompliance(ctx context.Context, tenantID string, policyID string) (*models.ComplianceResult, error) {
	var cr models.ComplianceResult
	err := r.db.GetContext(ctx, &cr,
		`SELECT COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS compliant, COUNT(*) AS total FROM tickets WHERE tenant_id=$1 AND sla_policy_id=$2`, tenantID, policyID)
	if err != nil {
		return nil, err
	}
	if cr.Total > 0 {
		cr.Compliance = float64(cr.Compliant) / float64(cr.Total)
	}
	cr.Breached = cr.Total - cr.Compliant
	cr.PolicyID = policyID
	return &cr, nil
}

// --- Automation Rules ---

func (r *Repository) CreateAutomationRule(ctx context.Context, tenantID string, req models.CreateAutomationRuleRequest) (*models.AutomationRule, error) {
	now := time.Now().UTC()
	var ar models.AutomationRule
	err := r.db.GetContext(ctx, &ar,
		`INSERT INTO ticketing_automation_rules (tenant_id, name, trigger, condition, action, enabled, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at`,
		tenantID, req.Name, req.Trigger, req.Condition, req.Action, true, now, now)
	if err != nil {
		return nil, err
	}
	ar.TenantID = tenantID
	ar.Name = req.Name
	ar.Trigger = req.Trigger
	ar.Condition = req.Condition
	ar.Action = req.Action
	ar.Enabled = true
	return &ar, nil
}

func (r *Repository) ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error) {
	var items []models.AutomationRule
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+automationRuleColumns+" FROM ticketing_automation_rules WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return items, err
}

// UpdateAutomationRule used to receive the whole map and write only updated_at,
// so PUT /tickets/automation/rules/:ruleId silently discarded name, trigger,
// condition, action and enabled.
func (r *Repository) UpdateAutomationRule(ctx context.Context, tenantID string, ruleID string, updates map[string]interface{}) error {
	return r.updateRows(ctx, "ticketing_automation_rules", "id=$1 AND tenant_id=$2", writableAutomationRuleColumns, []interface{}{ruleID, tenantID}, updates)
}

func (r *Repository) DeleteAutomationRule(ctx context.Context, tenantID string, ruleID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ticketing_automation_rules WHERE id=$1 AND tenant_id=$2`, ruleID, tenantID)
	return err
}

// --- Dispatch Engineers ---

func (r *Repository) RegisterEngineer(ctx context.Context, tenantID string, req models.RegisterEngineerRequest) (*models.DispatchEngineer, error) {
	now := time.Now().UTC()
	var e models.DispatchEngineer
	err := r.db.GetContext(ctx, &e,
		`INSERT INTO ticketing_dispatch_engineers (id, tenant_id, user_id, name, skills, max_tickets, is_active, current_load, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, created_at, updated_at`,
		uuid.New().String(), tenantID, req.UserID, req.Name, req.Skills, req.MaxTickets, true, 0, now, now)
	if err != nil {
		return nil, err
	}
	e.TenantID = tenantID
	e.UserID = req.UserID
	e.Name = req.Name
	e.Skills = req.Skills
	e.MaxTickets = req.MaxTickets
	e.IsActive = true
	return &e, nil
}

func (r *Repository) ListEngineers(ctx context.Context, tenantID string) ([]models.DispatchEngineer, error) {
	var items []models.DispatchEngineer
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+dispatchEngineerColumns+" FROM ticketing_dispatch_engineers WHERE tenant_id=$1 ORDER BY name", tenantID)
	return items, err
}

func (r *Repository) GetEngineer(ctx context.Context, tenantID, id string) (*models.DispatchEngineer, error) {
	var e models.DispatchEngineer
	err := r.db.GetContext(ctx, &e,
		"SELECT "+dispatchEngineerColumns+" FROM ticketing_dispatch_engineers WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// --- Dispatch Rules ---

func (r *Repository) AddDispatchRule(ctx context.Context, tenantID string, req models.AddDispatchRuleRequest) (*models.DispatchRule, error) {
	now := time.Now().UTC()
	var dr models.DispatchRule
	err := r.db.GetContext(ctx, &dr,
		`INSERT INTO ticketing_dispatch_rules (tenant_id, name, conditions, strategy, weight, enabled, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
		tenantID, req.Name, req.Conditions, req.Strategy, req.Weight, true, now)
	if err != nil {
		return nil, err
	}
	dr.TenantID = tenantID
	dr.Name = req.Name
	dr.Conditions = req.Conditions
	dr.Strategy = req.Strategy
	dr.Weight = req.Weight
	dr.Enabled = true
	return &dr, nil
}

func (r *Repository) ListDispatchRules(ctx context.Context, tenantID string) ([]models.DispatchRule, error) {
	var items []models.DispatchRule
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+dispatchRuleColumns+" FROM ticketing_dispatch_rules WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return items, err
}

// --- Dispatch Weights ---

func (r *Repository) UpdateDispatchWeights(ctx context.Context, tenantID string, weights map[string]int) error {
	// Upsert weights for each engineer
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for engineerID, weight := range weights {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO ticketing_dispatch_weights (id, tenant_id, engineer_id, weight, updated_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (tenant_id, engineer_id) DO UPDATE SET weight=$4, updated_at=$5`,
			uuid.New().String(), tenantID, engineerID, weight, time.Now().UTC())
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetDispatchWeights(ctx context.Context, tenantID string) (map[string]int, error) {
	weights := make(map[string]int)
	var rows []struct {
		EngineerID string `db:"engineer_id"`
		Weight     int    `db:"weight"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT engineer_id, weight FROM ticketing_dispatch_weights WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		weights[r.EngineerID] = r.Weight
	}
	return weights, nil
}

// --- Dispatch Queue ---

func (r *Repository) GetDispatchQueueStatus(ctx context.Context, tenantID string) (*models.QueueStatus, error) {
	var qs models.QueueStatus
	err := r.db.GetContext(ctx, &qs,
		`SELECT COUNT(*) FILTER (WHERE assignee_id IS NULL) AS pending, COUNT(*) FILTER (WHERE assignee_id IS NOT NULL) AS assigned, COUNT(*) AS total FROM tickets WHERE tenant_id=$1 AND status NOT IN ('closed','resolved')`, tenantID)
	if err != nil {
		return nil, err
	}
	return &qs, nil
}

func (r *Repository) GetDispatchQueueEntries(ctx context.Context, tenantID string) ([]models.QueueEntry, error) {
	// models.QueueEntry carries no db tags, and sqlx's identity mapper lowercases
	// the field name: TicketID becomes "ticketid", so the aliased "ticket_id" had
	// no destination and the whole list failed. The projection therefore scans
	// into a tagged row type and copies across.
	//
	// The age is cast to double precision: EXTRACT(EPOCH ...) returns numeric,
	// which lib/pq hands back as []byte unless the value is a plain integer, and
	// []byte does not scan into float64.
	var rows []struct {
		TicketID string  `db:"ticket_id"`
		Priority string  `db:"priority"`
		Age      float64 `db:"age_hours"`
		Assigned bool    `db:"assigned"`
		Engineer *string `db:"engineer"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id AS ticket_id, priority, CAST(EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS double precision) AS age_hours, CASE WHEN assignee_id IS NOT NULL THEN true ELSE false END AS assigned, assignee_id AS engineer FROM tickets WHERE tenant_id=$1 AND status NOT IN ('closed','resolved') ORDER BY priority`, tenantID)
	if err != nil {
		return nil, err
	}
	items := make([]models.QueueEntry, 0, len(rows))
	for _, row := range rows {
		items = append(items, models.QueueEntry{TicketID: row.TicketID, Priority: row.Priority, Age: row.Age, Assigned: row.Assigned, Engineer: row.Engineer})
	}
	return items, nil
}

// --- Transfer ---

func (r *Repository) TransferTicket(ctx context.Context, tenantID, ticketID, fromUserID, toUserID, reason string) error {
	now := time.Now().UTC()
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx,
		`UPDATE tickets SET assignee_id=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, toUserID, now, ticketID, tenantID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO ticket_transfer_history (id, tenant_id, ticket_id, from_user_id, to_user_id, reason, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), tenantID, ticketID, fromUserID, toUserID, reason, now)
	return tx.Commit()
}

func (r *Repository) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	var items []models.TransferHistoryEntry
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+transferHistoryColumns+" FROM ticket_transfer_history WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at DESC", tenantID, ticketID)
	return items, err
}

func (r *Repository) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	var ts models.TransferStats
	err := r.db.GetContext(ctx, &ts,
		`SELECT COUNT(*) AS total_transfers FROM ticket_transfer_history WHERE tenant_id=$1`, tenantID)
	return &ts, err
}

// --- Suspend ---

func (r *Repository) CreateSuspend(ctx context.Context, tenantID string, req models.CreateSuspendRequest) (*models.Suspend, error) {
	now := time.Now().UTC()
	var s models.Suspend
	err := r.db.GetContext(ctx, &s,
		`INSERT INTO ticketing_suspensions (id, tenant_id, engineer_id, reason, type, start_at, end_at, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
		uuid.New().String(), tenantID, req.EngineerID, req.Reason, req.Type, now, nil, "active", now)
	if err != nil {
		return nil, err
	}
	s.TenantID = tenantID
	s.EngineerID = req.EngineerID
	s.Reason = req.Reason
	s.Type = req.Type
	s.StartAt = now
	s.Status = "active"
	return &s, nil
}

func (r *Repository) ListSuspensions(ctx context.Context, tenantID string) ([]models.Suspend, error) {
	var items []models.Suspend
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+suspendColumns+" FROM ticketing_suspensions WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) GetSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	var s models.Suspend
	err := r.db.GetContext(ctx, &s,
		"SELECT "+suspendColumns+" FROM ticketing_suspensions WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateSuspendStatus(ctx context.Context, tenantID, id string, status string) error {
	// ticketing_suspensions has no updated_at column, so the NOW() clause that
	// used to sit next to status=$1 made every suspend-state change a Postgres
	// "column does not exist". The table carries created_at only.
	_, err := r.db.ExecContext(ctx,
		`UPDATE ticketing_suspensions SET status=$1 WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) GetEngineerSuspensions(ctx context.Context, tenantID, engineerID string) ([]models.Suspend, error) {
	var items []models.Suspend
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+suspendColumns+" FROM ticketing_suspensions WHERE tenant_id=$1 AND engineer_id=$2 ORDER BY created_at DESC", tenantID, engineerID)
	return items, err
}

func (r *Repository) GetEngineerSuspendImpact(ctx context.Context, tenantID, engineerID string) (*models.EngineerSuspendImpact, error) {
	var impact models.EngineerSuspendImpact
	err := r.db.GetContext(ctx, &impact,
		`SELECT engineer_id FROM ticketing_suspensions WHERE tenant_id=$1 AND engineer_id=$2 LIMIT 1`, tenantID, engineerID)
	if err != nil {
		return nil, err
	}
	impact.EngineerID = engineerID
	return &impact, nil
}

// --- Service Control ---

func (r *Repository) IsServiceActive(ctx context.Context, tenantID string) (bool, error) {
	var active bool
	err := r.db.GetContext(ctx, &active,
		`SELECT COALESCE(active, false) FROM ticketing_service_state WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return false, err
	}
	return active, nil
}

func (r *Repository) SetServiceActive(ctx context.Context, tenantID string, active bool) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ticketing_service_state (tenant_id, active, updated_at) VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id) DO UPDATE SET active=$2, updated_at=$3`, tenantID, active, time.Now().UTC())
	return err
}

// --- Ticket SLA Tracking ---

// TicketSLATracking maps the ticket_sla_tracking row.
type TicketSLATracking struct {
	ID                     string     `db:"id"`
	TicketID               string     `db:"ticket_id"`
	Priority               string     `db:"priority"`
	TargetResolutionTimeMs int64      `db:"target_resolution_time_ms"`
	ActualResolutionTimeMs *int64     `db:"actual_resolution_time_ms"`
	Breached               bool       `db:"breached"`
	BreachedAt             *time.Time `db:"breached_at"`
	ResolvedAt             *time.Time `db:"resolved_at"`
	FirstResponseAt        *time.Time `db:"first_response_at"`
	ResponseBreached       bool       `db:"response_breached"`
	CreatedAt              time.Time  `db:"created_at"`
	UpdatedAt              time.Time  `db:"updated_at"`
}

// UpsertSLATracking creates or updates the SLA tracking row for a ticket.
func (r *Repository) UpsertSLATracking(ctx context.Context, tenantID, ticketID, priority string, targetResolutionMs int64) (*TicketSLATracking, error) {
	var t TicketSLATracking
	now := time.Now().UTC()
	err := r.db.GetContext(ctx, &t,
		`INSERT INTO ticket_sla_tracking (id, ticket_id, priority, target_resolution_time_ms, breached, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (ticket_id) DO UPDATE SET updated_at=$7 RETURNING `+slaTrackingColumns,
		uuid.New().String(), ticketID, priority, targetResolutionMs, false, now, now)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetSLATracking returns the SLA tracking row for a ticket.
func (r *Repository) GetSLATracking(ctx context.Context, tenantID, ticketID string) (*TicketSLATracking, error) {
	var t TicketSLATracking
	err := r.db.GetContext(ctx, &t,
		"SELECT "+slaTrackingColumns+" FROM ticket_sla_tracking WHERE ticket_id=$1", ticketID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// UpdateSLATracking updates a subset of SLA tracking fields. It used to splice
// every caller-supplied map key straight into the SET clause with no allow list,
// so a mistyped key became part of the SQL string. The placeholder numbering was
// also hand computed as i+2, which an earlier revision derived from a rune and
// therefore rendered as "breached=$\x02" instead of "breached=$2" - every
// workflow transition that touched SLA tracking answered a Postgres syntax
// error. Both shapes are closed by construction now: buildSetClause rejects a
// key writableSLATrackingColumns does not carry, and the first SET placeholder
// is len(whereArgs)+1.
func (r *Repository) UpdateSLATracking(ctx context.Context, ticketID string, updates map[string]interface{}) error {
	return r.updateRows(ctx, "ticket_sla_tracking", "ticket_id=$1",
		writableSLATrackingColumns, []interface{}{ticketID}, updates)
}

// RecordSLABreach records a SLA breach for a ticket.
func (r *Repository) RecordSLABreach(ctx context.Context, tenantID, ticketID, policyID, btype string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ticket_sla_breaches (id, tenant_id, ticket_id, policy_id, type, breached_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), tenantID, ticketID, policyID, btype, time.Now().UTC())
	return err
}

// --- Ticket Assignments ---

func (r *Repository) CreateAssignment(ctx context.Context, tenantID, ticketID, assignee, assignedBy, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ticket_assignments (id, tenant_id, ticket_id, assignee, assigned_by, reason, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), tenantID, ticketID, assignee, assignedBy, reason, time.Now().UTC())
	return err
}

func (r *Repository) GetAssignmentsByTicket(ctx context.Context, tenantID, ticketID string) ([]struct {
	ID         string    `db:"id"`
	TicketID   string    `db:"ticket_id"`
	Assignee   string    `db:"assignee"`
	AssignedBy string    `db:"assigned_by"`
	Reason     string    `db:"reason"`
	CreatedAt  time.Time `db:"created_at"`
}, error) {
	var rows []struct {
		ID         string    `db:"id"`
		TenantID   string    `db:"tenant_id"`
		TicketID   string    `db:"ticket_id"`
		Assignee   string    `db:"assignee"`
		AssignedBy string    `db:"assigned_by"`
		Reason     string    `db:"reason"`
		CreatedAt  time.Time `db:"created_at"`
	}
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+assignmentColumns+" FROM ticket_assignments WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at DESC",
		tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	results := make([]struct {
		ID         string    `db:"id"`
		TicketID   string    `db:"ticket_id"`
		Assignee   string    `db:"assignee"`
		AssignedBy string    `db:"assigned_by"`
		Reason     string    `db:"reason"`
		CreatedAt  time.Time `db:"created_at"`
	}, len(rows))
	for i, r := range rows {
		results[i] = struct {
			ID         string    `db:"id"`
			TicketID   string    `db:"ticket_id"`
			Assignee   string    `db:"assignee"`
			AssignedBy string    `db:"assigned_by"`
			Reason     string    `db:"reason"`
			CreatedAt  time.Time `db:"created_at"`
		}{
			ID:         r.ID,
			TicketID:   r.TicketID,
			Assignee:   r.Assignee,
			AssignedBy: r.AssignedBy,
			Reason:     r.Reason,
			CreatedAt:  r.CreatedAt,
		}
	}
	return results, nil
}

// --- Count by status ---

// CountTicketsByStatus returns counts per status for a tenant.
func (r *Repository) CountTicketsByStatus(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) AS cnt FROM tickets WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]int)
	for rows.Next() {
		var status string
		var cnt int
		if err := rows.Scan(&status, &cnt); err != nil {
			return nil, err
		}
		out[status] = cnt
	}
	return out, nil
}

// CountTicketsByPriority returns counts per priority for a tenant.
func (r *Repository) CountTicketsByPriority(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT priority, COUNT(*) AS cnt FROM tickets WHERE tenant_id=$1 GROUP BY priority`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]int)
	for rows.Next() {
		var p string
		var cnt int
		if err := rows.Scan(&p, &cnt); err != nil {
			return nil, err
		}
		out[p] = cnt
	}
	return out, nil
}

// CountTicketsByCategory returns counts per category for a tenant.
func (r *Repository) CountTicketsByCategory(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT category, COUNT(*) AS cnt FROM tickets WHERE tenant_id=$1 GROUP BY category`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]int)
	for rows.Next() {
		var cat string
		var cnt int
		if err := rows.Scan(&cat, &cnt); err != nil {
			return nil, err
		}
		out[cat] = cnt
	}
	return out, nil
}

// --- Helpers ---

func joinSQL(clauses []string, sep string) string {
	result := ""
	for i, c := range clauses {
		if i > 0 {
			result += sep + " "
		}
		result += c
	}
	return result
}
