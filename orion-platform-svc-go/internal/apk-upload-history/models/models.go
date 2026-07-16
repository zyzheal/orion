package models

import "time"

// ApkStatus represents the upload status.
type ApkStatus string

const (
	StatusUploaded ApkStatus = "uploaded"
	StatusFailed   ApkStatus = "failed"
	StatusPending  ApkStatus = "pending"
)

// ApkUploadRecord tracks an APK upload.
type ApkUploadRecord struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Market      string    `json:"market" db:"market"`
	PackageName string    `json:"package_name" db:"package_name"`
	Version     string    `json:"version" db:"version"`
	VersionCode int       `json:"version_code" db:"version_code"`
	FileName    string    `json:"file_name" db:"file_name"`
	FileSize    int64     `json:"file_size" db:"file_size"`
	Checksum    string    `json:"checksum" db:"checksum"`
	Status      ApkStatus `json:"status" db:"status"`
	UploadedBy  string    `json:"uploaded_by" db:"uploaded_by"`
	ErrorMsg    string    `json:"error_msg" db:"error_msg"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ApkUploadStats aggregates upload statistics.
type ApkUploadStats struct {
	TotalUploads  int `json:"totalUploads"`
	SuccessCount  int `json:"successCount"`
	FailedCount   int `json:"failedCount"`
	TotalSize     int64 `json:"totalSize"`
	LastUploadAt  time.Time `json:"lastUploadAt"`
}

// CreateRecordRequest creates an upload record.
type CreateRecordRequest struct {
	Market      string  `json:"market" binding:"required"`
	PackageName string  `json:"package_name" binding:"required"`
	Version     string  `json:"version" binding:"required"`
	VersionCode int     `json:"version_code"`
	FileName    string  `json:"file_name" binding:"required"`
	FileSize    int64   `json:"file_size"`
	Checksum    string  `json:"checksum"`
	UploadedBy  string  `json:"uploaded_by"`
}

// ListQuery filters upload records.
type ListQuery struct {
	Limit    *int    `json:"limit"`
	Offset   *int    `json:"offset"`
	Market   string  `json:"market"`
	Status   string  `json:"status"`
	PackageName string `json:"package_name"`
}
