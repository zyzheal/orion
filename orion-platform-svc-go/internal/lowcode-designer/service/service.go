package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/lowcode-designer/models"

	"github.com/google/uuid"
)

// ErrInvalidAction is returned when an approve request carries an action that is
// neither approve nor reject. The handler maps it to 400 so it is not confused
// with the 404 the same route returns for an instance that does not exist.
var ErrInvalidAction = errors.New("unknown approval action")

// encodeJSON renders a value for a JSON column. Every caller passes a map, a
// slice or a scalar whose fields all carry json tags, so Marshal cannot fail;
// the helper exists so no call site repeats the discarded-error pattern.
func encodeJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

type RepositoryInterface interface {
	CreateForm(ctx context.Context, f *models.FormDefinition) error
	GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error)
	ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error)
	UpdateForm(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormDefinition, error)
	DeleteForm(ctx context.Context, id, tenantID string) (bool, error)

	CreateField(ctx context.Context, f *models.FormField) error
	UpdateField(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormField, error)
	DeleteField(ctx context.Context, id, tenantID string) (bool, error)
	GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error)

	CreateTemplate(ctx context.Context, t *models.FormTemplate) error
	ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error)
	GetTemplate(ctx context.Context, id, tenantID string) (*models.FormTemplate, error)

	CreateInstance(ctx context.Context, inst *models.FormInstance) error
	GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error)
	ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error)
	UpdateInstance(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormInstance, error)

	CreateComponent(ctx context.Context, c *models.ComponentRegistry) error
	ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error)
	GetComponent(ctx context.Context, id, tenantID string) (*models.ComponentRegistry, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Form Definition CRUD ---

func (s *Service) CreateForm(ctx context.Context, req *models.CreateFormRequest, tenantID, operator string) (*models.FormDefinition, error) {
	f := &models.FormDefinition{
		ID:          newID(),
		TenantID:    tenantID,
		Name:        req.Name,
		Title:       req.Title,
		Description: req.Description,
		Version:     1,
		Status:      "draft",
		Category:    req.Category,
		ModuleName:  req.ModuleName,
		Tags:        encodeJSON(req.Tags),
		Layout:      encodeJSON(req.Layout),
		FieldsJSON:  encodeJSON(req.Fields),
		Meta:        encodeJSON(req.Meta),
		CreatedBy:   operator,
		UpdatedBy:   operator,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		FieldsList:  req.Fields,
		LayoutData:  req.Layout,
		TagsList:    req.Tags,
		MetaData:    req.Meta,
	}
	if err := s.repo.CreateForm(ctx, f); err != nil {
		return nil, err
	}
	for i := range req.Fields {
		field := &models.FormField{
			ID:            newID(),
			TenantID:      tenantID,
			FormID:        f.ID,
			Key:           req.Fields[i].Key,
			Label:         req.Fields[i].Label,
			Type:          req.Fields[i].Type,
			Required:      req.Fields[i].Required,
			Visible:       req.Fields[i].Visible,
			Disabled:      req.Fields[i].Disabled,
			Placeholder:   req.Fields[i].Placeholder,
			DefaultVal:    encodeJSON(req.Fields[i].DefaultValData),
			Options:       encodeJSON(req.Fields[i].OptionsList),
			Rules:         encodeJSON(req.Fields[i].RulesList),
			Meta:          encodeJSON(req.Fields[i].MetaData),
			LayoutConfig:  encodeJSON(req.Fields[i].LayoutData),
			SortableIndex: i,
			ParentKey:     req.Fields[i].ParentKey,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		// The loop previously ignored this error, so POST /forms answered 201 for
		// a form whose fields never reached the database.
		if err := s.repo.CreateField(ctx, field); err != nil {
			return nil, fmt.Errorf("creating field %q of form %s: %w", req.Fields[i].Key, f.ID, err)
		}
	}
	return f, nil
}

func (s *Service) GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error) {
	f, err := s.repo.GetForm(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if f.FieldsJSON != "" {
		json.Unmarshal([]byte(f.FieldsJSON), &f.FieldsList)
	}
	if f.Layout != "" {
		json.Unmarshal([]byte(f.Layout), &f.LayoutData)
	}
	if f.Tags != "" {
		json.Unmarshal([]byte(f.Tags), &f.TagsList)
	}
	if f.Meta != "" {
		json.Unmarshal([]byte(f.Meta), &f.MetaData)
	}
	return f, nil
}

func (s *Service) ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error) {
	forms, err := s.repo.ListForms(ctx, tenantID, category, status)
	if err != nil {
		return nil, err
	}
	if forms == nil {
		return []models.FormDefinition{}, nil
	}
	for i := range forms {
		if forms[i].FieldsJSON != "" {
			json.Unmarshal([]byte(forms[i].FieldsJSON), &forms[i].FieldsList)
		}
		if forms[i].Layout != "" {
			json.Unmarshal([]byte(forms[i].Layout), &forms[i].LayoutData)
		}
	}
	return forms, nil
}

func (s *Service) UpdateForm(ctx context.Context, id, tenantID, operator string, req *models.UpdateFormRequest) (*models.FormDefinition, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.Title != nil {
		attrs["title"] = *req.Title
	}
	if req.Description != nil {
		attrs["description"] = *req.Description
	}
	if req.Category != nil {
		attrs["category"] = *req.Category
	}
	if req.ModuleName != nil {
		attrs["module_name"] = *req.ModuleName
	}
	if req.Tags != nil {
		attrs["tags"] = encodeJSON(req.Tags)
	}
	if req.Layout != nil {
		attrs["layout"] = encodeJSON(req.Layout)
	}
	if req.Fields != nil {
		attrs["fields"] = encodeJSON(req.Fields)
	}
	if req.Meta != nil {
		attrs["meta"] = encodeJSON(req.Meta)
	}
	attrs["updated_by"] = operator

	updated, err := s.repo.UpdateForm(ctx, id, tenantID, attrs)
	if err != nil {
		return nil, err
	}
	// Best effort: the form row is already updated, so a failure listing its
	// fields should not turn a successful update into an error.
	updated.FieldsList, _ = s.GetFieldsByForm(ctx, id, tenantID)
	return updated, nil
}

func (s *Service) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeleteForm(ctx, id, tenantID)
}

// --- Field ---

func (s *Service) CreateField(ctx context.Context, formID, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error) {
	maxIdx, err := s.getMaxFieldIndex(ctx, formID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("counting fields of form %s: %w", formID, err)
	}
	// form_field.visible is NOT NULL DEFAULT 1, and the INSERT names the column,
	// so the default never applies: a plain text field came back hidden.
	visible := true
	if req.Visible != nil {
		visible = *req.Visible
	}
	field := &models.FormField{
		ID:            newID(),
		TenantID:      tenantID,
		FormID:        formID,
		Key:           req.Key,
		Label:         req.Label,
		Type:          req.Type,
		Required:      req.Required,
		Visible:       visible,
		Disabled:      req.Disabled,
		Placeholder:   req.Placeholder,
		SortableIndex: maxIdx + 1,
		ParentKey:     req.ParentKey,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if req.Options != nil {
		field.Options = encodeJSON(req.Options)
		field.OptionsList = req.Options
	}
	if req.Rules != nil {
		field.Rules = encodeJSON(req.Rules)
		field.RulesList = req.Rules
	}
	if req.Meta != nil {
		field.Meta = encodeJSON(req.Meta)
		field.MetaData = req.Meta
	}
	if req.LayoutConfig != nil {
		field.LayoutConfig = encodeJSON(req.LayoutConfig)
		field.LayoutData = req.LayoutConfig
	}
	if req.DefaultVal != nil {
		field.DefaultVal = encodeJSON(req.DefaultVal)
		field.DefaultValData = req.DefaultVal
	}

	if err := s.repo.CreateField(ctx, field); err != nil {
		return nil, err
	}
	return field, nil
}

func (s *Service) UpdateField(ctx context.Context, id, tenantID string, req *models.UpdateFieldRequest) (*models.FormField, error) {
	attrs := make(map[string]interface{})
	if req.Label != nil {
		attrs["label"] = *req.Label
	}
	if req.Type != nil {
		attrs["type"] = *req.Type
	}
	if req.Required != nil {
		attrs["required"] = *req.Required
	}
	if req.Visible != nil {
		attrs["visible"] = *req.Visible
	}
	if req.Disabled != nil {
		attrs["disabled"] = *req.Disabled
	}
	if req.Placeholder != nil {
		attrs["placeholder"] = *req.Placeholder
	}
	if req.SortableIndex != nil {
		attrs["sortable_index"] = *req.SortableIndex
	}
	if req.ParentKey != nil {
		attrs["parent_key"] = *req.ParentKey
	}
	if req.Options != nil {
		attrs["options"] = encodeJSON(req.Options)
	}
	if req.Rules != nil {
		attrs["rules"] = encodeJSON(req.Rules)
	}
	if req.Meta != nil {
		attrs["meta"] = encodeJSON(req.Meta)
	}
	if req.LayoutConfig != nil {
		attrs["layout_config"] = encodeJSON(req.LayoutConfig)
	}
	if req.DefaultVal != nil {
		attrs["default_val"] = encodeJSON(req.DefaultVal)
	}

	return s.repo.UpdateField(ctx, id, tenantID, attrs)
}

func (s *Service) DeleteField(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeleteField(ctx, id, tenantID)
}

func (s *Service) GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error) {
	fields, err := s.repo.GetFieldsByForm(ctx, formID, tenantID)
	if err != nil {
		return nil, err
	}
	if fields == nil {
		return []models.FormField{}, nil
	}
	for i := range fields {
		if fields[i].Options != "" {
			json.Unmarshal([]byte(fields[i].Options), &fields[i].OptionsList)
		}
		if fields[i].Rules != "" {
			json.Unmarshal([]byte(fields[i].Rules), &fields[i].RulesList)
		}
		if fields[i].Meta != "" {
			json.Unmarshal([]byte(fields[i].Meta), &fields[i].MetaData)
		}
		if fields[i].LayoutConfig != "" {
			json.Unmarshal([]byte(fields[i].LayoutConfig), &fields[i].LayoutData)
		}
	}
	return fields, nil
}

// --- Template ---

func (s *Service) ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error) {
	templates, err := s.repo.ListTemplates(ctx, tenantID, category)
	if err != nil {
		return nil, err
	}
	if templates == nil {
		return []models.FormTemplate{}, nil
	}
	for i := range templates {
		if templates[i].FormSchema != "" {
			json.Unmarshal([]byte(templates[i].FormSchema), &templates[i].FormSchemaData)
		}
	}
	return templates, nil
}

func (s *Service) GetTemplate(ctx context.Context, id, tenantID string) (*models.FormTemplate, error) {
	t, err := s.repo.GetTemplate(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if t.FormSchema != "" {
		json.Unmarshal([]byte(t.FormSchema), &t.FormSchemaData)
	}
	return t, nil
}

func (s *Service) CreateTemplate(ctx context.Context, tenantID, name, description, category string, schema map[string]interface{}) (*models.FormTemplate, error) {
	t := &models.FormTemplate{
		ID:             newID(),
		TenantID:       tenantID,
		Name:           name,
		Description:    description,
		Category:       category,
		IsBuiltin:      false,
		FormSchema:     encodeJSON(schema),
		UsageCount:     0,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		FormSchemaData: schema,
	}
	if err := s.repo.CreateTemplate(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// --- Instance ---

func (s *Service) SubmitInstance(ctx context.Context, formID, tenantID string, req *models.SubmitInstanceRequest) (*models.FormInstance, error) {
	inst := &models.FormInstance{
		ID:          newID(),
		TenantID:    tenantID,
		FormID:      formID,
		Data:        encodeJSON(req.Data),
		Status:      "submitted",
		SubmittedBy: req.SubmitBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		DataMap:     req.Data,
	}
	now := time.Now()
	inst.SubmittedAt = &now
	if err := s.repo.CreateInstance(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

func (s *Service) GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error) {
	inst, err := s.repo.GetInstance(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if inst.Data != "" {
		json.Unmarshal([]byte(inst.Data), &inst.DataMap)
	}
	return inst, nil
}

func (s *Service) ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error) {
	instances, err := s.repo.ListInstances(ctx, tenantID, formID, status)
	if err != nil {
		return nil, err
	}
	if instances == nil {
		return []models.FormInstance{}, nil
	}
	for i := range instances {
		if instances[i].Data != "" {
			json.Unmarshal([]byte(instances[i].Data), &instances[i].DataMap)
		}
	}
	return instances, nil
}

func (s *Service) ApproveInstance(ctx context.Context, id, tenantID string, req *models.ApproveInstanceRequest) (*models.FormInstance, error) {
	attrs := map[string]interface{}{}
	switch req.Action {
	case "approve":
		attrs["status"] = "approved"
		attrs["approved_by"] = req.Approver
		now := time.Now()
		attrs["approved_at"] = &now
	case "reject":
		attrs["status"] = "rejected"
		attrs["approved_by"] = req.Approver
	default:
		// Without this branch every other action produced an empty attribute map
		// and the repository built an UPDATE whose SET clause began with a
		// comma, so the approve route answered 500 instead of telling the caller
		// that the workflow supports only approve and reject.
		return nil, fmt.Errorf("%w: %q", ErrInvalidAction, req.Action)
	}
	return s.repo.UpdateInstance(ctx, id, tenantID, attrs)
}

// --- Component Registry ---

func (s *Service) ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error) {
	comps, err := s.repo.ListComponents(ctx, tenantID, category)
	if err != nil {
		return nil, err
	}
	if comps == nil {
		return []models.ComponentRegistry{}, nil
	}
	for i := range comps {
		if comps[i].PropsSchema != "" {
			json.Unmarshal([]byte(comps[i].PropsSchema), &comps[i].PropsSchemaData)
		}
		if comps[i].DefaultConfig != "" {
			json.Unmarshal([]byte(comps[i].DefaultConfig), &comps[i].DefaultConfigData)
		}
	}
	return comps, nil
}

func (s *Service) GetComponent(ctx context.Context, id, tenantID string) (*models.ComponentRegistry, error) {
	c, err := s.repo.GetComponent(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if c.PropsSchema != "" {
		json.Unmarshal([]byte(c.PropsSchema), &c.PropsSchemaData)
	}
	if c.DefaultConfig != "" {
		json.Unmarshal([]byte(c.DefaultConfig), &c.DefaultConfigData)
	}
	return c, nil
}

func (s *Service) CreateComponent(ctx context.Context, tenantID, name, displayName, category, version string, propsSchema map[string]interface{}, defaultConfig map[string]interface{}, icon string) (*models.ComponentRegistry, error) {
	c := &models.ComponentRegistry{
		ID:            newID(),
		TenantID:      tenantID,
		Name:          name,
		DisplayName:   displayName,
		Category:      category,
		Version:       version,
		PropsSchema:   encodeJSON(propsSchema),
		DefaultConfig: encodeJSON(defaultConfig),
		Icon:          icon,
		CreatedAt:     time.Now(),
	}
	if err := s.repo.CreateComponent(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// getMaxFieldIndex returns the highest sortable_index already used by the form.
// A lookup failure is an error, not zero: folding it into zero reset the sort
// position of the new field to one and collided with an existing row.
func (s *Service) getMaxFieldIndex(ctx context.Context, formID, tenantID string) (int, error) {
	fields, err := s.repo.GetFieldsByForm(ctx, formID, tenantID)
	if err != nil {
		return 0, err
	}
	max := 0
	for _, f := range fields {
		if f.SortableIndex > max {
			max = f.SortableIndex
		}
	}
	return max, nil
}

// newID is a UUID rendered as a string, which is exactly the 36 characters the
// VARCHAR(36) primary keys allow. The previous implementation mixed a prefix, a
// per-second timestamp and four random bytes through FNV and kept eight hex
// characters of the digest, so the entropy was capped at 32 bits within any one
// second and two entities created in the same second collided with probability
// about one in six hundred thousand.
func newID() string {
	return uuid.New().String()
}
