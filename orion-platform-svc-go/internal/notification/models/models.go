package models

import "time"

// Notification represents a user notification.
type Notification struct {
	ID               string     `db:"id" json:"id"`
	TenantID         string     `db:"tenant_id" json:"tenantId"`
	UserID           string     `db:"user_id" json:"userId"`
	Title            string     `db:"title" json:"title"`
	Body             string     `db:"body" json:"body"`
	NotificationType string     `db:"notification_type" json:"notificationType"`
	Channel          string     `db:"channel" json:"channel"`
	Status           string     `db:"status" json:"status"`
	Priority         string     `db:"priority" json:"priority"`
	Read             bool       `db:"read" json:"read"`
	SourceID         string     `db:"source_id" json:"sourceId"`
	SourceType       string     `db:"source_type" json:"sourceType"`
	Metadata         string     `db:"metadata" json:"metadata"`
	SentAt           *time.Time `db:"sent_at" json:"sentAt"`
	ReadAt           *time.Time `db:"read_at" json:"readAt"`
	CreatedAt        time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateNotificationRequest is the request body for creating a notification.
type CreateNotificationRequest struct {
	Title            string  `json:"title" binding:"required"`
	Body             string  `json:"body" binding:"required"`
	NotificationType string  `json:"notificationType" binding:"required"`
	Channel          string  `json:"channel" binding:"required"`
	Priority         string  `json:"priority"`
	SourceID         *string `json:"sourceId"`
	SourceType       *string `json:"sourceType"`
	Metadata         *string `json:"metadata"`
}

// UpdateNotificationRequest is the request body for updating a notification.
type UpdateNotificationRequest struct {
	Status *string `json:"status"`
	Read   *bool   `json:"read"`
}

// ListFilter represents optional filters for listing notifications.
type ListFilter struct {
	NotificationType *string `json:"notificationType"`
	Channel          *string `json:"channel"`
	Status           *string `json:"status"`
	Priority         *string `json:"priority"`
	Read             *bool   `json:"read"`
	UserID           *string `json:"userId"`
}

// NotificationStats contains aggregate counts for notifications.
type NotificationStats struct {
	Total  int `json:"total"`
	Unread int `json:"unread"`
	Sent   int `json:"sent"`
	Failed int `json:"failed"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
