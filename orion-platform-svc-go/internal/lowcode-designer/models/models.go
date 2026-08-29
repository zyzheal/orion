package models

import "time"

// --- Form Definition ---

type FormDefinition struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	Name        string    `db:"name" json:"name"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	Version     int       `db:"version" json:"version"`
	Status      string    `db:"status" json:"status"`
	Category    string    `db:"category" json:"category"`
	ModuleName  string    `db:"module_name" json:"moduleName"`
	Tags        string    `db:"tags" json:"-"`
	Layout      string    `db:"layout" json:"-"`
	FieldsJSON  string    `db:"fields" json:"-"`
	Meta        string    `db:"meta" json:"-"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
	UpdatedBy   string    `db:"updated_by" json:"updatedBy"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`

	TagsList   []string               `json:"tags,omitempty"`
	LayoutData map[string]interface{} `json:"layout,omitempty"`
	FieldsList []FormField            `json:"fields,omitempty"`
	MetaData   map[string]interface{} `json:"meta,omitempty"`
}

// --- Form Field ---

type FormField struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenantId"`
	FormID        string    `db:"form_id" json:"formId"`
	Key           string    `db:"key" json:"key"`
	Label         string    `db:"label" json:"label"`
	Type          string    `db:"type" json:"type"`
	Required      bool      `db:"required" json:"required"`
	Visible       bool      `db:"visible" json:"visible"`
	Disabled      bool      `db:"disabled" json:"disabled"`
	Placeholder   string    `db:"placeholder" json:"placeholder"`
	DefaultVal    string    `db:"default_val" json:"-"`
	Options       string    `db:"options" json:"-"`
	Rules         string    `db:"rules" json:"-"`
	Meta          string    `db:"meta" json:"-"`
	LayoutConfig  string    `db:"layout_config" json:"-"`
	SortableIndex int       `db:"sortable_index" json:"sortableIndex"`
	ParentKey     string    `db:"parent_key" json:"parentKey,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time `db:"updated_at" json:"updatedAt"`

	DefaultValData interface{}            `json:"defaultVal,omitempty"`
	OptionsList    []interface{}          `json:"options,omitempty"`
	RulesList      []interface{}          `json:"rules,omitempty"`
	MetaData       map[string]interface{} `json:"meta,omitempty"`
	LayoutData     map[string]interface{} `json:"layoutConfig,omitempty"`
}

// --- Form Template ---

type FormTemplate struct {
	ID             string                 `db:"id" json:"id"`
	TenantID       string                 `db:"tenant_id" json:"tenantId"`
	Name           string                 `db:"name" json:"name"`
	Description    string                 `db:"description" json:"description"`
	Category       string                 `db:"category" json:"category"`
	IsBuiltin      bool                   `db:"is_builtin" json:"isBuiltin"`
	FormSchema     string                 `db:"form_schema" json:"-"`
	PreviewURL     string                 `db:"preview_url" json:"previewUrl"`
	UsageCount     int                    `db:"usage_count" json:"usageCount"`
	CreatedAt      time.Time              `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time              `db:"updated_at" json:"updatedAt"`
	FormSchemaData map[string]interface{} `json:"formSchema,omitempty"`
}

// --- Form Instance ---

type FormInstance struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	FormID      string     `db:"form_id" json:"formId"`
	Data        string     `db:"data" json:"-"`
	Status      string     `db:"status" json:"status"`
	SubmittedBy string     `db:"submitted_by" json:"submittedBy"`
	SubmittedAt *time.Time `db:"submitted_at" json:"submittedAt"`
	ApprovedBy  string     `db:"approved_by" json:"approvedBy"`
	ApprovedAt  *time.Time `db:"approved_at" json:"approvedAt"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`

	DataMap map[string]interface{} `json:"data,omitempty"`
}

// --- Component Registry ---

type ComponentRegistry struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenantId"`
	Name          string    `db:"name" json:"name"`
	DisplayName   string    `db:"display_name" json:"displayName"`
	Category      string    `db:"category" json:"category"`
	Version       string    `db:"version" json:"version"`
	PropsSchema   string    `db:"props_schema" json:"-"`
	DefaultConfig string    `db:"default_config" json:"-"`
	Icon          string    `db:"icon" json:"icon"`
	IsBuiltin     bool      `db:"is_builtin" json:"isBuiltin"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`

	PropsSchemaData   map[string]interface{} `json:"propsSchema,omitempty"`
	DefaultConfigData map[string]interface{} `json:"defaultConfig,omitempty"`
}

// --- Request/Response types ---

type CreateFormRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	ModuleName  string                 `json:"moduleName"`
	Tags        []string               `json:"tags"`
	Layout      map[string]interface{} `json:"layout"`
	Fields      []FormField            `json:"fields" binding:"required"`
	Meta        map[string]interface{} `json:"meta"`
}

type UpdateFormRequest struct {
	Name        *string                `json:"name"`
	Title       *string                `json:"title"`
	Description *string                `json:"description"`
	Category    *string                `json:"category"`
	ModuleName  *string                `json:"moduleName"`
	Tags        []string               `json:"tags"`
	Layout      map[string]interface{} `json:"layout"`
	Fields      []FormField            `json:"fields"`
	Meta        map[string]interface{} `json:"meta"`
}

type CreateFieldRequest struct {
	Key           string                 `json:"key" binding:"required"`
	Label         string                 `json:"label" binding:"required"`
	Type          string                 `json:"type" binding:"required"`
	Required      bool                   `json:"required"`
	Visible       bool                   `json:"visible"`
	Disabled      bool                   `json:"disabled"`
	Placeholder   string                 `json:"placeholder"`
	DefaultVal    interface{}            `json:"defaultVal"`
	Options       []interface{}          `json:"options"`
	Rules         []interface{}          `json:"rules"`
	Meta          map[string]interface{} `json:"meta"`
	LayoutConfig  map[string]interface{} `json:"layoutConfig"`
	SortableIndex int                    `json:"sortableIndex"`
	ParentKey     string                 `json:"parentKey"`
}

type SubmitInstanceRequest struct {
	Data     map[string]interface{} `json:"data" binding:"required"`
	SubmitBy string                 `json:"submitBy" binding:"required"`
}

type ApproveInstanceRequest struct {
	Approver string `json:"approver" binding:"required"`
	Action   string `json:"action" binding:"required"`
}
