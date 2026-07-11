package models

import "time"

// ==================== Change Request ====================

type ChangeRequest struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Title         string     `db:"title" json:"title"`
	Description   *string    `db:"description" json:"description,omitempty"`
	Type          string     `db:"type" json:"type"`
	Priority      string     `db:"priority" json:"priority"`
	RiskLevel     string     `db:"risk_level" json:"risk_level"`
	Status        string     `db:"status" json:"status"`
	AssignedTo    *string    `db:"assigned_to" json:"assigned_to,omitempty"`
	RequesterID   string     `db:"requester_id" json:"requester_id"`
	CreatedBy     string     `db:"created_by" json:"created_by"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateChangeRequestRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Type        string  `json:"type"`     // standard, normal, emergency
	Priority    string  `json:"priority"`
	RiskLevel   string  `json:"risk_level"`
	AssignedTo  *string `json:"assigned_to"`
	RequesterID string  `json:"requester_id"`
}

type UpdateChangeRequestRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Type        *string `json:"type"`
	Priority    *string `json:"priority"`
	RiskLevel   *string `json:"risk_level"`
	Status      *string `json:"status"`
	AssignedTo  *string `json:"assigned_to"`
}

// ==================== RFC ====================

type RFC struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	ChangeRequestID string    `db:"change_request_id" json:"change_request_id"`
	RFCNumber       string    `db:"rfc_number" json:"rfc_number"`
	Title           string    `db:"title" json:"title"`
	Description     *string   `db:"description" json:"description,omitempty"`
	Status          string    `db:"status" json:"status"`
	CreatedBy       string    `db:"created_by" json:"created_by"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type CreateRFCRequest struct {
	ChangeRequestID string  `json:"change_request_id" binding:"required"`
	RFCNumber       string  `json:"rfc_number" binding:"required"`
	Title           string  `json:"title" binding:"required"`
	Description     *string `json:"description"`
}

type UpdateRFCRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// ==================== CAB Meeting ====================

type CABMeeting struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Title       string    `db:"title" json:"title"`
	Description *string   `db:"description" json:"description,omitempty"`
	Status      string    `db:"status" json:"status"`
	ScheduledAt time.Time `db:"scheduled_at" json:"scheduled_at"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateCABMeetingRequest struct {
	Title       string    `json:"title" binding:"required"`
	Description *string   `json:"description"`
	ScheduledAt time.Time `json:"scheduled_at" binding:"required"`
}

type UpdateCABMeetingRequest struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Status      *string    `json:"status"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

// ==================== CAB Decision ====================

type CABDecision struct {
	ID             string    `db:"id" json:"id"`
	CABMeetingID   string    `db:"cab_meeting_id" json:"cab_meeting_id"`
	ChangeRequestID string   `db:"change_request_id" json:"change_request_id"`
	Decision       string    `db:"decision" json:"decision"`
	Notes          *string   `db:"notes" json:"notes,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type AddCABDecisionRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Decision       string `json:"decision" binding:"required"`
	Notes          *string `json:"notes"`
}

// ==================== Timeline Event ====================

type ChangeTimelineEvent struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ChangeRequestID string   `db:"change_request_id" json:"change_request_id"`
	EventType      string    `db:"event_type" json:"event_type"`
	Description    string    `db:"description" json:"description"`
	ActorID        string    `db:"actor_id" json:"actor_id"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type AddTimelineEventRequest struct {
	EventType   string `json:"event_type" binding:"required"`
	Description string `json:"description" binding:"required"`
}