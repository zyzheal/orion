package models

import "time"

type UEBAAlert struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	UserID      string     `db:"user_id" json:"userId"`
	EntityType  string     `db:"entity_type" json:"entityType"`
	EntityID    string     `db:"entity_id" json:"entityId"`
	EventType   string     `db:"event_type" json:"eventType"`
	Severity    string     `db:"severity" json:"severity"`
	Score       float64    `db:"score" json:"score"`
	AnomalyType string     `db:"anomaly_type" json:"anomalyType"`
	Description *string    `db:"description" json:"description"`
	Evidence    string     `db:"evidence" json:"evidence"`
	Status      string     `db:"status" json:"status"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	ReviewedAt  *time.Time `db:"reviewed_at" json:"reviewedAt"`
}

type UEBAProfile struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenantId"`
	UserID       string    `db:"user_id" json:"userId"`
	EntityType   string    `db:"entity_type" json:"entityType"`
	EntityID     string    `db:"entity_id" json:"entityId"`
	ProfileData  string    `db:"profile_data" json:"profileData"`
	LastUpdateAt time.Time `db:"last_update_at" json:"lastUpdateAt"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
}

type CreateAlertRequest struct {
	UserID      string  `json:"user_id" binding:"required"`
	EntityType  string  `json:"entity_type" binding:"required"`
	EntityID    string  `json:"entity_id" binding:"required"`
	EventType   string  `json:"event_type" binding:"required"`
	Severity    *string `json:"severity"`
	AnomalyType string  `json:"anomaly_type" binding:"required"`
	Description *string `json:"description"`
}

type DismissAlertRequest struct {
	Reason string `json:"reason"`
}

type DetectAnomalyRequest struct {
	UserID     string        `json:"user_id" binding:"required"`
	EntityType string        `json:"entity_type" binding:"required"`
	EntityID   string        `json:"entity_id" binding:"required"`
	Events     []string      `json:"events" binding:"required"`
	Window     time.Duration `json:"window"`
}

type ListAlertsQuery struct {
	UserID   string `form:"user_id"`
	Status   string `form:"status"`
	Severity string `form:"severity"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}
