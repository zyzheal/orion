package models

import "time"

type ApkUploadRecord struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenantId" db:"tenant_id"`
	Market    string     `json:"market" db:"market"`
	Version   string     `json:"version" db:"version"`
	Status    string     `json:"status" db:"status"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time  `json:"updatedAt" db:"updated_at"`
}

type ListQuery struct {
	Limit  *int    `json:"limit"`
	Offset *int    `json:"offset"`
	Market string  `json:"market"`
	Status string  `json:"status"`
}
