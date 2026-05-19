package terminal

import (
	"time"
)

type SessionType string

const (
	SessionTypeSSH SessionType = "SSH"
	SessionTypeRDP SessionType = "RDP"
	SessionTypeVNC SessionType = "VNC"
)

type Session struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	TenantID    int64      `json:"tenant_id" gorm:"index"`
	UserID      string     `json:"user_id" gorm:"index"`
	HostID      string     `json:"host_id" gorm:"index"`
	SessionType string     `json:"session_type"`
	Status      string     `json:"status"` // CONNECTING, ACTIVE, CLOSED
	StartedAt   time.Time  `json:"started_at"`
	ClosedAt    *time.Time `json:"closed_at"`
	Metadata    string     `json:"metadata"` // JSON
}

type SSHConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Key      []byte
}

// ManagedSession wraps Session with SSH client
type ManagedSession struct {
	Session *Session
	Client  *SSHClient
}