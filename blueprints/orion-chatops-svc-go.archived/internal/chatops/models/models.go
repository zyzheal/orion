package models

import "time"

type Message struct {
	ID        int64     `json:"id"`
	Platform  string    `json:"platform"`
	Channel   string    `json:"channel"`
	Content   string    `json:"content"`
	Sender    string    `json:"sender"`
	TenantID  string    `json:"tenant_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Conversation struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Platform  string    `json:"platform"`
	TenantID  string    `json:"tenant_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Platform struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Config    string    `json:"config,omitempty"`
	TenantID  string    `json:"tenant_id"`
	CreatedAt time.Time `json:"created_at"`
}

type CommandResult struct {
	Command string      `json:"command"`
	Output  interface{} `json:"output"`
	Error   string      `json:"error,omitempty"`
}
