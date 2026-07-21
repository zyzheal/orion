package models

import "time"

// EscalationRule represents an escalation policy.
type EscalationRule struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	Trigger      string    `db:"trigger" json:"trigger"`
	Level        int       `db:"level" json:"level"`
	NotifiedTo   string    `db:"notified_to" json:"notified_to"`
	Description  string    `db:"description" json:"description"`
	Status       string    `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// TriggerRequest is the payload for triggering an escalation rule.
type TriggerRequest struct {
	Message string `json:"message" binding:"required"`
}

// TriggerEvent is the persisted escalation event record.
type TriggerEvent struct {
	ID        string    `db:"id" json:"id"`
	RuleID    string    `db:"rule_id" json:"rule_id"`
	Message   string    `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ListRulesQuery holds optional filter parameters for listing rules.
type ListRulesQuery struct {
	Level  int
	Status string
	Limit  int
	Offset int
}

// EscalationStats holds aggregate stats for escalation rules.
type EscalationStats struct {
	TotalRules  int            `json:"total_rules"`
	ActiveRules int            `json:"active_rules"`
	TotalEvents int            `json:"total_events"`
	ByLevel     map[int]int    `json:"by_level"`
	ByStatus    map[string]int `json:"by_status"`
}
