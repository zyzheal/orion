package models

import "testing"

func TestWorkflowFields(t *testing.T) {
	w := Workflow{ID: "w1", TenantID: "t1", Name: "Deploy", Status: WfActive}
	if w.Status != WfActive { t.Errorf("expected active, got %s", w.Status) }
}

func TestRunStatus(t *testing.T) {
	r := WorkflowRun{ID: "r1", WorkflowID: "w1", Status: RunRunning}
	if r.Status != RunRunning { t.Errorf("expected running, got %s", r.Status) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Offset() != 0 { t.Errorf("expected 0, got %d", p.Offset()) }
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
