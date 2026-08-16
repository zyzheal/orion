package repository

import (
	"testing"
)

func Test_NewTicketRepository_Nil(t *testing.T) {
	r := NewTicketRepository(nil)
	if r == nil {
		t.Fatal("NewTicketRepository(nil) returned nil")
	}
}

func Test_NewTicketRepository_ReturnsStruct(t *testing.T) {
	r := NewTicketRepository(nil)
	if r == nil {
		t.Fatal("repo should never be nil")
	}
}

func Test_NewCommentRepository_Nil(t *testing.T) {
	r := NewCommentRepository(nil)
	if r == nil {
		t.Fatal("NewCommentRepository(nil) returned nil")
	}
}

func Test_NewWorkflowRepository_Nil(t *testing.T) {
	r := NewWorkflowRepository(nil)
	if r == nil {
		t.Fatal("NewWorkflowRepository(nil) returned nil")
	}
}

func Test_NewRelationRepository_Nil(t *testing.T) {
	r := NewRelationRepository(nil)
	if r == nil {
		t.Fatal("NewRelationRepository(nil) returned nil")
	}
}

func Test_NewSLARepository_Nil(t *testing.T) {
	r := NewSLARepository(nil)
	if r == nil {
		t.Fatal("NewSLARepository(nil) returned nil")
	}
}

func Test_NewDispatchRepository_Nil(t *testing.T) {
	r := NewDispatchRepository(nil)
	if r == nil {
		t.Fatal("NewDispatchRepository(nil) returned nil")
	}
}

func Test_NewSuspendRepository_Nil(t *testing.T) {
	r := NewSuspendRepository(nil)
	if r == nil {
		t.Fatal("NewSuspendRepository(nil) returned nil")
	}
}

func Test_NewTransferRepository_Nil(t *testing.T) {
	r := NewTransferRepository(nil)
	if r == nil {
		t.Fatal("NewTransferRepository(nil) returned nil")
	}
}

func Test_NewAnalyticsRepository_Nil(t *testing.T) {
	r := NewAnalyticsRepository(nil)
	if r == nil {
		t.Fatal("NewAnalyticsRepository(nil) returned nil")
	}
}

func Test_NewAssignmentRuleRepository_Nil(t *testing.T) {
	r := NewAssignmentRuleRepository(nil)
	if r == nil {
		t.Fatal("NewAssignmentRuleRepository(nil) returned nil")
	}
}

func Test_NewSLAPolicyRepository_Nil(t *testing.T) {
	r := NewSLAPolicyRepository(nil)
	if r == nil {
		t.Fatal("NewSLAPolicyRepository(nil) returned nil")
	}
}

func Test_NewAutomationRuleRepository_Nil(t *testing.T) {
	r := NewAutomationRuleRepository(nil)
	if r == nil {
		t.Fatal("NewAutomationRuleRepository(nil) returned nil")
	}
}
