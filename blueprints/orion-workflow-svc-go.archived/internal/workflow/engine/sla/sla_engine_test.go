package sla

import (
	"context"
	"testing"
	"time"
)

func TestDefaultSlaCalculateHandler_Calculate(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	slaConfig := &SLAConfig{
		EnablePriority: 1,
		Policies: []SLAPolicy{
            {Unit: "minute", Timeout: 30},
		},
	}
	task := &TaskContext{
		ID:        "t-1",
		Priority:  "high",
		TicketID:  "tk-1",
	}

	result, err := handler.Calculate(context.Background(), slaConfig, task, time.Now())
	if err != nil {
		t.Fatalf("Calculate returned error: %v", err)
	}
	if result.ResponseDurationMs <= 0 {
		t.Error("expected positive response duration")
	}
}

func TestDefaultSlaCalculateHandler_MissingPolicy(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	slaConfig := &SLAConfig{}
	task := &TaskContext{}

	_, err := handler.Calculate(context.Background(), slaConfig, task, time.Now())
	if err == nil {
		t.Error("expected error for missing policy")
	}
}

func TestDefaultSlaCalculateHandler_NilSLA(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	_, err := handler.Calculate(context.Background(), nil, &TaskContext{}, time.Now())
	if err == nil {
		t.Error("expected error for nil SLA config")
	}
}

func TestDefaultSlaCalculateHandler_NilTask(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	_, err := handler.Calculate(context.Background(), &SLAConfig{}, nil, time.Now())
	if err == nil {
		t.Error("expected error for nil task")
	}
}

func TestDefaultSlaCalculateHandler_AdjustWorkingTime(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}

	// Disable: should return same value
	disabled := &Worktime{Enable: false}
	budget := int64(1000)
	adjusted := handler.AdjustWorkingTime(disabled, budget)
	if adjusted != budget {
		t.Errorf("expected %d, got %d", budget, adjusted)
	}

	// Enable: should be larger than budget
	enabled := &Worktime{Enable: true}
	adjusted = handler.AdjustWorkingTime(enabled, budget)
	if adjusted <= budget {
		t.Errorf("expected adjusted > %d, got %d", budget, adjusted)
	}
}

func TestDefaultSlaCalculateHandler_GetRemainingMs(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	disabled := &Worktime{Enable: false}
	remaining := handler.GetRemainingMs(disabled, 1000, 300)
	if remaining != 700 {
		t.Errorf("expected 700, got %d", remaining)
	}
}

func TestDefaultSlaCalculateHandler_MatchPolicy(t *testing.T) {
	handler := &DefaultSlaCalculateHandler{}
	slaConfig := &SLAConfig{
        EnablePriority: 1,
        Policies: []SLAPolicy{
            {Unit: "minute", Timeout: 30, ConditionGroups: []ConditionGroup{
                {Type: "priority", Operator: "eq", Values: []string{"high"}, Timeout: 15},
            }},
        },
	}
	task := &TaskContext{Priority: "high"}

	policy, err := handler.matchPolicy(slaConfig, task)
	if err != nil {
		t.Fatalf("matchPolicy returned error: %v", err)
	}
	if policy.Timeout != 15 {
		t.Errorf("expected timeout 15, got %d", policy.Timeout)
	}
}
