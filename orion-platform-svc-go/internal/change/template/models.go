// Package template implements the ChangeTemplate + ChangeSOP + ChangeSopStep
// three-layer model (ADR-015 §4.1, 方案 A).
//
// Table sources:
//   - change_templates (migration 755)
//   - change_sops (migration 756, FK -> change_templates)
//   - change_sop_steps (migration 757, FK -> change_sops)
//
// This package deliberately lives under internal/change/template/ rather
// than internal/change/ because internal/change/ already holds
// ChangeRequest + RFC + CABMeeting models (a different domain concern).
//
// Enum values follow Neatlogic's constvalue definitions (per ADR-015 §2.2):
//   - template_type / sop_type: "standard" | "emergency" | "minor"
//   - authority: "public" | "team" | "private"
package template

import (
	"time"
)

// TemplateType is the value of ChangeTemplate.TemplateType.
type TemplateType string

const (
	TemplateTypeStandard TemplateType = "standard"
	TemplateTypeEmergency TemplateType = "emergency"
	TemplateTypeMinor TemplateType = "minor"
)

// Authority is the visibility level for both templates and SOPs.
type Authority string

const (
	AuthorityPublic Authority = "public"
	AuthorityTeam Authority = "team"
	AuthorityPrivate Authority = "private"
)

// ChangeTemplate is the top layer of ADR-015 方案 A.
// Fields match migration 755 exactly.
type ChangeTemplate struct {
	ID           string      `json:"id"`
	TenantID     string      `json:"tenantId"`
	Name         string      `json:"name"`
	Description  *string     `json:"description,omitempty"`
	IsActive     bool        `json:"isActive"`
	Authority    Authority   `json:"authority"`
	TemplateType TemplateType `json:"templateType"`
	TeamUUID     *string     `json:"teamUuid,omitempty"`
	CreatedBy    string      `json:"createdBy"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

// CreateChangeTemplateRequest is the input for creating a new template.
// Only the writable fields are included; id/tenant_id/created_by/timestamps
// are assigned by the repository.
type CreateChangeTemplateRequest struct {
	Name         string       `json:"name" binding:"required"`
	Description  *string      `json:"description,omitempty"`
	IsActive     *bool        `json:"isActive,omitempty"`     // defaults to true
	Authority    Authority    `json:"authority"`              // defaults to public
	TemplateType TemplateType `json:"templateType"`           // defaults to standard
	TeamUUID     *string      `json:"teamUuid,omitempty"`
}

// UpdateChangeTemplateRequest is the input for partially updating a template.
// All fields are pointers — nil means "don't touch".
type UpdateChangeTemplateRequest struct {
	Name         *string      `json:"name,omitempty"`
	Description  *string      `json:"description,omitempty"`
	IsActive     *bool        `json:"isActive,omitempty"`
	Authority    *Authority   `json:"authority,omitempty"`
	TemplateType *TemplateType `json:"templateType,omitempty"`
	TeamUUID     *string      `json:"teamUuid,omitempty"`
}

// ChangeSOP is the middle layer (作业指导书). Fields match migration 756.
type ChangeSOP struct {
	ID         string      `json:"id"`
	TenantID   string      `json:"tenantId"`
	TemplateID string      `json:"templateId"`
	Name       string      `json:"name"`
	Description *string     `json:"description,omitempty"`
	IsActive   bool        `json:"isActive"`
	Authority  Authority   `json:"authority"`
	SOPType    TemplateType `json:"sopType"` // reuses TemplateType enum per ADR-015 §4.1
	TeamUUID   *string     `json:"teamUuid,omitempty"`
	Version    int32       `json:"version"`
	CreatedBy  string      `json:"createdBy"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
}

// CreateChangeSOPRequest is the input for creating a new SOP under a template.
type CreateChangeSOPRequest struct {
	TemplateID  string       `json:"templateId" binding:"required"`
	Name        string       `json:"name" binding:"required"`
	Description *string      `json:"description,omitempty"`
	IsActive    *bool        `json:"isActive,omitempty"`
	Authority   Authority    `json:"authority"`
	SOPType     TemplateType `json:"sopType"`
	TeamUUID    *string      `json:"teamUuid,omitempty"`
}

// UpdateChangeSOPRequest is the input for partially updating a SOP.
type UpdateChangeSOPRequest struct {
	Name        *string      `json:"name,omitempty"`
	Description *string      `json:"description,omitempty"`
	IsActive    *bool        `json:"isActive,omitempty"`
	Authority   *Authority   `json:"authority,omitempty"`
	SOPType     *TemplateType `json:"sopType,omitempty"`
	TeamUUID    *string      `json:"teamUuid,omitempty"`
	// ExpectedVersion is optional. If set, the repository performs an
	// optimistic-lock UPDATE ... WHERE version = $expectedVersion and
	// returns ErrVersionMismatch if the row's version differs.
	ExpectedVersion *int32 `json:"expectedVersion,omitempty"`
}

// ChangeSopStep is the bottom layer (步骤). Fields match migration 757.
type ChangeSopStep struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenantId"`
	SOPID          string     `json:"sopId"`
	Code           string     `json:"code"`
	Name           string     `json:"name"`
	Content        *string    `json:"content,omitempty"`
	PlanStartDate  *time.Time `json:"planStartDate,omitempty"` // DATE, midnight UTC
	StartTimeWindow *string   `json:"startTimeWindow,omitempty"`
	EndTimeWindow  *string    `json:"endTimeWindow,omitempty"`
	Worker         *string    `json:"worker,omitempty"`
	FileIDs        []string   `json:"fileIds"`
	SortOrder      int32      `json:"sortOrder"`
	Version        int32      `json:"version"`
	CreatedBy      string     `json:"createdBy"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

// CreateChangeSopStepRequest is the input for creating a new step under a SOP.
type CreateChangeSopStepRequest struct {
	SOPID           string     `json:"sopId" binding:"required"`
	Code            string     `json:"code" binding:"required"`
	Name            string     `json:"name" binding:"required"`
	Content         *string    `json:"content,omitempty"`
	PlanStartDate   *time.Time `json:"planStartDate,omitempty"`
	StartTimeWindow *string    `json:"startTimeWindow,omitempty"`
	EndTimeWindow   *string    `json:"endTimeWindow,omitempty"`
	Worker          *string    `json:"worker,omitempty"`
	FileIDs         []string   `json:"fileIds"`
	SortOrder       int32      `json:"sortOrder"`
}

// UpdateChangeSopStepRequest is the input for partially updating a step.
type UpdateChangeSopStepRequest struct {
	Code            *string    `json:"code,omitempty"`
	Name            *string    `json:"name,omitempty"`
	Content         *string    `json:"content,omitempty"`
	PlanStartDate   *time.Time `json:"planStartDate,omitempty"`
	StartTimeWindow *string    `json:"startTimeWindow,omitempty"`
	EndTimeWindow   *string    `json:"endTimeWindow,omitempty"`
	Worker          *string    `json:"worker,omitempty"`
	FileIDs         []string   `json:"fileIds,omitempty"`
	SortOrder       *int32     `json:"sortOrder,omitempty"`
	ExpectedVersion *int32     `json:"expectedVersion,omitempty"`
}

// SOPDetail is a SOP enriched with its steps, ordered by sort_order ASC.
type SOPDetail struct {
	ChangeSOP
	Steps []*ChangeSopStep `json:"steps"`
}
