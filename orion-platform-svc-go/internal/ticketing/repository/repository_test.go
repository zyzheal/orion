package repository

import (
	"context"
	"database/sql/driver"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/ticketing/models"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_NewRepository_ReturnsNonNil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("repo should never be nil")
	}
}

func Test_JoinSQL_Empty(t *testing.T) {
	result := joinSQL(nil, " AND ")
	if result != "" {
		t.Fatalf("joinSQL(nil, ...) = %q, want empty", result)
	}
}

func Test_JoinSQL_SingleClause(t *testing.T) {
	clauses := []string{"a = $1"}
	result := joinSQL(clauses, " AND ")
	if result != "a = $1" {
		t.Fatalf("joinSQL = %q, want 'a = $1'", result)
	}
}

func Test_JoinSQL_MultipleClauses(t *testing.T) {
	clauses := []string{"a = $1", "b = $2", "c = $3"}
	result := joinSQL(clauses, " AND ")
	want := "a = $1 AND  b = $2 AND  c = $3"
	if result != want {
		t.Fatalf("joinSQL = %q, want %q", result, want)
	}
}

func Test_JoinSQL_CommaSeparator(t *testing.T) {
	clauses := []string{"col1 = $1", "col2 = $2"}
	result := joinSQL(clauses, ",")
	want := "col1 = $1, col2 = $2"
	if result != want {
		t.Fatalf("joinSQL = %q, want %q", result, want)
	}
}

func Test_JoinSQL_PreservesClauseContent(t *testing.T) {
	clauses := []string{"tenant_id = $1", "status = $2"}
	result := joinSQL(clauses, " AND ")
	want := "tenant_id = $1 AND  status = $2"
	if result != want {
		t.Fatalf("joinSQL = %q, want %q", result, want)
	}
}

func Test_TicketSLATracking_Type(t *testing.T) {
	tr := TicketSLATracking{
		ID:                     "test-id",
		TicketID:               "ticket-1",
		Priority:               "high",
		TargetResolutionTimeMs: 3600000,
		Breached:               true,
		ResponseBreached:       false,
	}
	if tr.ID != "test-id" {
		t.Fatalf("ID = %q", tr.ID)
	}
	if tr.TicketID != "ticket-1" {
		t.Fatalf("TicketID = %q", tr.TicketID)
	}
	if tr.Priority != "high" {
		t.Fatalf("Priority = %q", tr.Priority)
	}
	if !tr.Breached {
		t.Fatal("Breached should be true")
	}
}

func Test_TicketSLATracking_NullPointers(t *testing.T) {
	tr := TicketSLATracking{
		ID:       "test-id",
		TicketID: "ticket-1",
		Priority: "low",
		Breached: false,
	}
	if tr.ActualResolutionTimeMs != nil {
		t.Fatal("ActualResolutionTimeMs should be nil")
	}
	if tr.BreachedAt != nil {
		t.Fatal("BreachedAt should be nil")
	}
	if tr.ResolvedAt != nil {
		t.Fatal("ResolvedAt should be nil")
	}
	if tr.FirstResponseAt != nil {
		t.Fatal("FirstResponseAt should be nil")
	}
}

func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return NewRepository(sqlx.NewDb(db, "postgres")), mock
}

func ticketPtr(s string) *string { return &s }

// TestListTicketsBuildsEveryPositionalPlaceholder pins the generated query text
// and the number bound to each position. The old code numbered LIMIT and OFFSET
// with string(rune(len(args)+'1')) and string(rune(len(args)+2)) — char
// arithmetic that only produced digits because '1' and '2' happen to add the
// right offset — and it also built a `placeholders` slice with
// string(rune(i+1)), which emitted U+0001, U+0002, ... rather than digits and
// was never read at all. The five-filter arm matters: it is the only one where
// LIMIT and OFFSET land on $7 and $8, the largest positions reachable.
//
// The expectations also pin the explicit column list. This method used to run
// SELECT *, which fails in sqlx safe mode because 571 / 572 add deleted_at,
// created_by and updated_by to tickets and models.Ticket has no destination for
// any of them.
func TestListTicketsBuildsEveryPositionalPlaceholder(t *testing.T) {
	cases := []struct {
		name string
		q    models.TicketListQuery
		want string
		args []driver.Value
	}{
		{
			"no filter, default limit",
			models.TicketListQuery{},
			`SELECT id, tenant_id, title, COALESCE\(description, ''\) AS description, COALESCE\(category, ''\) AS category, priority, status, assignee_id, reporter_id, COALESCE\(source, ''\) AS source, source_id, resolved_at, closed_at, created_at, updated_at FROM tickets WHERE tenant_id = \$1 ORDER BY created_at DESC LIMIT \$2 OFFSET \$3`,
			[]driver.Value{"t1", 50, 0},
		},
		{
			"status and priority",
			models.TicketListQuery{Status: ticketPtr("open"), Priority: ticketPtr("high")},
			`SELECT id, tenant_id, title, COALESCE\(description, ''\) AS description, COALESCE\(category, ''\) AS category, priority, status, assignee_id, reporter_id, COALESCE\(source, ''\) AS source, source_id, resolved_at, closed_at, created_at, updated_at FROM tickets WHERE tenant_id = \$1 AND  status = \$2 AND  priority = \$3 ORDER BY created_at DESC LIMIT \$4 OFFSET \$5`,
			[]driver.Value{"t1", "open", "high", 50, 0},
		},
		{
			"all five filters",
			models.TicketListQuery{
				Status: ticketPtr("open"), Priority: ticketPtr("high"), Assignee: ticketPtr("u1"),
				Category: ticketPtr("cat"), Search: ticketPtr("search"),
			},
			`SELECT id, tenant_id, title, COALESCE\(description, ''\) AS description, COALESCE\(category, ''\) AS category, priority, status, assignee_id, reporter_id, COALESCE\(source, ''\) AS source, source_id, resolved_at, closed_at, created_at, updated_at FROM tickets WHERE tenant_id = \$1 AND  status = \$2 AND  priority = \$3 AND  assignee_id = \$4 AND  category = \$5 AND  \(title ILIKE \$6 OR description ILIKE \$6\) ORDER BY created_at DESC LIMIT \$7 OFFSET \$8`,
			[]driver.Value{"t1", "open", "high", "u1", "cat", "%search%", 50, 0},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo, mock := newMockRepo(t)
			mock.ExpectQuery(tc.want).WithArgs(tc.args...).WillReturnRows(sqlmock.NewRows([]string{"id"}))

			items, err := repo.ListTickets(context.Background(), "t1", tc.q)
			if err != nil {
				t.Fatalf("ListTickets(%s) returned an error: %v", tc.name, err)
			}
			if len(items) != 0 {
				t.Errorf("ListTickets(%s) returned %d rows, want 0", tc.name, len(items))
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet expectations: %v", err)
			}
		})
	}
}

// TestListTicketsHonoursExplicitLimitAndOffset pins that a caller's limit and
// offset reach the two trailing positions instead of being replaced by the
// default of 50.
func TestListTicketsHonoursExplicitLimitAndOffset(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`OFFSET \$3`).WithArgs("t1", 7, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	items, err := repo.ListTickets(context.Background(), "t1", models.TicketListQuery{Limit: 7, Offset: 20})
	if err != nil {
		t.Fatalf("ListTickets returned an error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("ListTickets returned %d rows, want 0", len(items))
	}
}

// TestUpdateSLATrackingNumbersTheSetArguments pins the placeholder numbering in
// the generated SET clause. The old code did k+"=$"+string(rune(i+2)), which
// emitted U+0002 (STX) instead of the digit "2", so the statement read
// "SET breached=$\x02,  updated_at=$\x03" — a Postgres syntax error on every
// SLA update. ticket_workflow.go and sla.go call this on every workflow
// transition, so the failure was live. ticket_id takes $1, so the first SET
// argument must be $2. The map key order is random, so the expectation accepts
// either ordering of the two columns.
func TestUpdateSLATrackingNumbersTheSetArguments(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`UPDATE ticket_sla_tracking SET (breached=\$2,  updated_at=\$3|updated_at=\$2,  breached=\$3) WHERE ticket_id=\$1`).
		WithArgs("t-1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateSLATracking(context.Background(), "t-1", map[string]interface{}{"breached": false})
	if err != nil {
		t.Fatalf("UpdateSLATracking returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestTheRuneIndexEmitsControlBytesIsThePositiveControl proves the failure
// mechanism the fixes above rely on. Those tests only mean anything if the rune
// form really does produce something other than a digit: if string(rune(2)) had
// produced "$2", the rewrite to fmt.Sprintf would have been vacuous.
func TestTheRuneIndexEmitsControlBytesIsThePositiveControl(t *testing.T) {
	if got := "$" + string(rune(2)); !strings.Contains(got, "\x02") {
		t.Fatalf("string(rune(2)) = %q, want it to contain the U+0002 control byte", got)
	}
	if got := "$" + string(rune('0'+2)); got != "$2" {
		t.Fatalf("string(rune('0'+2)) = %q, want $2", got)
	}
}

// TestUpdateTicketAppliesEverySuppliedColumn pins that the whole updates map
// reaches the SET clause. This method used to receive the map and run
// `UPDATE tickets SET updated_at = NOW() ...` regardless, so POST /tickets/:id/
// transition, assign, escalate, resolve and close each wrote only updated_at
// and reported success: every ticket state change was silently discarded while
// the workflow history row claimed it had happened. The keys are sorted before
// the placeholders are numbered, so the expected string is deterministic
// without needing a regexp.
func TestUpdateTicketAppliesEverySuppliedColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	// AssignTicket passes exactly these three keys, plus resolved_at in the
	// resolve path.
	updates := map[string]interface{}{
		"status":      "assigned",
		"assignee_id": "u-9",
		"resolved_at": time.Unix(1750000000, 0).UTC(),
	}
	mock.ExpectExec(
		`UPDATE tickets SET assignee_id=\$3, resolved_at=\$4, status=\$5, updated_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("tk-1", "t1", "u-9", updates["resolved_at"], "assigned").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateTicket(context.Background(), "t1", "tk-1", updates); err != nil {
		t.Fatalf("UpdateTicket returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestUpdateTicketRejectsAColumn076DoesNotHave proves the allow list blocks both
// a column that does not exist in 076_create_ticketing_tables.sql and a
// read-only column the service must not overwrite. Silent acceptance would let a
// typo silently rebuild the original no-op behaviour.
func TestUpdateTicketRejectsAColumn076DoesNotHave(t *testing.T) {
	repo, mock := newMockRepo(t)
	for _, key := range []string{"does_not_exist", "tenant_id", "id", "created_at", "metadata", "type", "assigned_to"} {
		err := repo.UpdateTicket(context.Background(), "t1", "tk-1", map[string]interface{}{key: "v"})
		if err == nil {
			t.Errorf("UpdateTicket accepted %q, want an error", key)
			continue
		}
		if !strings.Contains(err.Error(), key) {
			t.Errorf("UpdateTicket(%q) error %q does not name the offending key", key, err)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestUpdateTicketEmptyMapSkipsTheQuery proves the guard: an empty map would
// otherwise produce "UPDATE tickets SET  updated_at=NOW()", and a map containing
// only updated_at still has to emit a well-formed statement.
func TestUpdateTicketEmptyMapSkipsTheQuery(t *testing.T) {
	repo, mock := newMockRepo(t)
	if err := repo.UpdateTicket(context.Background(), "t1", "tk-1", map[string]interface{}{}); err != nil {
		t.Fatalf("UpdateTicket({}) returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty map must not issue a query: %v", err)
	}

	repo2, mock2 := newMockRepo(t)
	mock2.ExpectExec(
		`UPDATE tickets SET updated_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("tk-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo2.UpdateTicket(context.Background(), "t1", "tk-1", map[string]interface{}{"updated_at": time.Now().UTC()}); err != nil {
		t.Fatalf("UpdateTicket(updated_at only) returned an error: %v", err)
	}
	if err := mock2.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetTicketUsesTheExplicitProjection pins that the single-ticket read is not
// SELECT * either. It is the hottest read in the module: TransitionStatus,
// AssignTicket, EscalateTicket, ResolveTicket and CloseTicket each call it twice,
// and safe mode made every one of those routes fail on deleted_at and updated_by.
func TestGetTicketUsesTheExplicitProjection(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`SELECT id, tenant_id, title, COALESCE\(description, ''\) AS description, COALESCE\(category, ''\) AS category, priority, status, assignee_id, reporter_id, COALESCE\(source, ''\) AS source, source_id, resolved_at, closed_at, created_at, updated_at FROM tickets WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("tk-1", "t1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("tk-1"))

	if _, err := repo.GetTicket(context.Background(), "t1", "tk-1"); err != nil {
		t.Fatalf("GetTicket returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetRelationsUsesTheExplicitProjection is the ticket_relations half of the
// same rule, and it also pins the COALESCE on description, which 696 adds as
// nullable while models.TicketRelation.Description is a non-pointer string.
func TestGetRelationsUsesTheExplicitProjection(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`SELECT id, tenant_id, ticket_id, related_id, type, COALESCE\(description, ''\) AS description, confidence, created_at FROM ticket_relations WHERE tenant_id=\$1 AND ticket_id=\$2 ORDER BY created_at`).
		WithArgs("t1", "tk-1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	if _, err := repo.GetRelations(context.Background(), "t1", "tk-1"); err != nil {
		t.Fatalf("GetRelations returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestTicketRelationIDScansAUUIDStringIsThePositiveControl proves the type fix
// has something to lose. ticket_relations.id is UUID PRIMARY KEY in 076, so the
// destination must be a string; the old int field could never hold it.
func TestTicketRelationIDScansAUUIDStringIsThePositiveControl(t *testing.T) {
	var rel models.TicketRelation
	rel.ID = "550e8400-e29b-41d4-a716-446655440000"
	if rel.ID != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("TicketRelation.ID cannot hold a UUID string: %v", rel.ID)
	}
	if fmt.Sprintf("%T", rel.ID) != "string" {
		t.Fatalf("TicketRelation.ID is %T, want string", rel.ID)
	}
}

// ---------------------------------------------------------------------------
// Round 64: the 655_create_ticketing_missing_tables.sql dialect fixes.
//
// 655 declares every ticketing table with UUID PRIMARY KEY and no later
// migration alters any of them, so each SELECT below is pinned to its explicit
// projection. SELECT * hands back columns the destination struct has no
// db:"..." name for, and sqlx safe mode fails the whole read; a nullable UUID
// scans into nothing without COALESCE; JSONB comes back as []byte without a
// ::text cast.
// ---------------------------------------------------------------------------

func TestListAssignmentRulesCastsJSONBAndCoalescesTheNullableUUID(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, name, conditions::text AS conditions, action, COALESCE\(target_id, ''\) AS target_id, enabled, created_at FROM ticketing_assignment_rules WHERE tenant_id=\$1 ORDER BY created_at DESC$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "name", "conditions", "action", "target_id", "enabled", "created_at"},
		).AddRow("ar-1", "t1", "route-high", `{"priority":"high"}`, "assign", "", true, time.Unix(1700000000, 0)))

	items, err := repo.ListAssignmentRules(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListAssignmentRules returned an error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("ListAssignmentRules returned %d rows, want 1", len(items))
	}
	got := items[0]
	if got.ID != "ar-1" || got.Name != "route-high" || got.Conditions != `{"priority":"high"}` {
		t.Errorf("row did not scan: %+v", got)
	}
	if got.TargetID != "" {
		t.Errorf("COALESCEd target_id = %q, want empty string", got.TargetID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetSLATargetUsesTheExplicitProjection(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, priority, response_hours, resolve_hours, enabled, created_at FROM ticketing_sla_targets WHERE tenant_id=\$1 AND priority=\$2 AND enabled=true$`).
		WithArgs("t1", "high").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "priority", "response_hours", "resolve_hours", "enabled", "created_at"},
		).AddRow("st-1", "t1", "high", 1, 8, true, time.Unix(1700000000, 0)))

	st, err := repo.GetSLATarget(context.Background(), "t1", "high")
	if err != nil {
		t.Fatalf("GetSLATarget returned an error: %v", err)
	}
	if st.ID != "st-1" || st.ResponseH != 1 || st.ResolveH != 8 || !st.Enabled {
		t.Errorf("row did not scan: %+v", st)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetSLAPolicyScansTheUUIDIDAndEveryColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, name, priority, response_hours, resolve_hours, active, created_at, updated_at FROM ticketing_sla_policies WHERE id=\$1 AND tenant_id=\$2$`).
		WithArgs("550e8400-e29b-41d4-a716-446655440000", "t1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "name", "priority", "response_hours", "resolve_hours", "active", "created_at", "updated_at"},
		).AddRow("550e8400-e29b-41d4-a716-446655440000", "t1", "gold", "high", 1, 8, true,
			time.Unix(1700000000, 0), time.Unix(1700000001, 0)))

	p, err := repo.GetSLAPolicy(context.Background(), "t1", "550e8400-e29b-41d4-a716-446655440000")
	if err != nil {
		t.Fatalf("GetSLAPolicy returned an error: %v", err)
	}
	if p.ID != "550e8400-e29b-41d4-a716-446655440000" || p.Name != "gold" || p.ResponseH != 1 || !p.Active {
		t.Errorf("row did not scan: %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetSLABreachesDoesNotFilterOnATenantColumnItLacks pins that the WHERE
// clause is gone as well as the argument list. 655 gives ticketing_sla_breaches
// ticket_id and policy_id but no tenant_id, so the filter that used to sit
// here was a Postgres "column does not exist" on every call; WithArgs() with no
// arguments asserts the parameter is not bound at all.
func TestGetSLABreachesDoesNotFilterOnATenantColumnItLacks(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, ticket_id, COALESCE\(policy_id, ''\) AS policy_id, type, breached_at FROM ticketing_sla_breaches ORDER BY breached_at DESC$`).
		WithArgs().
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "ticket_id", "policy_id", "type", "breached_at"},
		).AddRow("br-1", "tk-9", "", "response", time.Unix(1700000000, 0)))

	items, err := repo.GetSLABreaches(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetSLABreaches returned an error: %v", err)
	}
	if len(items) != 1 || items[0].ID != "br-1" || items[0].TicketID != "tk-9" {
		t.Errorf("row did not scan: %+v", items)
	}
	if items[0].PolicyID != "" {
		t.Errorf("COALESCEd policy_id = %q, want empty string", items[0].PolicyID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListAutomationRulesUsesTheExplicitProjection(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, name, trigger, condition, action, enabled, created_at, updated_at FROM ticketing_automation_rules WHERE tenant_id=\$1 ORDER BY created_at DESC$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).
			AddRow("ar-1"))

	if _, err := repo.ListAutomationRules(context.Background(), "t1"); err != nil {
		t.Fatalf("ListAutomationRules returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListEngineersCastsSkillsAndCoalescesTheUserUUID(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, COALESCE\(user_id, ''\) AS user_id, name, skills::text AS skills, max_tickets, is_active, current_load, created_at, updated_at FROM ticketing_dispatch_engineers WHERE tenant_id=\$1 ORDER BY name$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "user_id", "name", "skills", "max_tickets", "is_active", "current_load", "created_at", "updated_at"},
		).AddRow("en-1", "t1", "", "Priya", `["postgres"]`, 5, true, 2,
			time.Unix(1700000000, 0), time.Unix(1700000001, 0)))

	items, err := repo.ListEngineers(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListEngineers returned an error: %v", err)
	}
	if len(items) != 1 || items[0].Name != "Priya" || items[0].Skills != `["postgres"]` {
		t.Errorf("row did not scan: %+v", items)
	}
	if items[0].UserID != "" || items[0].MaxTickets != 5 || items[0].CurrentLoad != 2 {
		t.Errorf("row did not scan: %+v", items[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListDispatchRulesUsesTheExplicitProjection(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, name, conditions::text AS conditions, strategy, weight, enabled, created_at FROM ticketing_dispatch_rules WHERE tenant_id=\$1 ORDER BY created_at DESC$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("dr-1"))

	if _, err := repo.ListDispatchRules(context.Background(), "t1"); err != nil {
		t.Fatalf("ListDispatchRules returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetTransferHistoryOmitsATenantColumnTheModelLacks pins the one projection
// in this file that deliberately leaves a column out: models.TransferHistoryEntry
// has no db:"tenant_id", so projecting it would fail the scan.
func TestGetTransferHistoryOmitsATenantColumnTheModelLacks(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, ticket_id, COALESCE\(from_user_id, ''\) AS from_user_id, COALESCE\(to_user_id, ''\) AS to_user_id, reason, created_at FROM ticket_transfer_history WHERE tenant_id=\$1 AND ticket_id=\$2 ORDER BY created_at DESC$`).
		WithArgs("t1", "tk-1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "ticket_id", "from_user_id", "to_user_id", "reason", "created_at"},
		).AddRow("th-1", "tk-1", "", "u-2", "escalated", time.Unix(1700000000, 0)))

	items, err := repo.GetTransferHistory(context.Background(), "t1", "tk-1")
	if err != nil {
		t.Fatalf("GetTransferHistory returned an error: %v", err)
	}
	if len(items) != 1 || items[0].ToUserID != "u-2" || items[0].Reason != "escalated" {
		t.Errorf("row did not scan: %+v", items)
	}
	if items[0].FromUserID != "" {
		t.Errorf("COALESCEd from_user_id = %q, want empty string", items[0].FromUserID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListSuspensionsCoalescesTheNullableColumns(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id, tenant_id, COALESCE\(engineer_id, ''\) AS engineer_id, reason, type, COALESCE\(start_at, NOW\(\)\) AS start_at, end_at, status, created_at FROM ticketing_suspensions WHERE tenant_id=\$1 ORDER BY created_at DESC$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"id", "tenant_id", "engineer_id", "reason", "type", "start_at", "end_at", "status", "created_at"},
		).AddRow("sp-1", "t1", "", "vacation", "scheduled", time.Unix(1700000000, 0), nil, "active", time.Unix(1700000000, 0)))

	items, err := repo.ListSuspensions(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListSuspensions returned an error: %v", err)
	}
	if len(items) != 1 || items[0].ID != "sp-1" || items[0].Reason != "vacation" {
		t.Errorf("row did not scan: %+v", items)
	}
	if items[0].EngineerID != "" {
		t.Errorf("COALESCEd engineer_id = %q, want empty string", items[0].EngineerID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestUpdateSuspendStatusDoesNotWriteUpdatedAt pins the SET list: 655 gives
// ticketing_suspensions created_at only, so the NOW() clause that used to sit
// next to status made every suspend-state change a "column does not exist".
func TestUpdateSuspendStatusDoesNotWriteUpdatedAt(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(
		`^UPDATE ticketing_suspensions SET status=\$1 WHERE id=\$2 AND tenant_id=\$3$`).
		WithArgs("completed", "sp-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateSuspendStatus(context.Background(), "t1", "sp-1", "completed"); err != nil {
		t.Fatalf("UpdateSuspendStatus returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestUpdateSLAPolicyAppliesEverySuppliedColumn proves the second half of the
// Round 64 fix: the method used to receive the whole map and write only
// updated_at, so PUT /tickets/sla/policies/:policyId discarded name, priority,
// response_hours, resolve_hours and active while reporting success.
func TestUpdateSLAPolicyAppliesEverySuppliedColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	updates := map[string]interface{}{
		"name":           "gold-v2",
		"priority":       "critical",
		"response_hours": 0,
		"resolve_hours":  2,
		"active":         false,
	}
	mock.ExpectExec(
		`^UPDATE ticketing_sla_policies SET active=\$3, name=\$4, priority=\$5, resolve_hours=\$6, response_hours=\$7, updated_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2$`).
		WithArgs("p-1", "t1", false, "gold-v2", "critical", 2, 0).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateSLAPolicy(context.Background(), "t1", "p-1", updates); err != nil {
		t.Fatalf("UpdateSLAPolicy returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestUpdateSLAPolicyRejectsAColumn655DoesNotHave proves the allow list is
// doing work. The models carry description, enabled and
// target_response_time_ms; 655 has none of them, so accepting one would both
// write to a missing column and rebuild the old silent-discard behaviour.
func TestUpdateSLAPolicyRejectsAColumn655DoesNotHave(t *testing.T) {
	repo, mock := newMockRepo(t)
	// A queued exec is what makes this test able to tell "rejected before any
	// SQL" from "query issued and then refused". sqlmock refuses an unmatched
	// call, so err != nil would hold either way and the assertion would be
	// vacuous. With the allow list bypassed the first key below consumes the
	// expectation and comes back nil, which is exactly the behaviour the allow
	// list exists to stop.
	mock.ExpectExec(`UPDATE ticketing_sla_policies SET .*`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	for _, key := range []string{"description", "enabled", "target_response_time_ms",
		"tenant_id", "id", "created_at"} {
		err := repo.UpdateSLAPolicy(context.Background(), "t1", "p-1", map[string]interface{}{key: "v"})
		if err == nil {
			t.Fatalf("UpdateSLAPolicy accepted %q and issued a query, want an error", key)
		}
		if !strings.Contains(err.Error(), key) {
			t.Fatalf("UpdateSLAPolicy(%q) error %q does not name the offending key", key, err.Error())
		}
	}
}

func TestUpdateAutomationRuleAppliesEverySuppliedColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	updates := map[string]interface{}{
		"name":      "escalate-critical",
		"trigger":   "on_escalate",
		"condition": `priority == "critical"`,
		"action":    "notify",
		"enabled":   true,
	}
	mock.ExpectExec(
		`^UPDATE ticketing_automation_rules SET action=\$3, condition=\$4, enabled=\$5, name=\$6, trigger=\$7, updated_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2$`).
		WithArgs("r-1", "t1", "notify", `priority == "critical"`, true, "escalate-critical", "on_escalate").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateAutomationRule(context.Background(), "t1", "r-1", updates); err != nil {
		t.Fatalf("UpdateAutomationRule returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateAutomationRuleRejectsAColumn655DoesNotHave(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`UPDATE ticketing_automation_rules SET .*`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	for _, key := range []string{"description", "actions", "created_by", "tenant_id", "id"} {
		err := repo.UpdateAutomationRule(context.Background(), "t1", "r-1", map[string]interface{}{key: "v"})
		if err == nil {
			t.Fatalf("UpdateAutomationRule accepted %q and issued a query, want an error", key)
		}
		if !strings.Contains(err.Error(), key) {
			t.Fatalf("UpdateAutomationRule(%q) error %q does not name the offending key", key, err.Error())
		}
	}
}

// TestGetDispatchQueueEntriesCastsTheAgeToDoublePrecision pins both halves of
// the fix. EXTRACT(EPOCH ...) returns numeric, which lib/pq hands back as []byte
// and []byte does not scan into float64; and models.QueueEntry carries no db
// tags, so the aliased ticket_id had no destination under sqlx's identity
// mapper.
func TestGetDispatchQueueEntriesCastsTheAgeToDoublePrecision(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT id AS ticket_id, priority, CAST\(EXTRACT\(EPOCH FROM \(NOW\(\) - created_at\)\)/3600 AS double precision\) AS age_hours, CASE WHEN assignee_id IS NOT NULL THEN true ELSE false END AS assigned, assignee_id AS engineer FROM tickets WHERE tenant_id=\$1 AND status NOT IN \('closed','resolved'\) ORDER BY priority$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows(
			[]string{"ticket_id", "priority", "age_hours", "assigned", "engineer"},
		).AddRow("tk-1", "high", 12.5, false, nil))

	items, err := repo.GetDispatchQueueEntries(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetDispatchQueueEntries returned an error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("returned %d entries, want 1", len(items))
	}
	got := items[0]
	if got.TicketID != "tk-1" || got.Priority != "high" || got.Age != 12.5 || got.Assigned {
		t.Errorf("entry did not scan: %+v", got)
	}
	if got.Engineer != nil {
		t.Errorf("Engineer = %v, want nil", *got.Engineer)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetTransferStatsScansTheUnderscoredAlias pins the db tags that let the
// aggregate alias land in the struct. models.TransferStats had no db tags, so
// the identity mapper looked for "totaltransfers" while the query aliased
// "total_transfers" and the whole call failed.
func TestGetTransferStatsScansTheUnderscoredAlias(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(
		`^SELECT COUNT\(\*\) AS total_transfers FROM ticket_transfer_history WHERE tenant_id=\$1$`).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"total_transfers"}).AddRow(42))

	ts, err := repo.GetTransferStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetTransferStats returned an error: %v", err)
	}
	if ts.TotalTransfers != 42 {
		t.Errorf("TotalTransfers = %d, want 42", ts.TotalTransfers)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestTransferStatsCarriesDBTagsForEveryAliasIsThePositiveControl proves the
// tag fix has something to lose: without them sqlx's identity mapper lowercases
// the field name, so TotalTransfers would be looked up as "totaltransfers" and
// the "total_transfers" alias would have nowhere to go.
func dbTagOf(t reflect.Type, field string) string {
	f, ok := t.FieldByName(field)
	if !ok {
		return ""
	}
	return f.Tag.Get("db")
}

// TestTransferStatsCarriesDBTagsForEveryAliasIsThePositiveControl proves the
// tag fix has something to lose: without them sqlx's identity mapper lowercases
// the field name, so TotalTransfers would be looked up as "totaltransfers" and
// the "total_transfers" alias would have nowhere to go.
func TestTransferStatsCarriesDBTagsForEveryAliasIsThePositiveControl(t *testing.T) {
	stats := reflect.TypeOf(models.TransferStats{})
	if got := dbTagOf(stats, "TotalTransfers"); got != "total_transfers" {
		t.Fatalf(`TransferStats.TotalTransfers db tag = %q, want "total_transfers"`, got)
	}
	if got := dbTagOf(stats, "ActiveTransfers"); got != "active_transfers" {
		t.Fatalf(`TransferStats.ActiveTransfers db tag = %q, want "active_transfers"`, got)
	}
	entry := reflect.TypeOf(models.QueueEntry{})
	for _, f := range []string{"TicketID", "Priority", "Age", "Assigned", "Engineer"} {
		if got := dbTagOf(entry, f); got == "" {
			t.Fatalf("QueueEntry.%s is missing its db tag", f)
		}
	}
}
