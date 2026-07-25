package service

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/param-types/models"
	"orion/platform-svc-go/internal/param-types/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

type IParamTypeHandler interface {
	Name() string
	Code() string
	Validate(value string) error
	Parse(value string) (interface{}, error)
	Serialize(v interface{}) string
	Placeholder() string
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type ParamTypeRegistry struct {
	handlers map[string]IParamTypeHandler
	repo     *repository.Repository
	logger   *zap.Logger
}

func NewParamTypeRegistry(repo *repository.Repository, logger *zap.Logger) *ParamTypeRegistry {
	r := &ParamTypeRegistry{
		handlers: make(map[string]IParamTypeHandler),
		repo:     repo,
		logger:   logger,
	}
	// Seed the 20 built-in handlers.
	r.Register(new(StringParam))
	r.Register(new(NumberParam))
	r.Register(new(BooleanParam))
	r.Register(new(DateTimeParam))
	r.Register(new(SelectParam))
	r.Register(new(MultiSelectParam))
	r.Register(new(PasswordParam))
	r.Register(new(JSONParam))
	r.Register(new(FileParam))
	r.Register(new(SQLParam))
	r.Register(new(ScriptParam))
	r.Register(new(TemplateParam))
	r.Register(new(ReferenceParam))
	r.Register(new(EnumParam))
	r.Register(new(RegexParam))
	r.Register(new(EmailParam))
	r.Register(new(URLParam))
	r.Register(new(IPParam))
	r.Register(new(CIDRParam))
	r.Register(new(PortParam))
	return r
}

// Register adds (or overwrites) a param type handler.
func (r *ParamTypeRegistry) Register(h IParamTypeHandler) {
	if h == nil {
		return
	}
	code := h.Code()
	r.handlers[code] = h
	if r.logger != nil {
		r.logger.Debug("param type handler registered",
			zap.String("code", code),
			zap.String("name", h.Name()))
	}
}

// Handler returns the handler for a given code, or nil.
func (r *ParamTypeRegistry) Handler(code string) IParamTypeHandler {
	return r.handlers[code]
}

// Codes returns all registered type codes.
func (r *ParamTypeRegistry) Codes() []string {
	codes := make([]string, 0, len(r.handlers))
	for code := range r.handlers {
		codes = append(codes, code)
	}
	return codes
}

// ValidateValue runs validation + parsing for a value against the named type.
func (r *ParamTypeRegistry) ValidateValue(paramType, value string) *models.ValidateParamResponse {
	resp := &models.ValidateParamResponse{Type: paramType}
	h := r.handlers[paramType]
	if h == nil {
		resp.Error = fmt.Sprintf("unknown param type: %s", paramType)
		return resp
	}
	if err := h.Validate(value); err != nil {
		resp.Error = err.Error()
		return resp
	}
	parsed, err := h.Parse(value)
	if err != nil {
		resp.Error = err.Error()
		return resp
	}
	resp.Valid = true
	resp.Parsed = parsed
	return resp
}

// ListParamTypes returns the seed catalog plus tenant overrides.
func (r *ParamTypeRegistry) ListParamTypes(tenantID string) ([]models.ScriptParamType, error) {
	items, err := r.repo.ListByTenant(tenantID)
	if err != nil {
		return nil, err
	}
	seed := r.buildSeed(tenantID)

	// Index tenant overrides by code.
	tenantMap := make(map[string]models.ScriptParamType, len(items))
	for _, t := range items {
		tenantMap[t.Code] = t
	}

	// Walk the canonical catalog; if the tenant has an override, prefer it.
	result := make([]models.ScriptParamType, 0, len(seed))
	for _, s := range seed {
		if override, ok := tenantMap[s.Code]; ok {
			result = append(result, override)
		} else {
			result = append(result, s)
		}
	}
	return result, nil
}

// GetParamType returns a param type by ID for a tenant, or a built-in match.
func (r *ParamTypeRegistry) GetParamType(ctx context.Context, tenantID, id string) (*models.ScriptParamType, error) {
	pt, err := r.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if pt != nil {
		return pt, nil
	}
	// Match built-in by id prefix "builtin:<code>".
	if len(id) >= 10 && id[:7] == "builtin:" {
		code := id[8:]
		if _, ok := r.handlers[code]; ok {
			for _, s := range r.buildSeed(tenantID) {
				if s.Code == code {
					return &s, nil
				}
			}
		}
	}
	return nil, nil
}

// DeleteParamType deletes a tenant-level param type override by ID.
func (r *ParamTypeRegistry) DeleteParamType(ctx context.Context, tenantID, id string) error {
	return r.repo.Delete(ctx, tenantID, id)
}

// UpsertParamType creates or updates a tenant-level param type override.
func (r *ParamTypeRegistry) UpsertParamType(tenantID string, req *models.CreateParamTypeRequest) (*models.ScriptParamType, error) {
	if _, ok := r.handlers[req.Code]; !ok {
		return nil, fmt.Errorf("unknown built-in param type code: %s", req.Code)
	}
	existing, err := r.repo.GetByTenantAndCode(tenantID, req.Code)
	if err == nil && existing != nil {
		// Update
		if req.Name != "" {
			existing.Name = req.Name
		}
		if req.Label != "" {
			existing.Label = req.Label
		}
		if req.Category != "" {
			existing.Category = req.Category
		}
		if req.DefaultVal != "" {
			existing.DefaultVal = req.DefaultVal
		}
		if req.Validation != nil {
			existing.Validation = req.Validation
		}
		if req.Options != nil {
			existing.Options = req.Options
		}
		existing.Enabled = req.Enabled
		existing.UpdatedAt = time.Now()
		if err := r.repo.Update(existing); err != nil {
			return nil, err
		}
		return r.repo.GetByTenantAndCode(tenantID, req.Code)
	}
	// Create
	pt := &models.ScriptParamType{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		Code:       req.Code,
		Label:      req.Label,
		Category:   req.Category,
		DefaultVal: req.DefaultVal,
		Validation: req.Validation,
		Options:    req.Options,
		Enabled:    req.Enabled,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	if err := r.repo.Create(pt); err != nil {
		return nil, err
	}
	return r.repo.GetByTenantAndCode(tenantID, req.Code)
}

func (r *ParamTypeRegistry) buildSeed(tenantID string) []models.ScriptParamType {
	now := time.Now()
	out := make([]models.ScriptParamType, 0, len(r.handlers))
	for _, info := range models.ParamTypeCatalog() {
		out = append(out, models.ScriptParamType{
			ID:        "builtin:" + info.Code,
			TenantID:  tenantID,
			Name:      info.Name,
			Code:      info.Code,
			Label:     info.Label,
			Category:  info.Category,
			Enabled:   true,
			CreatedAt: now,
            UpdatedAt: now,
		})
	}
	return out
}

// ---------------------------------------------------------------------------
// Param template helpers
// ---------------------------------------------------------------------------

func (r *ParamTypeRegistry) CreateParamTemplate(tenantID string, req *models.CreateParamTemplateRequest) (*models.ScriptParamTemplate, error) {
	if _, ok := r.handlers[req.ParamType]; !ok {
		return nil, fmt.Errorf("unknown param type: %s", req.ParamType)
	}
	tpl := &models.ScriptParamTemplate{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		ParamType: req.ParamType,
		Required:  req.Required,
		Position:  req.Position,
		Example:   req.Example,
		CreatedAt: time.Now(),
	}
	if err := r.repo.CreateParamTemplate(tpl); err != nil {
		return nil, err
	}
	return r.repo.GetParamTemplate(tenantID, tpl.ID)
}

func (r *ParamTypeRegistry) ListParamTemplates(tenantID string, offset, limit int) ([]models.ScriptParamTemplate, error) {
	return r.repo.ListParamTemplates(tenantID, offset, limit)
}

// ---------------------------------------------------------------------------
// Value serialization for JSON response (implement driver.Valuer for JSONB)
// ---------------------------------------------------------------------------

var driverValuer driver.Valuer = jsonValuer(nil)

type jsonValuer interface {
	Value() (driver.Value, error)
}

// helper used only to ensure JSONB compat with repository.

// ===========================================================================
// Built-in handlers (20)
// ===========================================================================

// --- string ---

type StringParam struct{}

func (h *StringParam) Name() string  { return "String" }
func (h *StringParam) Code() string  { return "string" }
func (h *StringParam) Validate(value string) error { return nil }
func (h *StringParam) Parse(value string) (interface{}, error) { return value, nil }
func (h *StringParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *StringParam) Placeholder() string { return "<string>" }

// --- number ---

type NumberParam struct{}

func (h *NumberParam) Name() string  { return "Number" }
func (h *NumberParam) Code() string  { return "number" }
func (h *NumberParam) Validate(value string) error {
	v, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fmt.Errorf("not a valid number: %v", err)
	}
	_ = v
	return nil
}
func (h *NumberParam) Parse(value string) (interface{}, error) { return strconv.ParseFloat(value, 64) }
func (h *NumberParam) Serialize(v interface{}) string {
	switch val := v.(type) {
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%g", val)
	default:
		return fmt.Sprint(v)
	}
}
func (h *NumberParam) Placeholder() string { return "42" }

// --- boolean ---

var truthy = map[string]bool{
	"true": true, "false": false,
	"yes": true, "no": false,
	"1": true, "0": false,
	"on": true, "off": false,
}

type BooleanParam struct{}

func (h *BooleanParam) Name() string  { return "Boolean" }
func (h *BooleanParam) Code() string  { return "boolean" }
func (h *BooleanParam) Validate(value string) error {
	if _, ok := truthy[strings.ToLower(strings.TrimSpace(value))]; !ok {
		return fmt.Errorf("not a valid boolean, expected true/false, yes/no, 1/0")
	}
	return nil
}
func (h *BooleanParam) Parse(value string) (interface{}, error) {
	l := strings.ToLower(strings.TrimSpace(value))
	if b, ok := truthy[l]; ok {
		return b, nil
	}
	return nil, fmt.Errorf("not a valid boolean")
}
func (h *BooleanParam) Serialize(v interface{}) string {
	if b, ok := v.(bool); ok {
		return strconv.FormatBool(b)
	}
	return fmt.Sprint(v)
}
func (h *BooleanParam) Placeholder() string { return "true" }

// --- datetime ---

type DateTimeParam struct{}

func (h *DateTimeParam) Name() string  { return "DateTime" }
func (h *DateTimeParam) Code() string  { return "datetime" }
func (h *DateTimeParam) Validate(value string) error {
	_, err := parseDateTime(value)
	return err
}
func (h *DateTimeParam) Parse(value string) (interface{}, error) {
	t, err := parseDateTime(value)
	return t.Format(time.RFC3339), err
}
func (h *DateTimeParam) Serialize(v interface{}) string {
	switch val := v.(type) {
	case time.Time:
		return val.Format(time.RFC3339)
	case string:
		return val
	default:
		return fmt.Sprint(v)
	}
}
func (h *DateTimeParam) Placeholder() string { return "2026-07-24T12:00:00Z" }

var dateFormats = []string{
	time.RFC3339,
	time.RFC3339Nano,
	"2006-01-02T15:04:05Z07:00",
	"2006-01-02 15:04:05",
	"2006-01-02",
}

func parseDateTime(value string) (time.Time, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return time.Time{}, fmt.Errorf("datetime value is empty")
	}
	for _, layout := range dateFormats {
		if t, err := time.Parse(layout, v); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized datetime format: %q (expected RFC3339 or YYYY-MM-DD[T]HH:MM:SS)", v)
}

// --- select ---

type SelectParam struct{}

func (h *SelectParam) Name() string  { return "Select" }
func (h *SelectParam) Code() string  { return "select" }
func (h *SelectParam) Validate(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("select value is required")
	}
	return nil
}
func (h *SelectParam) Parse(value string) (interface{}, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return "", fmt.Errorf("empty select value")
	}
	return v, nil
}
func (h *SelectParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *SelectParam) Placeholder() string { return "<option>" }

// --- multiselect ---

type MultiSelectParam struct{}

func (h *MultiSelectParam) Name() string  { return "MultiSelect" }
func (h *MultiSelectParam) Code() string  { return "multiselect" }
func (h *MultiSelectParam) Validate(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("multiselect value is required")
	}
	return nil
}
func (h *MultiSelectParam) Parse(value string) (interface{}, error) {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return out, fmt.Errorf("no valid multiselect values")
	}
	return out, nil
}
func (h *MultiSelectParam) Serialize(v interface{}) string {
	if arr, ok := v.([]string); ok {
		return strings.Join(arr, ",")
	}
	return fmt.Sprint(v)
}
func (h *MultiSelectParam) Placeholder() string { return "option1,option2" }

// --- password ---

type PasswordParam struct{}

func (h *PasswordParam) Name() string  { return "Password" }
func (h *PasswordParam) Code() string  { return "password" }
func (h *PasswordParam) Validate(value string) error {
	if len(value) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}
	if len(value) > 128 {
		return fmt.Errorf("password must be at most 128 characters")
	}
	return nil
}
func (h *PasswordParam) Parse(value string) (interface{}, error) {
	return value, nil // raw value; runtime masks it
}
func (h *PasswordParam) Serialize(v interface{}) string {
	// mask on serialization for safety
	s := fmt.Sprint(v)
	if len(s) <= 4 {
		return "****"
	}
	return strings.Repeat("*", len(s)-2) + string(s[len(s)-2:])
}
func (h *PasswordParam) Placeholder() string { return "••••••" }

// --- json ---

type JSONParam struct{}

func (h *JSONParam) Name() string  { return "JSON" }
func (h *JSONParam) Code() string  { return "json" }
func (h *JSONParam) Validate(value string) error {
	return h.parseValidate(value)
}
func (h *JSONParam) Parse(value string) (interface{}, error) {
	var out interface{}
	return &out, h.parseValidate(value)
}
func (h *JSONParam) parseValidate(value string) error {
	var v interface{}
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		return fmt.Errorf("not valid JSON: %v", err)
	}
	return nil
}
func (h *JSONParam) Serialize(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprint(v)
	}
	return string(b)
}
func (h *JSONParam) Placeholder() string { return `{"key":"value"}` }

// --- file ---

type FileParam struct{}

func (h *FileParam) Name() string  { return "File" }
func (h *FileParam) Code() string  { return "file" }
func (h *FileParam) Validate(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("file reference is required")
	}
	return nil
}
func (h *FileParam) Parse(value string) (interface{}, error) {
	return strings.TrimSpace(value), nil
}
func (h *FileParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *FileParam) Placeholder() string { return "path/to/file.ext" }

// --- sql ---

type SQLParam struct{}

func (h *SQLParam) Name() string  { return "SQL" }
func (h *SQLParam) Code() string  { return "sql" }
func (h *SQLParam) Validate(value string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		return fmt.Errorf("SQL statement is required")
	}
	// Lightweight sanity: must start with a known clause.
	upper := strings.ToUpper(v)
	allowed := []string{"SELECT", "INSERT", "UPDATE", "DELETE", "WITH", "CREATE", "ALTER", "DROP"}
	matched := false
	for _, a := range allowed {
		if strings.HasPrefix(upper, a) {
			matched = true
			break
		}
	}
	if !matched {
		return fmt.Errorf("SQL statement must begin with a valid clause (SELECT/INSERT/UPDATE/DELETE/...)")
	}
	return nil
}
func (h *SQLParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *SQLParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *SQLParam) Placeholder() string { return "SELECT * FROM t WHERE 1=1" }

// --- script ---

type ScriptParam struct{}

func (h *ScriptParam) Name() string  { return "Script" }
func (h *ScriptParam) Code() string  { return "script" }
func (h *ScriptParam) Validate(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("script body is required")
	}
	return nil
}
func (h *ScriptParam) Parse(value string) (interface{}, error) { return value, nil }
func (h *ScriptParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *ScriptParam) Placeholder() string { return "#!/bin/bash\necho hello" }

// --- template ---

type TemplateParam struct{}

func (h *TemplateParam) Name() string  { return "Template" }
func (h *TemplateParam) Code() string  { return "template" }
func (h *TemplateParam) Validate(value string) error {
	// Template strings may use {{var}} syntax; accept any non-empty.
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("template is required")
	}
	return nil
}
func (h *TemplateParam) Parse(value string) (interface{}, error) { return value, nil }
func (h *TemplateParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *TemplateParam) Placeholder() string { return "Hello {{name}}, deployed on {{date}}" }

// --- reference ---

type ReferenceParam struct{}

func (h *ReferenceParam) Name() string  { return "Reference" }
func (h *ReferenceParam) Code() string  { return "reference" }
func (h *ReferenceParam) Validate(value string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		return fmt.Errorf("reference is required")
	}
	// Accept common forms: $VAR, ${VAR}, @path/to/resource, project:env:resource
	if !strings.HasPrefix(v, "$") && !strings.HasPrefix(v, "@") && !strings.Contains(v, ":") {
		return fmt.Errorf("reference must be in $VAR / ${VAR} / @path / ns:ns:resource format")
	}
	return nil
}
func (h *ReferenceParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *ReferenceParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *ReferenceParam) Placeholder() string { return "${PIPELINE_OUTPUT}" }

// --- enum ---

type EnumParam struct{}

func (h *EnumParam) Name() string  { return "Enum" }
func (h *EnumParam) Code() string  { return "enum" }
func (h *EnumParam) Validate(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("enum value is required")
	}
	return nil // actual enum options validated by registry-level options
}
func (h *EnumParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *EnumParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *EnumParam) Placeholder() string { return "<enum-value>" }

// --- regex ---

type RegexParam struct{}

func (h *RegexParam) Name() string  { return "Regex" }
func (h *RegexParam) Code() string  { return "regex" }
func (h *RegexParam) Validate(value string) error {
	if _, err := regexp.Compile(value); err != nil {
		return fmt.Errorf("invalid regex pattern: %v", err)
	}
	return nil
}
func (h *RegexParam) Parse(value string) (interface{}, error) {
	re, err := regexp.Compile(value)
	if err != nil {
		return nil, err
	}
	return re.String(), nil
}
func (h *RegexParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *RegexParam) Placeholder() string { return `^[a-z0-9]+@[a-z]+\.com$` }

// --- email ---

var emailRe = regexp.MustCompile(`^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$`)

type EmailParam struct{}

func (h *EmailParam) Name() string  { return "Email" }
func (h *EmailParam) Code() string  { return "email" }
func (h *EmailParam) Validate(value string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		return fmt.Errorf("email is required")
	}
	if !emailRe.MatchString(v) {
		return fmt.Errorf("not a valid email address: %s", v)
	}
	return nil
}
func (h *EmailParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *EmailParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *EmailParam) Placeholder() string { return "user@example.com" }

// --- url ---

type URLParam struct{}

func (h *URLParam) Name() string  { return "URL" }
func (h *URLParam) Code() string  { return "url" }
func (h *URLParam) Validate(value string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		return fmt.Errorf("URL is required")
	}
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return fmt.Errorf("URL must start with http:// or https://")
	}
	return nil
}
func (h *URLParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *URLParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *URLParam) Placeholder() string { return "https://example.com" }

// --- ip ---

type IPParam struct{}

func (h *IPParam) Name() string  { return "IP" }
func (h *IPParam) Code() string  { return "ip" }
func (h *IPParam) Validate(value string) error {
	ip := strings.TrimSpace(value)
	if ip == "" {
		return fmt.Errorf("IP address is required")
	}
	// simple check: contains . (ipv4) or : (ipv6)
	if !strings.Contains(ip, ".") && !strings.Contains(ip, ":") {
		return fmt.Errorf("not a valid IP address: %s", ip)
	}
	return nil
}
func (h *IPParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *IPParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *IPParam) Placeholder() string { return "192.168.1.1" }

// --- cidr ---

type CIDRParam struct{}

func (h *CIDRParam) Name() string  { return "CIDR" }
func (h *CIDRParam) Code() string  { return "cidr" }
func (h *CIDRParam) Validate(value string) error {
	v := strings.TrimSpace(value)
	if v == "" {
		return fmt.Errorf("CIDR is required")
	}
	parts := strings.Split(v, "/")
	if len(parts) != 2 {
		return fmt.Errorf("CIDR must be in IP/prefix format, got %s", v)
	}
	_, err := strconv.Atoi(parts[1])
	if err != nil {
		return fmt.Errorf("CIDR prefix must be numeric, got %s", parts[1])
	}
	return nil
}
func (h *CIDRParam) Parse(value string) (interface{}, error) { return strings.TrimSpace(value), nil }
func (h *CIDRParam) Serialize(v interface{}) string { return fmt.Sprint(v) }
func (h *CIDRParam) Placeholder() string { return "192.168.0.0/16" }

// --- port ---

type PortParam struct{}

func (h *PortParam) Name() string  { return "Port" }
func (h *PortParam) Code() string  { return "port" }
func (h *PortParam) Validate(value string) error {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("not a valid port number: %v", err)
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("port must be between 1 and 65535, got %d", port)
	}
	return nil
}
func (h *PortParam) Parse(value string) (interface{}, error) {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0, err
	}
	if port < 1 || port > 65535 {
		return 0, fmt.Errorf("port out of range: %d", port)
	}
	return port, nil
}
func (h *PortParam) Serialize(v interface{}) string {
	switch val := v.(type) {
	case int:
		return fmt.Sprintf("%d", val)
	case float64:
		return fmt.Sprintf("%d", int(val))
	default:
		return fmt.Sprint(v)
	}
}
func (h *PortParam) Placeholder() string { return "8080" }
