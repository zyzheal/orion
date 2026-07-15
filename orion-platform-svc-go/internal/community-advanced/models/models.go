package models

import "time"

// CommunityAdvanced represents a community-advanced record.
type CommunityAdvanced struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating a community-advanced entry.
type CreateRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateRequest is the request body for updating a community-advanced entry.
type UpdateRequest struct {
	Name *string `json:"name"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// AwardBadgeRequest is the request body for awarding a badge.
type AwardBadgeRequest struct {
	UserID  string `json:"userId" binding:"required"`
	BadgeID string `json:"badgeId" binding:"required"`
	Reason  string `json:"reason"`
}

// BadgeAward represents an awarded badge.
type BadgeAward struct {
	UserID string `json:"userId"`
	Badge  string `json:"badge"`
	Reason string `json:"reason"`
	At     int64  `json:"at"`
}

// MentorshipRequest is the request body for assigning a mentor.
type MentorshipRequest struct {
	MentorID string `json:"mentorId" binding:"required"`
	MenteeID string `json:"menteeId" binding:"required"`
	Area     string `json:"area"`
}

// Mentorship represents a mentorship pairing.
type Mentorship struct {
	MentorID   string `json:"mentorId"`
	MenteeID   string `json:"menteeId"`
	Area       string `json:"area"`
	Status     string `json:"status"`
	StartedAt  int64  `json:"startedAt"`
}

// VoteRequest is the request body for voting on a best practice.
type VoteRequest struct {
	Value int `json:"value" binding:"required"`
}

// BestPractice represents a best practice entry.
type BestPractice struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Votes  int    `json:"votes"`
}

// IncentiveProgramRequest is the request body for creating an incentive program.
type IncentiveProgramRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Reward      string   `json:"reward"`
	Criteria    []string `json:"criteria"`
}

// IncentiveProgram represents an incentive program.
type IncentiveProgram struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"createdAt"`
}
