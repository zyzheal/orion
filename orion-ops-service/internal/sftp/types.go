package sftp

import (
	"time"
)

// TransferStatus represents the status of a file transfer
type TransferStatus string

const (
	TransferStatusPending   TransferStatus = "PENDING"
	TransferStatusRunning   TransferStatus = "RUNNING"
	TransferStatusCompleted TransferStatus = "COMPLETED"
	TransferStatusFailed    TransferStatus = "FAILED"
)

// FileTransfer represents a file transfer record
type FileTransfer struct {
	ID          string          `json:"id" gorm:"primaryKey"`
	TenantID    int64           `json:"tenant_id" gorm:"index"`
	UserID      string          `json:"user_id" gorm:"index"`
	Direction   string          `json:"direction"` // UPLOAD, DOWNLOAD
	HostID      string          `json:"host_id" gorm:"index"`
	RemotePath  string          `json:"remote_path"`
	LocalPath   string          `json:"local_path"`
	FileName    string          `json:"file_name"`
	FileSize    int64           `json:"file_size"`
	Transferred int64           `json:"transferred"`
	Status      TransferStatus  `json:"status" gorm:"default:PENDING"`
	Error       string          `json:"error"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	CompletedAt *time.Time      `json:"completed_at"`
}

// TransferRequest represents a file transfer request
type TransferRequest struct {
	TenantID   int64  `json:"tenant_id" binding:"required"`
	UserID     string `json:"user_id" binding:"required"`
	HostID     string `json:"host_id" binding:"required"`
	RemotePath string `json:"remote_path" binding:"required"`
	LocalPath  string `json:"local_path" binding:"required"`
	Direction  string `json:"direction" binding:"required"` // UPLOAD or DOWNLOAD
}