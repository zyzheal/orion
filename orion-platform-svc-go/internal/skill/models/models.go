package models

import "time"

type Skill struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	Name         string    `json:"name" db:"name"`
	Description  string    `json:"description" db:"description"`
	Category     string    `json:"category" db:"category"`
	Status       string    `json:"status" db:"status"` // draft, submitted, approved, archived
	InstallCount int       `json:"install_count" db:"install_count"`
	AvgRating    float64   `json:"avg_rating" db:"avg_rating"`
	RatingCount  int       `json:"rating_count" db:"rating_count"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreateSkillRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

type UpdateSkillRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
}

// --- Skill version ---

type SkillVersion struct {
	ID        string    `json:"id" db:"id"`
	SkillID   string    `json:"skill_id" db:"skill_id"`
	Version   string    `json:"version" db:"version"`
	Changes   string    `json:"changes" db:"changes"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type AddVersionRequest struct {
	Version string `json:"version" binding:"required"`
	Changes string `json:"changes"`
}

// --- Skill rating ---

type RateSkillRequest struct {
	Rating int `json:"rating" binding:"required,min=1,max=5"`
}

// --- Skill instance (tenant-scoped) ---

type SkillInstance struct {
	ID        string    `json:"id" db:"id"`
	SkillID   string    `json:"skill_id" db:"skill_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	InstanceName string `json:"instance_name" db:"instance_name"`
	Config    string    `json:"config" db:"config"` // JSON
	Status    string    `json:"status" db:"status"` // active, inactive
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateInstanceRequest struct {
	InstanceName string `json:"instance_name" binding:"required"`
	Config       string `json:"config"`
}

type UpdateInstanceRequest struct {
	InstanceName *string `json:"instance_name"`
	Config       *string `json:"config"`
	Status       *string `json:"status"`
}

// --- Skill execution ---

type SkillExecution struct {
	ID        string    `json:"id" db:"id"`
	SkillID   string    `json:"skill_id" db:"skill_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Input     string    `json:"input" db:"input"` // JSON
	Output    string    `json:"output" db:"output"` // JSON
	Status    string    `json:"status" db:"status"` // pending, running, completed, failed
	DurationMs int64    `json:"duration_ms" db:"duration_ms"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type ExecuteSkillRequest struct {
	Input map[string]interface{} `json:"input"`
}

// --- Review workflow ---

type SkillReview struct {
	ID        string    `json:"id" db:"id"`
	SkillID   string    `json:"skill_id" db:"skill_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Status    string    `json:"status" db:"status"` // submitted, approved, rejected, archived
	SubmittedBy string `json:"submitted_by" db:"submitted_by"`
	ReviewedBy string   `json:"reviewed_by" db:"reviewed_by"`
	ReviewNote string   `json:"review_note" db:"review_note"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type ReviewActionRequest struct {
	Note string `json:"note"`
}

// --- Audit log ---

type SkillAuditLog struct {
	ID        int       `json:"id" db:"id"`
	SkillID   string    `json:"skill_id" db:"skill_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Action    string    `json:"action" db:"action"`
	UserID    string    `json:"user_id" db:"user_id"`
	Details   string    `json:"details" db:"details"` // JSON
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
