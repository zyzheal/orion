package repository

import (
	"testing"
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
		ID:                       "test-id",
		TicketID:                 "ticket-1",
		Priority:                 "high",
		TargetResolutionTimeMs:   3600000,
		Breached:                 true,
		ResponseBreached:         false,
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
		ID:        "test-id",
		TicketID:  "ticket-1",
		Priority:  "low",
		Breached:  false,
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
