package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"time"

	"orion/platform-svc-go/internal/lowcode-designer/models"
)

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
	GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error)
	UpdateTemplateUsage(ctx context.Context, id string) error

	CreateInstance(ctx context.Context, inst *models.FormInstance) error
	GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error)
	ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error)
	UpdateInstance(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormInstance, error)

	CreateComponent(ctx context.Context, c *models.ComponentRegistry) error
	ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error)
	GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Form Definition CRUD ---

func (s *Service) CreateForm(ctx context.Context, req *models.CreateFormRequest, tenantID, operator string) (*models.FormDefinition, error) {
	fieldsJSON, _ := json.Marshal(req.Fields)
	layoutJSON, _ := json.Marshal(req.Layout)
	tagsJSON, _ := json.Marshal(req.Tags)
	metaJSON, _ := json.Marshal(req.Meta)

	f := &models.FormDefinition{
		ID:          generateID("fd"),
		TenantID:    tenantID,
		Name:        req.Name,
		Title:       req.Title,
		Description: req.Description,
		Version:     1,
		Status:      "draft",
		Category:    req.Category,
		ModuleName:  req.ModuleName,
		Tags:        string(tagsJSON),
		Layout:      string(layoutJSON),
		FieldsJSON:  string(fieldsJSON),
		Meta:        string(metaJSON),
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
			ID:            generateID("ff"),
			TenantID:      tenantID,
			FormID:        f.ID,
			Key:           req.Fields[i].Key,
			Label:         req.Fields[i].Label,
			Type:          req.Fields[i].Type,
			Required:      req.Fields[i].Required,
			Visible:       req.Fields[i].Visible,
			Disabled:      req.Fields[i].Disabled,
			Placeholder:   req.Fields[i].Placeholder,
			SortableIndex: i,
			ParentKey:     req.Fields[i].ParentKey,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if opts, _ := json.Marshal(req.Fields[i].Options); len(opts) > 0 {
			field.Options = string(opts)
		}
		if rules, _ := json.Marshal(req.Fields[i].Rules); len(rules) > 0 {
			field.Rules = string(rules)
		}
		if meta, _ := json.Marshal(req.Fields[i].Meta); len(meta) > 0 {
			field.Meta = string(meta)
		}
		s.repo.CreateField(ctx, field)
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
		tagsJSON, _ := json.Marshal(req.Tags)
		attrs["tags"] = string(tagsJSON)
	}
	if req.Layout != nil {
		layoutJSON, _ := json.Marshal(req.Layout)
		attrs["layout"] = string(layoutJSON)
	}
	if req.Fields != nil {
		fieldsJSON, _ := json.Marshal(req.Fields)
		attrs["fields"] = string(fieldsJSON)
	}
	if req.Meta != nil {
		metaJSON, _ := json.Marshal(req.Meta)
		attrs["meta"] = string(metaJSON)
	}
	attrs["updated_by"] = operator

	updated, err := s.repo.UpdateForm(ctx, id, tenantID, attrs)
	if err != nil {
		return nil, err
	}
	// Refresh fields list
	updated.FieldsList, _ = s.GetFieldsByForm(ctx, id, tenantID)
	return updated, nil
}

func (s *Service) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeleteForm(ctx, id, tenantID)
}

// --- Field ---

func (s *Service) CreateField(ctx context.Context, formID, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error) {
	maxIdx, _ := s.getMaxFieldIndex(ctx, formID, tenantID)
	field := &models.FormField{
		ID:            generateID("ff"),
		TenantID:      tenantID,
		FormID:        formID,
		Key:           req.Key,
		Label:         req.Label,
		Type:          req.Type,
		Required:      req.Required,
		Visible:       req.Visible,
		Disabled:      req.Disabled,
		Placeholder:   req.Placeholder,
		SortableIndex: maxIdx + 1,
		ParentKey:     req.ParentKey,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if req.Options != nil {
		optsJSON, _ := json.Marshal(req.Options)
		field.Options = string(optsJSON)
		field.OptionsList = req.Options
	}
	if req.Rules != nil {
		rulesJSON, _ := json.Marshal(req.Rules)
		field.Rules = string(rulesJSON)
		field.RulesList = req.Rules
	}
	if req.Meta != nil {
		metaJSON, _ := json.Marshal(req.Meta)
		field.Meta = string(metaJSON)
		field.MetaData = req.Meta
	}
	if req.LayoutConfig != nil {
		layoutJSON, _ := json.Marshal(req.LayoutConfig)
		field.LayoutConfig = string(layoutJSON)
		field.LayoutData = req.LayoutConfig
	}
	if req.DefaultVal != nil {
		defJSON, _ := json.Marshal(req.DefaultVal)
		field.DefaultVal = string(defJSON)
		field.DefaultValData = req.DefaultVal
	}

	if err := s.repo.CreateField(ctx, field); err != nil {
		return nil, err
	}
	return field, nil
}

func (s *Service) UpdateField(ctx context.Context, id, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error) {
	attrs := make(map[string]interface{})
	if req.Label != "" {
		attrs["label"] = req.Label
	}
	if req.Type != "" {
		attrs["type"] = req.Type
	}
	attrs["required"] = req.Required
	attrs["visible"] = req.Visible
	attrs["disabled"] = req.Disabled
	if req.Placeholder != "" {
		attrs["placeholder"] = req.Placeholder
	}
	if req.SortableIndex >= 0 {
		attrs["sortable_index"] = req.SortableIndex
	}
	if req.ParentKey != "" {
		attrs["parent_key"] = req.ParentKey
	}
	if req.Options != nil {
		optsJSON, _ := json.Marshal(req.Options)
		attrs["options"] = string(optsJSON)
	}
	if req.Rules != nil {
		rulesJSON, _ := json.Marshal(req.Rules)
		attrs["rules"] = string(rulesJSON)
	}
	if req.Meta != nil {
		metaJSON, _ := json.Marshal(req.Meta)
		attrs["meta"] = string(metaJSON)
	}
	if req.LayoutConfig != nil {
		layoutJSON, _ := json.Marshal(req.LayoutConfig)
		attrs["layout_config"] = string(layoutJSON)
	}
	if req.DefaultVal != nil {
		defJSON, _ := json.Marshal(req.DefaultVal)
		attrs["default_val"] = string(defJSON)
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

func (s *Service) GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error) {
	t, err := s.repo.GetTemplate(ctx, id)
	if err != nil {
		return nil, err
	}
	if t.FormSchema != "" {
		json.Unmarshal([]byte(t.FormSchema), &t.FormSchemaData)
	}
	return t, nil
}

func (s *Service) CreateTemplate(ctx context.Context, tenantID, name, description, category string, schema map[string]interface{}) (*models.FormTemplate, error) {
	schemaJSON, _ := json.Marshal(schema)
	t := &models.FormTemplate{
		ID:             generateID("ft"),
		TenantID:       tenantID,
		Name:           name,
		Description:    description,
		Category:       category,
		IsBuiltin:      false,
		FormSchema:     string(schemaJSON),
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
	dataJSON, _ := json.Marshal(req.Data)
	inst := &models.FormInstance{
		ID:          generateID("fi"),
		TenantID:    tenantID,
		FormID:      formID,
		Data:        string(dataJSON),
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
	s.repo.UpdateTemplateUsage(ctx, formID)
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
	var now time.Time
	if req.Action == "approve" {
		attrs["status"] = "approved"
		attrs["approved_by"] = req.Approver
		now = time.Now()
		attrs["approved_at"] = &now
	} else if req.Action == "reject" {
		attrs["status"] = "rejected"
		attrs["approved_by"] = req.Approver
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

func (s *Service) GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error) {
	c, err := s.repo.GetComponent(ctx, id)
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
	propsJSON, _ := json.Marshal(propsSchema)
	defConfigJSON, _ := json.Marshal(defaultConfig)
	c := &models.ComponentRegistry{
		ID:            generateID("cr"),
		TenantID:      tenantID,
		Name:          name,
		DisplayName:   displayName,
		Category:      category,
		Version:       version,
		PropsSchema:   string(propsJSON),
		DefaultConfig: string(defConfigJSON),
		Icon:          icon,
		CreatedAt:     time.Now(),
	}
	if err := s.repo.CreateComponent(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) getMaxFieldIndex(ctx context.Context, formID, tenantID string) (int, error) {
	fields, err := s.repo.GetFieldsByForm(ctx, formID, tenantID)
	if err != nil {
		return 0, nil
	}
	max := 0
	for _, f := range fields {
		if f.SortableIndex > max {
			max = f.SortableIndex
		}
	}
	return max, nil
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	h := fnv.New64a()
	h.Write([]byte(prefix + "-" + time.Now().Format("20060102150405") + "-" + hex.EncodeToString(b)))
	return fmt.Sprintf("%s-%x", prefix, h.Sum(nil)[:8])
}
