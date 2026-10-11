package template

import (
	"context"
	"errors"
	"testing"
)

// mockRepo is a minimal in-memory implementation of Repository for testing.
type svcMockRepo struct {
	templates map[string]*ChangeTemplate
	sops      map[string]*ChangeSOP
	steps     map[string]*ChangeSopStep
	templateErrors, sopErrors, stepErrors map[string]error
	deleted   int
}

func newSvcMockRepo() *svcMockRepo {
	return &svcMockRepo{
		templates:    map[string]*ChangeTemplate{},
		sops:         map[string]*ChangeSOP{},
		steps:        map[string]*ChangeSopStep{},
		templateErrors: map[string]error{},
		sopErrors:      map[string]error{},
		stepErrors:     map[string]error{},
	}
}

func (m *svcMockRepo) CreateTemplate(_ context.Context, _ string, req *CreateChangeTemplateRequest, createdBy string) (*ChangeTemplate, error) {
	if err, ok := m.templateErrors["create"]; ok {
		return nil, err
	}
	return &ChangeTemplate{
		ID:           "tpl-1",
		Name:         req.Name,
		IsActive:     true,
		Authority:    req.Authority,
		TemplateType: req.TemplateType,
		CreatedBy:    createdBy,
	}, nil
}
func (m *svcMockRepo) GetTemplate(_ context.Context, _, id string) (*ChangeTemplate, error) {
	if err, ok := m.templateErrors["get:"+id]; ok {
		return nil, err
	}
	return m.templates[id], nil
}
func (m *svcMockRepo) ListTemplates(_ context.Context, _ string, _ bool) ([]*ChangeTemplate, error) {
	out := make([]*ChangeTemplate, 0, len(m.templates))
	for _, t := range m.templates {
		out = append(out, t)
	}
	return out, nil
}
func (m *svcMockRepo) UpdateTemplate(_ context.Context, _, _ string, req *UpdateChangeTemplateRequest) (*ChangeTemplate, error) {
	if err, ok := m.templateErrors["update"]; ok {
		return nil, err
	}
	return &ChangeTemplate{ID: "tpl-1", Name: "updated", IsActive: true}, nil
}
func (m *svcMockRepo) DeleteTemplate(_ context.Context, _, _ string) (bool, error) {
	m.deleted++
	return true, nil
}

func (m *svcMockRepo) CreateSOP(_ context.Context, _ string, req *CreateChangeSOPRequest, _ string) (*ChangeSOP, error) {
	if err, ok := m.sopErrors["create"]; ok {
		return nil, err
	}
	return &ChangeSOP{
		ID:         "sop-1",
		TemplateID: req.TemplateID,
		Name:       req.Name,
		IsActive:   true,
		Version:    1,
		Authority:  req.Authority,
		SOPType:    req.SOPType,
	}, nil
}
func (m *svcMockRepo) GetSOP(_ context.Context, _, id string) (*ChangeSOP, error) {
	if err, ok := m.sopErrors["get:"+id]; ok {
		return nil, err
	}
	return m.sops[id], nil
}
func (m *svcMockRepo) GetSOPDetail(_ context.Context, _, id string) (*SOPDetail, error) {
	sop, err := m.GetSOP(context.Background(), "", id)
	if err != nil {
		return nil, err
	}
	return &SOPDetail{ChangeSOP: *sop, Steps: []*ChangeSopStep{}}, nil
}
func (m *svcMockRepo) ListSOPs(_ context.Context, _ string, _ string, _ bool) ([]*ChangeSOP, error) {
	out := make([]*ChangeSOP, 0, len(m.sops))
	for _, s := range m.sops {
		out = append(out, s)
	}
	return out, nil
}
func (m *svcMockRepo) UpdateSOP(_ context.Context, _, _ string, req *UpdateChangeSOPRequest) (*ChangeSOP, error) {
	if err, ok := m.sopErrors["update"]; ok {
		return nil, err
	}
	return &ChangeSOP{ID: "sop-1", Name: "updated", Version: 2}, nil
}
func (m *svcMockRepo) DeleteSOP(_ context.Context, _, _ string) (bool, error) { return true, nil }

func (m *svcMockRepo) CreateStep(_ context.Context, _ string, req *CreateChangeSopStepRequest, _ string) (*ChangeSopStep, error) {
	if err, ok := m.stepErrors["create"]; ok {
		return nil, err
	}
	return &ChangeSopStep{
		ID:      "step-1",
		SOPID:   req.SOPID,
		Code:    req.Code,
		Name:    req.Name,
		SortOrder: req.SortOrder,
		Version: 1,
	}, nil
}
func (m *svcMockRepo) GetStep(_ context.Context, _, id string) (*ChangeSopStep, error) {
	return m.steps[id], nil
}
func (m *svcMockRepo) ListSteps(_ context.Context, _ string, _ string) ([]*ChangeSopStep, error) {
	out := make([]*ChangeSopStep, 0, len(m.steps))
	for _, s := range m.steps {
		out = append(out, s)
	}
	return out, nil
}
func (m *svcMockRepo) UpdateStep(_ context.Context, _, _ string, _ *UpdateChangeSopStepRequest) (*ChangeSopStep, error) {
	if err, ok := m.stepErrors["update"]; ok {
		return nil, err
	}
	return &ChangeSopStep{ID: "step-1", Name: "updated", Version: 2}, nil
}
func (m *svcMockRepo) DeleteStep(_ context.Context, _, _ string) (bool, error) { return true, nil }

func TestNewService_NilRepo(t *testing.T) {
	if NewService(nil) != nil {
		t.Fatal("expected nil service for nil repo")
	}
}

func TestService_CreateTemplate_Valid(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	req := &CreateChangeTemplateRequest{Name: "tpl", Authority: AuthorityPublic, TemplateType: TemplateTypeStandard}
	got, err := svc.CreateTemplate(context.Background(), "t1", req, "user1")
	if err != nil {
		t.Fatalf("CreateTemplate failed: %v", err)
	}
	if got.ID != "tpl-1" {
		t.Errorf("ID mismatch: %q", got.ID)
	}
}

func TestService_CreateTemplate_EmptyName(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	_, err := svc.CreateTemplate(context.Background(), "t1", &CreateChangeTemplateRequest{Name: "  "}, "u")
	if !errors.Is(err, ErrValidation) && err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestService_CreateTemplate_InvalidAuthority(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	_, err := svc.CreateTemplate(context.Background(), "t1", &CreateChangeTemplateRequest{
		Name: "x", Authority: Authority("bogus"),
	}, "u")
	if !errors.Is(err, ErrValidation) && err == nil {
		t.Fatal("expected error for invalid authority")
	}
}

func TestService_CreateTemplate_InvalidTemplateType(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	_, err := svc.CreateTemplate(context.Background(), "t1", &CreateChangeTemplateRequest{
		Name: "x", TemplateType: TemplateType("bogus"),
	}, "u")
	if err == nil {
		t.Fatal("expected error for invalid templateType")
	}
}

func TestService_CreateTemplate_NilRequest(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	if _, err := svc.CreateTemplate(context.Background(), "t1", nil, "u"); err == nil {
		t.Fatal("expected error for nil request")
	}
}

func TestService_UpdateTemplate_NilRequest(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	if _, err := svc.UpdateTemplate(context.Background(), "t1", "tpl", nil); err == nil {
		t.Fatal("expected error for nil request")
	}
}

func TestService_UpdateTemplate_EmptyName(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	name := "   "
	if _, err := svc.UpdateTemplate(context.Background(), "t1", "tpl", &UpdateChangeTemplateRequest{Name: &name}); err == nil {
		t.Fatal("expected error for empty name in update")
	}
}

func TestService_CreateSOP_Validation(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	// Missing TemplateID.
	if _, err := svc.CreateSOP(context.Background(), "t1", &CreateChangeSOPRequest{Name: "sop"}, "u"); err == nil {
		t.Fatal("expected error for missing TemplateID")
	}
	// Missing Name.
	if _, err := svc.CreateSOP(context.Background(), "t1", &CreateChangeSOPRequest{TemplateID: "tpl"}, "u"); err == nil {
		t.Fatal("expected error for missing Name")
	}
	// Invalid authority.
	if _, err := svc.CreateSOP(context.Background(), "t1", &CreateChangeSOPRequest{
		TemplateID: "tpl", Name: "sop", Authority: Authority("bogus"),
	}, "u"); err == nil {
		t.Fatal("expected error for invalid authority")
	}
}

func TestService_CreateStep_Validation(t *testing.T) {
	svc := NewService(newSvcMockRepo())
	// Missing sopId.
	if _, err := svc.CreateStep(context.Background(), "t1", &CreateChangeSopStepRequest{Code: "c", Name: "n"}, "u"); err == nil {
		t.Fatal("expected error for missing sopId")
	}
	// Missing code.
	if _, err := svc.CreateStep(context.Background(), "t1", &CreateChangeSopStepRequest{SOPID: "s", Name: "n"}, "u"); err == nil {
		t.Fatal("expected error for missing code")
	}
	// Missing name.
	if _, err := svc.CreateStep(context.Background(), "t1", &CreateChangeSopStepRequest{SOPID: "s", Code: "c"}, "u"); err == nil {
		t.Fatal("expected error for missing name")
	}
	// Valid.
	got, err := svc.CreateStep(context.Background(), "t1", &CreateChangeSopStepRequest{
		SOPID: "s", Code: "c", Name: "n",
	}, "u")
	if err != nil {
		t.Fatalf("CreateStep failed: %v", err)
	}
	if got.ID != "step-1" {
		t.Errorf("ID mismatch: %q", got.ID)
	}
}

func TestService_DeleteTemplate(t *testing.T) {
	repo := newSvcMockRepo()
	svc := NewService(repo)
	deleted, err := svc.DeleteTemplate(context.Background(), "t1", "tpl")
	if err != nil {
		t.Fatalf("DeleteTemplate failed: %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true")
	}
}

func TestIsValidAuthority(t *testing.T) {
	cases := []struct {
		value    Authority
		expected bool
	}{
		{AuthorityPublic, true},
		{AuthorityTeam, true},
		{AuthorityPrivate, true},
		{Authority("bogus"), false},
		{Authority(""), false},
	}
	for _, tc := range cases {
		if got := isValidAuthority(tc.value); got != tc.expected {
			t.Errorf("isValidAuthority(%q)=%v, want %v", tc.value, got, tc.expected)
		}
	}
}

func TestIsValidTemplateType(t *testing.T) {
	cases := []struct {
		value    TemplateType
		expected bool
	}{
		{TemplateTypeStandard, true},
		{TemplateTypeEmergency, true},
		{TemplateTypeMinor, true},
		{TemplateType("bogus"), false},
	}
	for _, tc := range cases {
		if got := isValidTemplateType(tc.value); got != tc.expected {
			t.Errorf("isValidTemplateType(%q)=%v, want %v", tc.value, got, tc.expected)
		}
	}
}
