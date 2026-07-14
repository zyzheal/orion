package models

import "time"

type MFADevice struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	UserID       string    `db:"user_id" json:"userId"`
	Type         string    `db:"type" json:"type"` // totp|sms|email
	Secret       string    `db:"secret" json:"secret"`
	Digits       int       `db:"digits" json:"digits"`
	Period       int       `db:"period" json:"period"`
	Issuer       string    `db:"issuer" json:"issuer"`
	Label        string    `db:"label" json:"label"`
	Status       string    `db:"status" json:"status"` // active|inactive
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
}

type CreateMFADeviceRequest struct {
	Type    string `json:"type" binding:"required"`
	Issuer  string `json:"issuer"`
	Label   string `json:"label"`
	Digits  int    `json:"digits"`
	Period  int    `json:"period"`
}

type VerifyMFACodeRequest struct {
	Code string `json:"code" binding:"required"`
}

type MFADeviceFilter struct {
	Type   *string `json:"type"`
	Status *string `json:"status"`
}
