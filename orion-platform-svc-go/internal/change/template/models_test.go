package template

import (
	"testing"
	"time"
)

func TestTemplateTypes(t *testing.T) {
	cases := []struct {
		value    TemplateType
		expected string
	}{
		{TemplateTypeStandard, "standard"},
		{TemplateTypeEmergency, "emergency"},
		{TemplateTypeMinor, "minor"},
	}
	for _, tc := range cases {
		if string(tc.value) != tc.expected {
			t.Errorf("TemplateType mismatch: got %q, want %q", tc.value, tc.expected)
		}
	}
}

func TestAuthorities(t *testing.T) {
	cases := []struct {
		value    Authority
		expected string
	}{
		{AuthorityPublic, "public"},
		{AuthorityTeam, "team"},
		{AuthorityPrivate, "private"},
	}
	for _, tc := range cases {
		if string(tc.value) != tc.expected {
			t.Errorf("Authority mismatch: got %q, want %q", tc.value, tc.expected)
		}
	}
}

func TestChangeTemplate_Fields(t *testing.T) {
	now := time.Now()
	desc := "desc"
	team := "team-1"
	tpl := &ChangeTemplate{
		ID:           "id-1",
		TenantID:     "t-1",
		Name:         "template",
		Description:  &desc,
		IsActive:     true,
		Authority:    AuthorityPublic,
		TemplateType: TemplateTypeStandard,
		TeamUUID:     &team,
		CreatedBy:    "user-1",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if tpl.ID != "id-1" {
		t.Errorf("ID mismatch: %q", tpl.ID)
	}
	if *tpl.Description != "desc" {
		t.Errorf("Description mismatch: %q", *tpl.Description)
	}
	if !tpl.IsActive {
		t.Error("IsActive should be true")
	}
	if tpl.Authority != AuthorityPublic {
		t.Errorf("Authority mismatch: %q", tpl.Authority)
	}
	if tpl.TemplateType != TemplateTypeStandard {
		t.Errorf("TemplateType mismatch: %q", tpl.TemplateType)
	}
	if *tpl.TeamUUID != "team-1" {
		t.Errorf("TeamUUID mismatch: %q", *tpl.TeamUUID)
	}
}

func TestChangeSOP_Fields(t *testing.T) {
	now := time.Now()
	desc := "desc"
	sop := &ChangeSOP{
		ID:         "sop-1",
		TenantID:   "t-1",
		TemplateID: "tpl-1",
		Name:       "sop",
		Description: &desc,
		IsActive:   true,
		Authority:  AuthorityTeam,
		SOPType:    TemplateTypeEmergency,
		Version:    3,
		CreatedBy:  "user-1",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if sop.Version != 3 {
		t.Errorf("Version mismatch: %d", sop.Version)
	}
	if sop.SOPType != TemplateTypeEmergency {
		t.Errorf("SOPType mismatch: %q", sop.SOPType)
	}
}

func TestChangeSopStep_Fields(t *testing.T) {
	now := time.Now()
	when := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	worker := "worker-1"
	content := "content"
	st := &ChangeSopStep{
		ID:              "step-1",
		TenantID:        "t-1",
		SOPID:           "sop-1",
		Code:            "install",
		Name:            "Install",
		Content:         &content,
		PlanStartDate:   &when,
		StartTimeWindow: strPtr("09:00-10:00"),
		EndTimeWindow:   strPtr("10:00-11:00"),
		Worker:          &worker,
		FileIDs:         []string{"file-1", "file-2"},
		SortOrder:       1,
		Version:         1,
		CreatedBy:       "user-1",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if len(st.FileIDs) != 2 {
		t.Errorf("FileIDs len mismatch: %d", len(st.FileIDs))
	}
	if st.SortOrder != 1 {
		t.Errorf("SortOrder mismatch: %d", st.SortOrder)
	}
	if *st.PlanStartDate != when {
		t.Error("PlanStartDate mismatch")
	}
}

func TestSOPDetail(t *testing.T) {
	now := time.Now()
	sop := &ChangeSOP{ID: "sop-1", CreatedAt: now, UpdatedAt: now}
	detail := &SOPDetail{
		ChangeSOP: *sop,
		Steps: []*ChangeSopStep{
			{ID: "s1", SortOrder: 1},
			{ID: "s2", SortOrder: 2},
		},
	}
	if detail.ID != "sop-1" {
		t.Errorf("SOPDetail.ID mismatch: %q", detail.ID)
	}
	if len(detail.Steps) != 2 {
		t.Errorf("SOPDetail.Steps len mismatch: %d", len(detail.Steps))
	}
}

func TestCreateChangeTemplateRequest_Defaults(t *testing.T) {
	// Verify request struct accepts defaults (nil = server defaults).
	req := &CreateChangeTemplateRequest{
		Name: "template",
		// Authority / TemplateType / IsActive / TeamUUID all unset
	}
	if req.Name != "template" {
		t.Error("Name should be set")
	}
	if req.Authority != "" {
		t.Errorf("empty Authority expected zero value, got %q", req.Authority)
	}
	if req.IsActive != nil {
		t.Error("IsActive should be nil by default")
	}
}

func TestUpdateChangeTemplateRequest_OptionalFields(t *testing.T) {
	// Verify partial update — only Name set, everything else nil.
	name := "new name"
	req := &UpdateChangeTemplateRequest{Name: &name}
	if *req.Name != "new name" {
		t.Error("Name should be set")
	}
	if req.Description != nil || req.IsActive != nil || req.Authority != nil {
		t.Error("other fields should be nil")
	}
}

func TestUpdateChangeSOPRequest_OptimisticLock(t *testing.T) {
	v := int32(3)
	req := &UpdateChangeSOPRequest{ExpectedVersion: &v}
	if *req.ExpectedVersion != 3 {
		t.Error("ExpectedVersion should be set")
	}
}

func strPtr(s string) *string { return &s }
