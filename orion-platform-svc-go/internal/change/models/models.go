package models

import (
	"encoding/json"
	"time"
)

// --- Change Request ---

type ChangeRequest struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"`           // draft, submitted, approved, in_progress, completed, rejected, cancelled
	ChangeType  string    `json:"change_type" db:"change_type"` // standard, normal, emergency
	Priority    string    `json:"priority" db:"priority"`       // low, medium, high, critical
	RiskLevel   string    `json:"risk_level" db:"risk_level"`   // low, medium, high
	AssignedTo  string    `json:"assigned_to" db:"assigned_to"`
	RequesterID string    `json:"requester_id" db:"requester_id"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateChangeRequestRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	ChangeType  string `json:"change_type"`
	Priority    string `json:"priority"`
	RiskLevel   string `json:"risk_level"`
	AssignedTo  string `json:"assigned_to"`
	RequesterID string `json:"requester_id"`
}

type UpdateChangeRequestRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	ChangeType  *string `json:"change_type"`
	Priority    *string `json:"priority"`
	RiskLevel   *string `json:"risk_level"`
	AssignedTo  *string `json:"assigned_to"`
}

type ChangeRequestListQuery struct {
	Status      *string `json:"status"`
	Type        *string `json:"type"`
	Priority    *string `json:"priority"`
	RiskLevel   *string `json:"risk_level"`
	AssignedTo  *string `json:"assigned_to"`
	RequesterID *string `json:"requester_id"`
	Limit       int     `json:"limit"`
	Offset      int     `json:"offset"`
}

// --- Timeline Event ---

type TimelineEvent struct {
	ID              string           `json:"id" db:"id"`
	ChangeRequestID string           `json:"change_request_id" db:"change_request_id"`
	TenantID        string           `json:"tenant_id" db:"tenant_id"`
	EventType       string           `json:"event_type" db:"event_type"`
	Description     string           `json:"description" db:"description"`
	Metadata        *json.RawMessage `json:"metadata,omitempty" db:"metadata"`
	CreatedBy       string           `json:"created_by" db:"created_by"`
	CreatedAt       time.Time        `json:"created_at" db:"created_at"`
}

type CreateTimelineEventRequest struct {
	EventType   string                 `json:"event_type" binding:"required"`
	Description string                 `json:"description" binding:"required"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// --- Status transition ---

type StatusTransitionRequest struct {
	Status string `json:"status" binding:"required"`
	Reason string `json:"reason"`
}

// --- RFC ---

type RFC struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	ChangeRequestID string    `json:"change_request_id" db:"change_request_id"`
	RFCNumber       string    `json:"rfc_number" db:"rfc_number"`
	Title           string    `json:"title" db:"title"`
	Description     string    `json:"description" db:"description"`
	Status          string    `json:"status" db:"status"` // draft, submitted, approved, rejected
	CreatedBy       string    `json:"created_by" db:"created_by"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type CreateRFCRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	RFCNumber       string `json:"rfc_number" binding:"required"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	Status          string `json:"status"`
}

type UpdateRFCRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// --- CAB Meeting ---

type CABMeeting struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"` // scheduled, in_progress, completed, cancelled
	ScheduledAt time.Time `json:"scheduled_at" db:"scheduled_at"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateCABMeetingRequest struct {
	Title       string    `json:"title" binding:"required"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	ScheduledAt time.Time `json:"scheduled_at" binding:"required"`
}

type UpdateCABMeetingRequest struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Status      *string    `json:"status"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

type CABMeetingListQuery struct {
	Status *string `json:"status"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}

// --- CAB Decision ---

type CABDecision struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	CABMeetingID    string    `json:"cab_meeting_id" db:"cab_meeting_id"`
	ChangeRequestID string    `json:"change_request_id" db:"change_request_id"`
	Decision        string    `json:"decision" db:"decision"` // approved, rejected, deferred
	Notes           string    `json:"notes" db:"notes"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type CreateCABDecisionRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Decision        string `json:"decision" binding:"required"`
	Notes           string `json:"notes"`
}

// --- Statistics ---

type ChangeStats struct {
	Total       int            `json:"total"`
	Open        int            `json:"open"`
	Approved    int            `json:"approved"`
	Rejected    int            `json:"rejected"`
	InProgress  int            `json:"in_progress"`
	Completed   int            `json:"completed"`
	ByType      map[string]int `json:"by_type"`
	ByPriority  map[string]int `json:"by_priority"`
	ByRiskLevel map[string]int `json:"by_risk_level"`
}

// --- List result with pagination ---

type ListResult[T any] struct {
	Data  []T `json:"data"`
	Total int `json:"total"`
}
