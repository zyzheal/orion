package engine

import (
	"context"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/assignee/types"
)

func makeCandidates() []*types.AssignmentTarget {
	return []*types.AssignmentTarget{
		{ID: "a", Name: "Alice", IsActive: true, IsAvailable: true, MaxLoad: 10, Weight: 1.0,
			AvailableFrom: time.Now().Add(-time.Hour), AvailableTo: time.Now().Add(time.Hour)},
		{ID: "b", Name: "Bob", IsActive: true, IsAvailable: true, MaxLoad: 10, Weight: 1.0,
			AvailableFrom: time.Now().Add(-time.Hour), AvailableTo: time.Now().Add(time.Hour)},
	}
}

func makeItem(category, priority string) *types.WorkItem {
	return &types.WorkItem{
		ID: "w1", TenantID: "t1", TargetType: "ticket",
		Category: category, Priority: priority, Source: "email", Status: "new",
		CreatedAt: time.Now(),
	}
}

func TestDispatchItemMatch(t *testing.T) {
	e := NewEngine()
	e.SetRules([]*types.AssigneeRule{
		{ID: 1, Name: "ops-rule", Strategy: "round_robin", Priority: 10, Enabled: true,
			TargetIDs: []string{"a"},
			Conditions: []types.Condition{
				{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"},
			},
		},
	})
	item := makeItem("ops", "high")

	result, err := e.DispatchItem(context.Background(), item, makeCandidates())
	if err != nil {
		t.Fatal(err)
	}
	if result == nil || result.Target == nil {
		t.Fatal("expected a dispatch result")
	}
	if result.Target.ID != "a" {
		t.Errorf("target = %s, want a", result.Target.ID)
	}
	if result.RuleID != 1 {
		t.Errorf("rule = %d, want 1", result.RuleID)
	}
}

func TestDispatchItemNoMatch(t *testing.T) {
	e := NewEngine()
	e.SetRules([]*types.AssigneeRule{
		{ID: 1, Name: "security-only", Strategy: "round_robin", Priority: 10, Enabled: true,
			TargetIDs: []string{"a"},
			Conditions: []types.Condition{
				{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "security"},
			},
		},
	})
	_, err := e.DispatchItem(context.Background(), makeItem("ops", "high"), makeCandidates())
	if err == nil {
		t.Error("expected no-match error")
	}
	if !strings.Contains(err.Error(), "exhausted") && !strings.Contains(err.Error(), "no matching") {
		t.Errorf("error = %q", err.Error())
	}
}

func TestDispatchItemDisabledRule(t *testing.T) {
	e := NewEngine()
	e.SetRules([]*types.AssigneeRule{
		{ID: 1, Name: "disabled", Strategy: "round_robin", Enabled: false,
			TargetIDs: []string{"a"},
			Conditions: []types.Condition{
				{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"},
			},
		},
	})
	_, err := e.DispatchItem(context.Background(), makeItem("ops", "high"), makeCandidates())
	if err == nil {
		t.Error("disabled rule should not match")
	}
}

func TestDispatchItemCapacityLimit(t *testing.T) {
	e := NewEngine()
	e.SetRules([]*types.AssigneeRule{
		{ID: 1, Name: "limited", Strategy: "round_robin", Enabled: true, Capacity: 1,
			TargetIDs: []string{"a"},
			Conditions: []types.Condition{
				{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"},
			},
		},
		{ID: 2, Name: "fallback", Strategy: "round_robin", Enabled: true,
			TargetIDs: []string{"b"},
			Conditions: []types.Condition{
				{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"},
			},
		},
	})
	cands := makeCandidates()

	// First dispatch fills rule 1
	r1, err := e.DispatchItem(context.Background(), makeItem("ops", "h"), cands)
	if err != nil {
		t.Fatal(err)
	}
	if r1.RuleID != 1 {
		t.Errorf("first dispatch should use rule 1, got %d", r1.RuleID)
	}

	// Second dispatch should skip rule 1 (capacity) and use rule 2
	r2, err := e.DispatchItem(context.Background(), makeItem("ops", "h"), cands)
	if err != nil {
		t.Fatal(err)
	}
	if r2.RuleID != 2 {
		t.Errorf("second dispatch should use rule 2, got %d", r2.RuleID)
	}
}

func TestDispatchItemPriorityOrdering(t *testing.T) {
	e := NewEngine()
	e.SetRules([]*types.AssigneeRule{
		{ID: 1, Name: "low", Strategy: "round_robin", Priority: 1, Enabled: true,
			TargetIDs: []string{"a"},
			Conditions: []types.Condition{{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"}}},
		{ID: 2, Name: "high", Strategy: "round_robin", Priority: 100, Enabled: true,
			TargetIDs: []string{"b"},
			Conditions: []types.Condition{{Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"}}},
	})

	result, err := e.DispatchItem(context.Background(), makeItem("ops", "h"), makeCandidates())
	if err != nil {
		t.Fatal(err)
	}
	if result.RuleID != 2 {
		t.Errorf("higher priority rule should win, got %d", result.RuleID)
	}
}

func TestConditionEq(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P1"), types.Condition{
		Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorEq, Value: "ops"})
	if !match {
		t.Error("eq match expected")
	}
}

func TestConditionNeq(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P1"), types.Condition{
		Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorNeq, Value: "sec"})
	if !match {
		t.Error("neq match expected")
	}
}

func TestConditionIn(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P1"), types.Condition{
		Field: types.ConditionFieldPriority, Operator: types.ConditionOperatorIn, ValueList: []string{"P1", "P2"}})
	if !match {
		t.Error("in match expected")
	}
}

func TestConditionNotIn(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P3"), types.Condition{
		Field: types.ConditionFieldPriority, Operator: types.ConditionOperatorNotIn, ValueList: []string{"P1", "P2"}})
	if !match {
		t.Error("notin match expected")
	}
}

func TestConditionContains(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P1"), types.Condition{
		Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorContains, Value: "op"})
	if !match {
		t.Error("contains match expected")
	}
}

func TestConditionRegex(t *testing.T) {
	e := NewEngine()
	match := e.evaluateCondition(makeItem("ops", "P1"), types.Condition{
		Field: types.ConditionFieldCategory, Operator: types.ConditionOperatorRegex, Value: "o.*"})
	if !match {
		t.Error("regex match expected")
	}
}

func TestCheckEscalation(t *testing.T) {
	e := NewEngine()
	e.SetEscalationPolicies([]*types.EscalationPolicy{
		{ID: 1, Name: "test", Enabled: true,
			Levels: []types.EscalationLevel{{Level: 0, TargetID: "manager", TriggerAfter: time.Second * 2}}},
	})

	item := &types.WorkItem{ID: "w1", CreatedAt: time.Now().Add(-time.Second * 5)}
	esc := e.CheckEscalation(context.Background(), item, item.CreatedAt, 0)
	if esc == nil {
		t.Fatal("expected escalation")
	}
	if esc.Level != 0 {
		t.Errorf("escalation level = %d, want 0", esc.Level)
	}
}

func TestCheckEscalationNotYet(t *testing.T) {
	e := NewEngine()
	e.SetEscalationPolicies([]*types.EscalationPolicy{
		{ID: 1, Name: "test", Enabled: true,
			Levels: []types.EscalationLevel{{Level: 0, TargetID: "manager", TriggerAfter: time.Hour}}},
	})

	item := &types.WorkItem{ID: "w2", CreatedAt: time.Now().Add(-time.Second)}
	esc := e.CheckEscalation(context.Background(), item, item.CreatedAt, 0)
	if esc != nil {
		t.Error("should not escalate yet")
	}
}

func TestCheckEscalationLevelOutofBounds(t *testing.T) {
	e := NewEngine()
	e.SetEscalationPolicies([]*types.EscalationPolicy{
		{ID: 1, Name: "test", Enabled: true,
			Levels: []types.EscalationLevel{{Level: 0, TargetID: "a", TriggerAfter: time.Second}}},
	})
	esc := e.CheckEscalation(context.Background(),
		&types.WorkItem{ID: "w3", CreatedAt: time.Now().Add(-time.Hour * 2)},
		time.Now().Add(-time.Hour*2), 99)
	if esc != nil {
		t.Error("level out of bounds should return nil")
	}
}

func TestCapabilities(t *testing.T) {
	e := NewEngine()
	caps := e.AllCapabilities()
	if caps.HasCooldown != true {
		t.Error("should have cooldown")
	}
	if caps.HasCapacityLimit != true {
		t.Error("should have capacity limit")
	}
}

func TestGetAvailableStrategies(t *testing.T) {
	e := NewEngine()
	strats := e.GetAvailableStrategies()
	if len(strats) == 0 {
		t.Error("expected at least one strategy")
	}
}
