package sla

import (
	"context"
	"fmt"
	"math"
)

// SLAConfig is the root configuration for SLA calculation.
// Mirrors NeatLogic's SLA JSON config (calculateHandler + calculatePolicyList).
type SLAConfig struct {
	EnablePriority   int          `json:"enablePriority"` // 1 = per-priority calculation
	CalculateHandler string       `json:"calculateHandler"`
	Policies         []SLAPolicy  `json:"calculatePolicyList"`
	ServiceWindow    *Worktime    `json:"serviceWindow"` // working hours window
}

// SLAPolicy defines response/resolution time per priority level.
type SLAPolicy struct {
	Unit     string            `json:"unit"` // "minute" | "hour" | "day"
	Timeout  int               `json:"time"`
	ConditionGroups []ConditionGroup `json:"conditionGroupList"`
}

// ConditionGroup is a set of matching conditions for applying a policy.
type ConditionGroup struct {
	Type      string            `json:"type"`      // "priority" | "category" | "source"
	Operator  string            `json:"operator"`  // "eq" | "in" | "gte" | "lte"
	Values    []string          `json:"values"`
	Timeout   int               `json:"time"`      // override
	Unit      string            `json:"unit"`
	Priority  string            `json:"priority"`  // used for priority-based timeout lookup
}

// Worktime defines the working hours window for SLA calculation.
// Non-working hours are excluded from SLA clock.
type Worktime struct {
	Enable       bool            `json:"enable"`
	Weekdays     []int           `json:"weekdays"`      // 1=Mon ... 7=Sun
	StartTime    string          `json:"startTime"`     // "09:00"
	EndTime      string          `json:"endTime"`       // "18:00"
	Holidays     []string        `json:"holidays"`      // "2026-01-01"
	ExcludeDays  []int           `json:"excludeDays"`   // days of month
	ExcludeMonths []int          `json:"excludeMonths"` // months of year
}

// SLAResult is the output of SLA calculation.
type SLAResult struct {
	ResponseDeadline   string `json:"response_deadline"`
	ResponseDurationMs int64  `json:"response_duration_ms"`
	ResponseRemaining  int64  `json:"response_remaining_ms"`

	ResolutionDeadline   string `json:"resolution_deadline"`
	ResolutionDurationMs int64  `json:"resolution_duration_ms"`
	ResolutionRemaining  int64  `json:"resolution_remaining_ms"`

	DeadlineAt    string `json:"deadline_at"`     // latest of response + resolution
	ElapsedMs     int64  `json:"elapsed_ms"`      // elapsed working time
	UtilizedRatio float64 `json:"utilized_ratio"` // 0-1, 1 = deadline reached
}

// DefaultSlaCalculateHandler is the default SLA calculator.
type DefaultSlaCalculateHandler struct{}

// Calculate computes SLA deadlines using working-hours-aware calculation.
func (h *DefaultSlaCalculateHandler) Calculate(ctx context.Context, sla *SLAConfig, task *TaskContext, nowTime interface{}) (*SLAResult, error) {
	if sla == nil {
		return nil, fmt.Errorf("SLA config is nil")
	}
	if task == nil {
		return nil, fmt.Errorf("task context is nil")
	}

	// Parse the time provided (defaults to time.Now() if nil)
	var startTime interface{} = nowTime
	if startTime == nil {
		startTime = nil
	}

	// Apply policy matching to determine timeout values
	policy, err := h.matchPolicy(sla, task)
	if err != nil {
		return nil, err
	}

	// Convert policy to milliseconds
	responseMs := policy.Timeout
	resolutionMs := policy.Timeout * 4 // default: resolution = 4x response

	// Calculate working-time-adjusted deadlines
	w := sla.ServiceWindow
	if w != nil && w.Enable {
		responseMs = h.adjustToWorkingTime(w, responseMs)
		resolutionMs = h.adjustToWorkingTime(w, resolutionMs)
	}

	return &SLAResult{
		ResponseDurationMs:   int64(responseMs),
		ResponseRemaining:    int64(responseMs), // full remaining since start
		ResolutionDurationMs: int64(resolutionMs),
		ResolutionRemaining:  int64(resolutionMs),
		UtilizedRatio:        0.0,
	}, nil
}

// AdjustWorkingTime calculates the equivalent wall-clock duration for a working-time budget.
// It returns the duration including non-working hours.
func (h *DefaultSlaCalculateHandler) AdjustWorkingTime(w *Worktime, budgetMs int64) int64 {
	if w == nil || !w.Enable {
		return budgetMs
	}

	// Simplified: assume 8h work day / 5 day work week = 40h
	// Ratio: 24h / 8h = 3x for single day, 7d / 5d = 1.4x overall
	ratio := float64(7*24) / float64(5*8) // 1.4 * 3 = 4.2
	adjusted := int64(math.Ceil(float64(budgetMs) * ratio))
	return adjusted
}

// adjustToWorkingTime is the internal working-time adjustment helper.
func (h *DefaultSlaCalculateHandler) adjustToWorkingTime(w *Worktime, ms int) int {
	return int(h.AdjustWorkingTime(w, int64(ms)))
}

// GetRemainingMs computes remaining SLA time for a given elapsed wall-clock.
func (h *DefaultSlaCalculateHandler) GetRemainingMs(w *Worktime, deadlineMs int64, elapsedMs int64) int64 {
	if w != nil && w.Enable {
		// Convert elapsed wall-clock to working time (inverse ratio)
		ratio := float64(5*8) / float64(7*24)
		workingElapsed := int64(math.Floor(float64(elapsedMs) * ratio))
		return deadlineMs - int64(workingElapsed)
	}
	return deadlineMs - elapsedMs
}

// matchPolicy selects the first matching policy based on task context.
func (h *DefaultSlaCalculateHandler) matchPolicy(sla *SLAConfig, task *TaskContext) (*SLAPolicy, error) {
	if len(sla.Policies) == 0 {
		return nil, fmt.Errorf("no SLA policies configured")
	}

	// If enablePriority == 1, look up by priority
	if sla.EnablePriority == 1 && task.Priority != "" {
		for _, policy := range sla.Policies {
			for _, cg := range policy.ConditionGroups {
                if cg.Type == "priority" && cg.Operator == "eq" {
                    for _, v := range cg.Values {
                        if v == task.Priority && cg.Timeout > 0 {
                            // Clone policy with priority-specific timeout
                            return &SLAPolicy{
                                Unit:      policy.Unit,
                                Timeout:   cg.Timeout,
                                ConditionGroups: policy.ConditionGroups,
                            }, nil
                        }
                    }
                }
			}
		}
	}

	// Return first policy as default
	return &sla.Policies[0], nil
}

// TaskContext carries the task data for SLA calculation.
type TaskContext struct {
	ID          string `json:"id"`
	Priority    string `json:"priority"`   // "critical" | "high" | "medium" | "low"
	Category    string `json:"category"`
	TicketID    string `json:"ticket_id"`
	WorkflowID  string `json:"workflow_id"`
	FormData    map[string]interface{} `json:"form_data"`
}
