package models

import "time"

type AuditLog struct {
	ID        int64     `json:"id"`
	Action    string    `json:"action"`
	Resource  string    `json:"resource"`
	Detail    string    `json:"detail"`
	UserID    string    `json:"user_id"`
	TenantID  string    `json:"tenant_id"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"created_at"`
}

type ComplianceCheck struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	Target    string    `json:"target"`
	Status    string    `json:"status"`
	Result    string    `json:"result"`
	TenantID  string    `json:"tenant_id"`
	CreatedAt time.Time `json:"created_at"`
}
