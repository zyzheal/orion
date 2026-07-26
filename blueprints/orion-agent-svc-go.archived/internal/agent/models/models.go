package models

import "time"

type Agent struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Version   string    `json:"version"`
	Status    string    `json:"status"`
	Tags      string    `json:"tags"`
	TenantID  string    `json:"tenant_id"`
	LastSeen  time.Time `json:"last_seen"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AgentRun struct {
	ID        int64     `json:"id"`
	AgentID   int64     `json:"agent_id"`
	TaskID    string    `json:"task_id"`
	Status    string    `json:"status"`
	Output    string    `json:"output"`
	StartedAt time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}
