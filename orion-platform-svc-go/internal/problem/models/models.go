package models

import "time"

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// Problem represents an ITIL problem record.
type Problem struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Title       string     `db:"title" json:"title"`
	Description *string    `db:"description" json:"description"`
	Status      string     `db:"status" json:"status"`
	Priority    string     `db:"priority" json:"priority"`
	Severity    *string    `db:"severity" json:"severity"`
	Category    *string    `db:"category" json:"category"`
	AssignedTo  *string    `db:"assigned_to" json:"assignedTo"`
	CreatedBy   *string    `db:"created_by" json:"createdBy"`
	Metadata    *string    `db:"metadata" json:"metadata"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateProblemRequest is the request body for creating a problem.
type CreateProblemRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Severity    *string `json:"severity"`
	Category    *string `json:"category"`
	AssignedTo  *string `json:"assignedTo"`
	CreatedBy   *string `json:"createdBy"`
	Metadata    *string `json:"metadata"`
}

// UpdateProblemRequest is the request body for updating a problem.
type UpdateProblemRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Priority    *string `json:"priority"`
	Severity    *string `json:"severity"`
	Category    *string `json:"category"`
	AssignedTo  *string `json:"assignedTo"`
	Metadata    *string `json:"metadata"`
}

// KnownError represents a known error entry in KEDB.
type KnownError struct {
	ID               string     `db:"id" json:"id"`
	ProblemID        string     `db:"problem_id" json:"problemId"`
	Name             string     `db:"name" json:"name"`
	Symptoms         *string    `db:"symptoms" json:"symptoms"`
	Workaround       *string    `db:"workaround" json:"workaround"`
	RootCause        *string    `db:"root_cause" json:"rootCause"`
	PermanentFix     *string    `db:"permanent_fix" json:"permanentFix"`
	AffectedServices *string    `db:"affected_services" json:"affectedServices"`
	Keywords         *string    `db:"keywords" json:"keywords"`
	CreatedAt        time.Time  `db:"created_at" json:"createdAt"`
}

// CreateKnownErrorRequest is the request body for creating a known error.
type CreateKnownErrorRequest struct {
	ProblemID        string  `json:"problemId" binding:"required"`
	Title            string  `json:"title" binding:"required"`
	Symptoms         *string `json:"symptoms"`
	RootCause        *string `json:"rootCause"`
	Workaround       *string `json:"workaround"`
	PermanentFix     *string `json:"permanentFix"`
	AffectedServices *string `json:"affectedServices"`
	Keywords         *string `json:"keywords"`
	CreatedBy        *string `json:"createdBy"`
}

// UpdateKnownErrorRequest is the request body for updating a known error.
type UpdateKnownErrorRequest struct {
	Title            *string `json:"title"`
	Symptoms         *string `json:"symptoms"`
	RootCause        *string `json:"rootCause"`
	Workaround       *string `json:"workaround"`
	PermanentFix     *string `json:"permanentFix"`
	AffectedServices *string `json:"affectedServices"`
	Keywords         *string `json:"keywords"`
}

// LinkIncidentRequest is the request body for linking an incident.
type LinkIncidentRequest struct {
	IncidentID string `json:"incidentId" binding:"required"`
}

// LinkChangeRequest is the request body for linking a change.
type LinkChangeRequest struct {
	ChangeID string `json:"changeId" binding:"required"`
}

// UpdateStatusRequest is the request body for updating problem status.
type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// ProblemStats holds aggregated statistics for problems.
type ProblemStats struct {
	Total        int            `json:"total"`
	ByStatus     map[string]int `json:"byStatus"`
	ByPriority   map[string]int `json:"byPriority"`
	BySeverity   map[string]int `json:"bySeverity"`
}

// KnownErrorFilter represents filter parameters for listing known errors.
type KnownErrorFilter struct {
	Status   *string
	ProblemID *string
	Limit    int
	Offset   int
}

// ProblemFilter represents filter parameters for listing problems.
type ProblemFilter struct {
	Status    *string
	Severity  *string
	AssignedTo *string
	Category  *string
	Limit     int
	Offset    int
}
