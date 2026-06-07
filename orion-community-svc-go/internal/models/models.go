package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a wrapper around map[string]interface{} for PostgreSQL JSONB columns.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// StringArray is a wrapper around []string for PostgreSQL text[] columns.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// ============================================================
// Contribution
// ============================================================

type Contribution struct {
	ID          string       `db:"id" json:"id"`
	TenantID    string       `db:"tenant_id" json:"tenant_id"`
	UserID      string       `db:"user_id" json:"user_id"`
	Type        string       `db:"type" json:"type"`
	Title       string       `db:"title" json:"title"`
	Description string       `db:"description" json:"description"`
	Repository  *string      `db:"repository" json:"repository,omitempty"`
	URL         *string      `db:"url" json:"url,omitempty"`
	Tags        StringArray  `db:"tags" json:"tags"`
	Status      string       `db:"status" json:"status"`
	CreatedAt   time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time    `db:"updated_at" json:"updated_at"`
}

type CreateContributionRequest struct {
	UserID      string   `json:"user_id" binding:"required"`
	Type        string   `json:"type" binding:"required"`
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Repository  *string  `json:"repository,omitempty"`
	URL         *string  `json:"url,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

type ContributionFilters struct {
	Type   string   `form:"type"`
	Status string   `form:"status"`
	UserID string   `form:"user_id"`
	Tags   []string `form:"tags"`
}

// ============================================================
// BestPractice
// ============================================================

type BestPractice struct {
	ID          string      `db:"id" json:"id"`
	TenantID    string      `db:"tenant_id" json:"tenant_id"`
	Title       string      `db:"title" json:"title"`
	Description string      `db:"description" json:"description"`
	Category    string      `db:"category" json:"category"`
	Tags        StringArray `db:"tags" json:"tags"`
	Content     string      `db:"content" json:"content"`
	AuthorID    string      `db:"author_id" json:"author_id"`
	AuthorName  string      `db:"author_name" json:"author_name"`
	Status      string      `db:"status" json:"status"`
	Votes       int         `db:"votes" json:"votes"`
	Views       int         `db:"views" json:"views"`
	CreatedAt   time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time   `db:"updated_at" json:"updated_at"`
}

type CreateBestPracticeRequest struct {
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Category    string   `json:"category" binding:"required"`
	Tags        []string `json:"tags,omitempty"`
	Content     string   `json:"content" binding:"required"`
	AuthorID    string   `json:"author_id" binding:"required"`
	AuthorName  string   `json:"author_name,omitempty"`
}

type BestPracticeFilters struct {
	Category string   `form:"category"`
	Status   string   `form:"status"`
	AuthorID string   `form:"author_id"`
	Tags     []string `form:"tags"`
	Search   string   `form:"search"`
}

// ============================================================
// Contributor
// ============================================================

type Contributor struct {
	UserID        string      `db:"user_id" json:"user_id"`
	Username      string      `db:"username" json:"username"`
	Contributions int         `db:"contributions" json:"contributions"`
	Types         StringArray `db:"types" json:"types"`
	JoinedAt      time.Time   `db:"joined_at" json:"joined_at"`
	Reputation    int         `db:"reputation" json:"reputation"`
	Badges        StringArray `db:"badges" json:"badges,omitempty"`
}

// ============================================================
// CommunityPlugin
// ============================================================

type CommunityPlugin struct {
	ID            string      `db:"id" json:"id"`
	TenantID      string      `db:"tenant_id" json:"tenant_id"`
	Name          string      `db:"name" json:"name"`
	Version       string      `db:"version" json:"version"`
	Description   string      `db:"description" json:"description"`
	Author        string      `db:"author" json:"author"`
	Category      string      `db:"category" json:"category"`
	Repository    string      `db:"repository" json:"repository"`
	Compatibility StringArray `db:"compatibility" json:"compatibility"`
	Status        string      `db:"status" json:"status"`
	ReviewComment *string     `db:"review_comment" json:"review_comment,omitempty"`
	SubmittedAt   time.Time   `db:"submitted_at" json:"submitted_at"`
	ReviewedAt    *time.Time  `db:"reviewed_at" json:"reviewed_at,omitempty"`
}

type CreatePluginRequest struct {
	Name          string   `json:"name" binding:"required"`
	Version       string   `json:"version" binding:"required"`
	Description   string   `json:"description" binding:"required"`
	Author        string   `json:"author" binding:"required"`
	Category      string   `json:"category" binding:"required"`
	Repository    string   `json:"repository" binding:"required"`
	Compatibility []string `json:"compatibility,omitempty"`
}

type PluginFilters struct {
	Category string `form:"category"`
	Status   string `form:"status"`
	Author   string `form:"author"`
}

type ReviewPluginRequest struct {
	Action  string `json:"action" binding:"required"` // "approve" or "reject"
	Comment string `json:"comment" binding:"required"`
}

// ============================================================
// Badge
// ============================================================

type Badge struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	Type        string    `db:"type" json:"type"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	AwardedAt   time.Time `db:"awarded_at" json:"awarded_at"`
}

type BadgeDefinition struct {
	Type        string `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Criteria    string `json:"criteria"`
}

// ============================================================
// IncentiveProgram
// ============================================================

type IncentiveProgram struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Config      JSONB     `db:"config" json:"config"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateIncentiveProgramRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description,omitempty"`
	Config      map[string]interface{} `json:"config" binding:"required"`
}

// ============================================================
// MentorshipPair
// ============================================================

type MentorshipPair struct {
	ID         string      `db:"id" json:"id"`
	TenantID   string      `db:"tenant_id" json:"tenant_id"`
	MentorID   string      `db:"mentor_id" json:"mentor_id"`
	MenteeID   string      `db:"mentee_id" json:"mentee_id"`
	Status     string      `db:"status" json:"status"`
	AssignedAt time.Time   `db:"assigned_at" json:"assigned_at"`
	Goals      StringArray `db:"goals" json:"goals,omitempty"`
}

type AssignMentorRequest struct {
	MentorID string   `json:"mentor_id" binding:"required"`
	MenteeID string   `json:"mentee_id" binding:"required"`
	Goals    []string `json:"goals,omitempty"`
}

// ============================================================
// Pagination
// ============================================================

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

type PaginatedResponse struct {
	Data  interface{} `json:"data"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Size  int         `json:"page_size"`
}
