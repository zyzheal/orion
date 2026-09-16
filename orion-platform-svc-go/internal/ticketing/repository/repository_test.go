package repository

import (
	"context"
	"database/sql/driver"
	"strings"
	"testing"

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
			`SELECT \* FROM tickets WHERE tenant_id = \$1 ORDER BY created_at DESC LIMIT \$2 OFFSET \$3`,
			[]driver.Value{"t1", 50, 0},
		},
		{
			"status and priority",
			models.TicketListQuery{Status: ticketPtr("open"), Priority: ticketPtr("high")},
			`SELECT \* FROM tickets WHERE tenant_id = \$1 AND  status = \$2 AND  priority = \$3 ORDER BY created_at DESC LIMIT \$4 OFFSET \$5`,
			[]driver.Value{"t1", "open", "high", 50, 0},
		},
		{
			"all five filters",
			models.TicketListQuery{
				Status: ticketPtr("open"), Priority: ticketPtr("high"), Assignee: ticketPtr("u1"),
				Category: ticketPtr("cat"), Search: ticketPtr("search"),
			},
			`SELECT \* FROM tickets WHERE tenant_id = \$1 AND  status = \$2 AND  priority = \$3 AND  assignee_id = \$4 AND  category = \$5 AND  \(title ILIKE \$6 OR description ILIKE \$6\) ORDER BY created_at DESC LIMIT \$7 OFFSET \$8`,
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
