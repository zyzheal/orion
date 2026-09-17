package repository

import (
	"context"
	"database/sql/driver"
	"fmt"
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
