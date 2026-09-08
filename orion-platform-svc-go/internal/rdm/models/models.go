package models

import "time"

// 错误类型
var (
	ErrRequirementNotFound = errNotFound("requirement")
	ErrDefectNotFound      = errNotFound("defect")
	ErrSprintNotFound      = errNotFound("sprint")
	ErrTaskNotFound        = errNotFound("task")
	ErrDocumentNotFound    = errNotFound("document")
	ErrCodeReviewNotFound  = errNotFound("code review")
	ErrReleaseNotFound     = errNotFound("release")
)

type errNotFoundMsg string

func (e errNotFoundMsg) Error() string { return string(e) + " not found" }

func errNotFound(kind string) error { return errNotFoundMsg(kind) }

// 公共字段
type BaseEntity struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	ProjectID string    `json:"project_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ── Requirement ──

type Requirement struct {
	BaseEntity
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Priority      string   `json:"priority"` // critical|high|medium|low
	Status        string   `json:"status"`   // backlog|pending|in_progress|done
	Type          string   `json:"type"`     // feature|bug|tech_debt|other
	StoryPoints   *int     `json:"story_points"`
	Assignee      *string  `json:"assignee"`
	SprintID      *string  `json:"sprint_id"`
	ParentID      *string  `json:"parent_id"`
	Labels        []string `json:"labels"`
}

type CreateRequirementInput struct {
	ProjectID   string   `json:"project_id" binding:"required"`
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description"`
	Priority    string   `json:"priority"`
	Type        string   `json:"type"`
	StoryPoints *int     `json:"story_points"`
	Assignee    *string  `json:"assignee"`
	SprintID    *string  `json:"sprint_id"`
	ParentID    *string  `json:"parent_id"`
	Labels      []string `json:"labels"`
}

// ── Defect ──

type Defect struct {
	BaseEntity
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Severity         string   `json:"severity"` // critical|major|minor|cosmetic
	Status           string   `json:"status"`   // open|in_progress|fixed|verified|closed|rejected
	Environment      string   `json:"environment"`
	Reporter         string   `json:"reporter"`
	Assignee         *string  `json:"assignee"`
	ScreenshotURL    *string  `json:"screenshot_url"`
	StepsToReproduce *string  `json:"steps_to_reproduce"`
	Labels           []string `json:"labels"`
}

type CreateDefectInput struct {
	ProjectID        string   `json:"project_id" binding:"required"`
	Title            string   `json:"title" binding:"required"`
	Description      string   `json:"description"`
	Severity         string   `json:"severity"`
	Environment      string   `json:"environment"`
	StepsToReproduce *string  `json:"steps_to_reproduce"`
	Labels           []string `json:"labels"`
}

// ── Sprint ──

type Sprint struct {
	BaseEntity
	Name            string `json:"name"`
	Goal            string `json:"goal"`
	StartDate       string `json:"start_date"`
	EndDate         string `json:"end_date"`
	Status          string `json:"status"` // planning|active|completed|cancelled
	Capacity        *int   `json:"capacity"`
	TotalPoints     int    `json:"total_points"`
	CompletedPoints int    `json:"completed_points"`
}

type CreateSprintInput struct {
	ProjectID string `json:"project_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Goal      string `json:"goal"`
	StartDate string `json:"start_date" binding:"required"`
	EndDate   string `json:"end_date" binding:"required"`
	Capacity  *int   `json:"capacity"`
}

// ── Task ──

type Task struct {
	BaseEntity
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Status        string   `json:"status"`   // todo|in_progress|review|done
	Priority      string   `json:"priority"` // high|medium|low
	Assignee      *string  `json:"assignee"`
	RequirementID *string  `json:"requirement_id"`
	StoryPoints   *int     `json:"story_points"`
	Labels        []string `json:"labels"`
}

type CreateTaskInput struct {
	ProjectID     string  `json:"project_id" binding:"required"`
	Title         string  `json:"title" binding:"required"`
	Description   string  `json:"description"`
	Priority      string  `json:"priority"`
	Assignee      *string `json:"assignee"`
	RequirementID *string `json:"requirement_id"`
	StoryPoints   *int    `json:"story_points"`
}

// ── Document ──

type Document struct {
	BaseEntity
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Version int      `json:"version"`
	Author  string   `json:"author"`
	Status  string   `json:"status"` // draft|published|archived
	Tags    []string `json:"tags"`
}

type CreateDocumentInput struct {
	ProjectID string   `json:"project_id" binding:"required"`
	Title     string   `json:"title" binding:"required"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
}

// ── CodeReview ──

type CodeReview struct {
	BaseEntity
	Title         string   `json:"title"`
	SourceBranch  string   `json:"source_branch"`
	TargetBranch  string   `json:"target_branch"`
	SourceCommit  string   `json:"source_commit"`
	Status        string   `json:"status"` // pending|approved|changes_requested|merged|closed
	Author        string   `json:"author"`
	Reviewers     []string `json:"reviewers"`
	CommentsCount int      `json:"comments_count"`
}

type CreateCodeReviewInput struct {
	ProjectID    string   `json:"project_id" binding:"required"`
	Title        string   `json:"title" binding:"required"`
	SourceBranch string   `json:"source_branch" binding:"required"`
	TargetBranch string   `json:"target_branch" binding:"required"`
	SourceCommit string   `json:"source_commit"`
	Reviewers    []string `json:"reviewers"`
}

type CodeReviewComment struct {
	ID        string    `json:"id"`
	ReviewID  string    `json:"review_id"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	File      *string   `json:"file"`
	Line      *int      `json:"line"`
	CreatedAt time.Time `json:"created_at"`
}

// ── Release ──

type Release struct {
	BaseEntity
	Name          string   `json:"name"`
	Version       string   `json:"version"`
	Description   string   `json:"description"`
	Status        string   `json:"status"` // planned|in_progress|completed|cancelled
	TargetDate    *string  `json:"target_date"`
	ReleaseDate   *string  `json:"release_date"`
	Requirements  []string `json:"requirements"`
	Defects       []string `json:"defects"`
}

type CreateReleaseInput struct {
	ProjectID   string  `json:"project_id" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Version     string  `json:"version" binding:"required"`
	Description string  `json:"description"`
	TargetDate  *string `json:"target_date"`
}

// ── Statistics ──

type BurndownPoint struct {
	Date           string `json:"date"`
	RemainingPoints int   `json:"remaining_points"`
	IdealPoints    int    `json:"ideal_points"`
}

type VelocityPoint struct {
	Sprint          string `json:"sprint"`
	CompletedPoints int    `json:"completed_points"`
}

type DefectStatsResponse struct {
	BySeverity []CountItem `json:"by_severity"`
	ByStatus   []CountItem `json:"by_status"`
}

type SprintStatItem struct {
	SprintID        string `json:"sprint_id"`
	SprintName      string `json:"sprint_name"`
	TotalTasks      int    `json:"total_tasks"`
	CompletedTasks  int    `json:"completed_tasks"`
	TotalPoints     int    `json:"total_points"`
	CompletedPoints int    `json:"completed_points"`
}

type CountItem struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}
