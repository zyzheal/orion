package models

import "time"

type CodeRepo struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Provider  string    `json:"provider"`
	TenantID  string    `json:"tenant_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Branch struct {
	ID        int64     `json:"id"`
	RepoID    int64     `json:"repo_id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
}

type Commit struct {
	SHA      string    `json:"sha"`
	Message  string    `json:"message"`
	Author   string    `json:"author"`
	Branch   string    `json:"branch"`
	RepoID   int64     `json:"repo_id"`
	AuthoredAt time.Time `json:"authored_at"`
}
