// Package types defines the core domain types for the Assignee Dispatcher system.
//
// The dispatcher routes work items (tickets, tasks, incidents, changes) to the best
// available assignee using pluggable dispatch strategies and configurable rules.
package types

import (
	"fmt"
	"time"
)

// --- Dispatcher types ---

const (
	// DispatcherTypeRoundRobin distributes work evenly across eligible assignees.
	DispatcherTypeRoundRobin = "round_robin"
	// DispatcherTypeWeighted distributes work proportional to assignee weights.
	DispatcherTypeWeighted = "weighted"
	// DispatcherTypeSkillBased matches work items to assignees by skill set.
	DispatcherTypeSkillBased = "skill_based"
	// DispatcherTypeLoadBalanced routes work to the least loaded assignee.
	DispatcherTypeLoadBalanced = "load_balanced"
	// DispatcherTypeTimeBased considers assignee availability windows.
	DispatcherTypeTimeBased = "time_based"
)

// AllDispatcherTypes returns the set of supported dispatcher types.
func AllDispatcherTypes() []string {
	return []string{
		DispatcherTypeRoundRobin,
		DispatcherTypeWeighted,
		DispatcherTypeSkillBased,
		DispatcherTypeLoadBalanced,
		DispatcherTypeTimeBased,
	}
}

// --- Rule types ---

// ConditionField is the field a rule condition evaluates.
type ConditionField string

const (
	ConditionFieldCategory    ConditionField = "category"
	ConditionFieldPriority    ConditionField = "priority"
	ConditionFieldType        ConditionField = "type"
	ConditionFieldSource      ConditionField = "source"
	ConditionFieldAssignee    ConditionField = "assignee"
	ConditionFieldCreatedAfter ConditionField = "created_after"
	ConditionFieldTargetStatus ConditionField = "status"
)

// ConditionOperator is the comparison operator for a rule condition.
type ConditionOperator string

const (
	ConditionOperatorEq      ConditionOperator = "eq"
	ConditionOperatorNeq     ConditionOperator = "neq"
	ConditionOperatorIn      ConditionOperator = "in"
	ConditionOperatorNotIn   ConditionOperator = "notin"
	ConditionOperatorGt      ConditionOperator = "gt"
	ConditionOperatorLt      ConditionOperator = "lt"
	ConditionOperatorContains ConditionOperator = "contains"
	ConditionOperatorRegex   ConditionOperator = "regex"
)

// Condition describes a single rule condition.
type Condition struct {
	Field     ConditionField    `json:"field"`
	Operator  ConditionOperator `json:"operator"`
	Value     string            `json:"value"`
	ValueList []string          `json:"value_list,omitempty"`
}

// AssignmentTarget describes who receives the assignment.
type AssignmentTarget struct {
	ID          string `json:"id" db:"id"`
	Type        string `json:"type" db:"type"`        // user, team, group, role
	Name        string `json:"name" db:"name"`
	Skills      []string `json:"skills"`
	CurrentLoad int      `json:"current_load"`
	MaxLoad     int      `json:"max_load"`
	IsActive    bool     `json:"is_active"`
	IsAvailable bool     `json:"is_available"`
	Email       string   `json:"email,omitempty"`
	TeamID      string   `json:"team_id,omitempty"`
	// Time-based availability (only for time-based dispatch)
	AvailableFrom time.Time `json:"available_from,omitempty"`
	AvailableTo   time.Time `json:"available_to,omitempty"`
	Timezone      string    `json:"timezone,omitempty"`
	// Weight (for weighted dispatch)
	Weight float64 `json:"weight"`
}

// AssigneeRule is a routing rule evaluated at dispatch time.
type AssigneeRule struct {
	ID          int       `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Conditions  []Condition `json:"conditions" db:"conditions"`
	Targets     []AssignmentTarget `json:"targets" db:"targets"`
	TargetIDs   []string  `json:"target_ids" db:"target_ids"`
	Strategy    string    `json:"strategy" db:"strategy"`
	Priority    int       `json:"priority" db:"priority"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	Capacity    int       `json:"capacity" db:"capacity"`        // max simultaneous assignments this rule can route
	Weight      float64   `json:"weight" db:"weight"`            // rule weight for tie-breaking
	CooldownSec int       `json:"cooldown_sec" db:"cooldown_sec"` // minimum seconds between assignments to same target
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Validate checks the rule is well-formed.
// StringID returns the rule's ID as a string for use in map lookups.
func (r *AssigneeRule) StringID() string {
	return fmt.Sprintf("rule-%d", r.ID)
}

// Validate checks the rule is well-formed.
func (r *AssigneeRule) Validate() error {
	if r.Name == "" {
		return ErrRuleNameRequired
	}
	if r.Priority < 0 {
		return ErrRulePriorityNegative
	}
	if !isValidDispatcherType(r.Strategy) {
		return fmt.Errorf("%w: %s", ErrInvalidStrategy, r.Strategy)
	}
	for _, cond := range r.Conditions {
		if err := cond.Validate(); err != nil {
			return fmt.Errorf("condition invalid: %w", err)
		}
	}
	return nil
}

func (cond *Condition) Validate() error {
	if cond.Field == "" {
		return fmt.Errorf("condition field required")
	}
	if cond.Operator == "" {
		return fmt.Errorf("condition operator required")
	}
	return nil
}

func isValidDispatcherType(strategy string) bool {
	for _, t := range AllDispatcherTypes() {
		if t == strategy {
			return true
		}
	}
	return false
}

// --- Work item ---

// WorkItem represents a unit of work to be dispatched.
type WorkItem struct {
	ID           string            `json:"id"`
	TenantID     string            `json:"tenant_id"`
	TargetType   string            `json:"target_type"` // ticket, task, incident, change
	Title        string            `json:"title"`
	Category     string            `json:"category"`
	Priority     string            `json:"priority"`
	Type         string            `json:"type"`
	Source       string            `json:"source"`
	Status       string            `json:"status"`
	Description  string            `json:"description"`
	Metadata     map[string]string `json:"metadata"`
	CreatedAt    time.Time         `json:"created_at"`
	RequiredSkills []string        `json:"required_skills"`
	// Internal
	IsEscalated  bool              `json:"is_escalated"`
	// Priority weight (for routing decisions)
	PriorityWeight int             `json:"priority_weight"`
}

// --- Dispatch result ---

// DispatchResult is the outcome of a dispatch decision.
type DispatchResult struct {
	RuleID       int                `json:"rule_id"`
	RuleName     string             `json:"rule_name"`
	Strategy     string             `json:"strategy"`
	Target       *AssignmentTarget  `json:"target"`
	Score        float64            `json:"score"`
	Reason       string             `json:"reason"`
	Alternatives []AlternativeMatch `json:"alternatives,omitempty"`
	DispatchedAt time.Time          `json:"dispatched_at"`
}

// AlternativeMatch is a ranked candidate that did not win dispatch.
type AlternativeMatch struct {
	Target *AssignmentTarget `json:"target"`
	Score  float64           `json:"score"`
	Reason string            `json:"reason"`
}

// --- Escalation ---

// EscalationLevel defines an escalation tier.
type EscalationLevel struct {
	Level       int               `json:"level"`
	TargetID    string            `json:"target_id"`
	TargetType  string            `json:"target_type"`
	TriggerAfter time.Duration    `json:"trigger_after"`
	NotifyVia   string            `json:"notify_via"` // email, slack, sms
	Message     string            `json:"message"`
}

// EscalationPolicy defines a complete escalation chain.
type EscalationPolicy struct {
	ID          int                 `json:"id" db:"id"`
	TenantID    string              `json:"tenant_id" db:"tenant_id"`
	Name        string              `json:"name" db:"name"`
	Levels      []EscalationLevel   `json:"levels" db:"levels"`
	Enabled     bool                `json:"enabled" db:"enabled"`
	CreatedAt   time.Time           `json:"created_at" db:"created_at"`
}

// --- Capabilities ---

// DispatcherCapabilities describes what the dispatcher can do.
type DispatcherCapabilities struct {
	Types      []string          `json:"types"`
	Strategies []string          `json:"strategies"`
	HasEscalation bool           `json:"has_escalation"`
	HasCooldown bool             `json:"has_cooldown"`
	HasCapacityLimit bool        `json:"has_capacity_limit"`
}

// --- Errors ---

var (
	ErrRuleNotFound         = namedErr("assignee: rule not found")
	ErrRuleNameRequired     = namedErr("assignee: rule name is required")
	ErrRulePriorityNegative = namedErr("assignee: rule priority must be non-negative")
	ErrInvalidStrategy      = namedErr("assignee: invalid dispatcher strategy")
	ErrNoMatchingRule       = namedErr("assignee: no matching rule found")
	ErrNoAvailableAssignee  = namedErr("assignee: no available assignee")
	ErrAssigneeAtCapacity   = namedErr("assignee: assignee at capacity limit")
	ErrEscalationTriggered  = namedErr("assignee: escalation triggered")
	ErrTargetInactive       = namedErr("assignee: target is inactive")
	ErrTargetUnavailable    = namedErr("assignee: target is unavailable")
	ErrTargetNotInWindow    = namedErr("assignee: target not in availability window")
)

type namedErr string

func (e namedErr) Error() string { return string(e) }

// IsNotFound checks if an error represents a not-found condition.
func IsNotFound(err error) bool {
	_, ok := err.(namedErr)
	if ok {
		return err == ErrRuleNotFound || err == ErrNoMatchingRule
	}
	return false
}
