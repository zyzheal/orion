package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB helper mirrors orion/platform-svc-go JSONB for this module.
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

// ---------------------------------------------------------------------------
// Param type catalog entry
// ---------------------------------------------------------------------------

type ScriptParamType struct {
	ID         string    `db:"id"           json:"id"`
	TenantID   string    `db:"tenant_id"    json:"tenant_id"`
	Name       string    `db:"name"         json:"name"`
	Code       string    `db:"code"         json:"code"`     // "string","number","boolean",...
	Label      string    `db:"label"        json:"label"`
	Category   string    `db:"category"     json:"category"` // "basic","data","network","security"
	DefaultVal string    `db:"default_value" json:"default_value"`
	Validation JSONB     `db:"validation"   json:"validation,omitempty"`
	Options    JSONB     `db:"options"      json:"options,omitempty"`
	Enabled    bool      `db:"enabled"      json:"enabled"`
	CreatedAt  time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at"   json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Param template inside a job definition
// ---------------------------------------------------------------------------

type ScriptParamTemplate struct {
	ID        string    `db:"id"         json:"id"`
	TenantID  string    `db:"tenant_id"  json:"tenant_id"`
	Name      string    `db:"name"       json:"name"`
	ParamType string    `db:"param_type" json:"param_type"` // references ScriptParamType.code
	Required  bool      `db:"required"   json:"required"`
	Position  int       `db:"position"   json:"position"`
	Example   string    `db:"example"    json:"example,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response payloads
// ---------------------------------------------------------------------------

type CreateParamTypeRequest struct {
	Name        string `json:"name"       binding:"required"`
	Code        string `json:"code"       binding:"required"`
	Label       string `json:"label"`
	Category    string `json:"category"`
	DefaultVal  string `json:"default_value"`
	Validation  JSONB  `json:"validation"`
	Options     JSONB  `json:"options"`
	Enabled     bool   `json:"enabled"`
}

type UpdateParamTypeRequest struct {
	Name        *string `json:"name"`
	Code        *string `json:"code"`
	Label       *string `json:"label"`
	Category    *string `json:"category"`
	DefaultVal  *string `json:"default_value"`
	Validation  JSONB   `json:"validation"`
	Options     JSONB   `json:"options"`
	Enabled     *bool   `json:"enabled"`
}

type CreateParamTemplateRequest struct {
	Name      string `json:"name"       binding:"required"`
	ParamType string `json:"param_type" binding:"required"`
	Required  bool   `json:"required"`
	Position  int    `json:"position"`
	Example   string `json:"example"`
}

// ---------------------------------------------------------------------------
// Validation endpoint
// ---------------------------------------------------------------------------

type ValidateParamRequest struct {
	ParamType string `json:"param_type" binding:"required"`
	Value     string `json:"value"`
}

type ValidateParamResponse struct {
	Valid  bool   `json:"valid"`
	Type   string `json:"type"`
	Parsed interface{} `json:"parsed,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// Built-in param type registry (system seed)
// ---------------------------------------------------------------------------

type ParamTypeInfo struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Label    string `json:"label"`
	Category string `json:"category"`
}

// ParamTypeCatalog returns the canonical 20 built-in parameter types.
func ParamTypeCatalog() []ParamTypeInfo {
	return []ParamTypeInfo{
		{Code: "string", Name: "String", Label: "字符串", Category: "basic"},
		{Code: "number", Name: "Number", Label: "数字", Category: "basic"},
		{Code: "boolean", Name: "Boolean", Label: "布尔值", Category: "basic"},
		{Code: "datetime", Name: "DateTime", Label: "日期时间", Category: "basic"},
		{Code: "select", Name: "Select", Label: "单选", Category: "data"},
		{Code: "multiselect", Name: "MultiSelect", Label: "多选", Category: "data"},
		{Code: "password", Name: "Password", Label: "密码", Category: "security"},
		{Code: "json", Name: "JSON", Label: "JSON", Category: "data"},
		{Code: "file", Name: "File", Label: "文件", Category: "data"},
		{Code: "sql", Name: "SQL", Label: "SQL", Category: "data"},
		{Code: "script", Name: "Script", Label: "脚本", Category: "data"},
		{Code: "template", Name: "Template", Label: "模板", Category: "data"},
		{Code: "reference", Name: "Reference", Label: "引用", Category: "data"},
		{Code: "enum", Name: "Enum", Label: "枚举", Category: "data"},
		{Code: "regex", Name: "Regex", Label: "正则表达式", Category: "data"},
		{Code: "email", Name: "Email", Label: "邮箱", Category: "network"},
		{Code: "url", Name: "URL", Label: "网址", Category: "network"},
		{Code: "ip", Name: "IP", Label: "IP 地址", Category: "network"},
		{Code: "cidr", Name: "CIDR", Label: "CIDR 网段", Category: "network"},
		{Code: "port", Name: "Port", Label: "端口", Category: "network"},
	}
}
