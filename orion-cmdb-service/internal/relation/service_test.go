package relation

import (
	"testing"
)

// TestValidateRelationInput_ValidInput tests validation with valid input
func TestValidateRelationInput(t *testing.T) {
	service := &Service{}

	tests := []struct {
		name    string
		input   *CreateRelationInput
		wantErr bool
	}{
		{
			name: "valid relation input",
			input: &CreateRelationInput{
				FromCiID:     "app-001",
				ToCiID:       "db-001",
				RelationType: "DEPENDS_ON",
				Description:  "App depends on DB",
				TenantID:     1,
				CreatedBy:    "admin",
			},
			wantErr: false,
		},
		{
			name: "missing from_ci_id",
			input: &CreateRelationInput{
				FromCiID:     "",
				ToCiID:       "db-001",
				RelationType: "DEPENDS_ON",
				TenantID:     1,
			},
			wantErr: true,
		},
		{
			name: "missing to_ci_id",
			input: &CreateRelationInput{
				FromCiID:     "app-001",
				ToCiID:       "",
				RelationType: "DEPENDS_ON",
				TenantID:     1,
			},
			wantErr: true,
		},
		{
			name: "missing relation_type",
			input: &CreateRelationInput{
				FromCiID:     "app-001",
				ToCiID:       "db-001",
				RelationType: "",
				TenantID:     1,
			},
			wantErr: true,
		},
		{
			name: "invalid relation_type",
			input: &CreateRelationInput{
				FromCiID:     "app-001",
				ToCiID:       "db-001",
				RelationType: "INVALID_TYPE",
				TenantID:     1,
			},
			wantErr: true,
		},
		{
			name: "nil input",
			input:   nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateInput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateInput() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestCreateRelation_SelfRelation tests that self-relations are rejected
func TestCreateRelation_SelfRelation(t *testing.T) {
	service := &Service{}

	input := &CreateRelationInput{
		FromCiID:     "app-001",
		ToCiID:       "app-001", // Same as from_ci_id
		RelationType: "DEPENDS_ON",
		TenantID:     1,
		CreatedBy:    "admin",
	}

	_, err := service.CreateRelation(input)
	if err != ErrSelfRelation {
		t.Errorf("expected ErrSelfRelation, got %v", err)
	}
}

// TestGetRelationsByCiID_EmptyInput tests that empty inputs are rejected
func TestGetRelationsByCiID(t *testing.T) {
	service := &Service{}

	tests := []struct {
		name      string
		ciID      string
		tenantID  int64
		wantErr   bool
		expectErr error
	}{
		{
			name:      "empty ciID",
			ciID:      "",
			tenantID:  1,
			wantErr:   true,
			expectErr: ErrInvalidRelationInput,
		},
		{
			name:      "zero tenantID",
			ciID:      "app-001",
			tenantID:  0,
			wantErr:   true,
			expectErr: ErrInvalidRelationInput,
		},
		{
			name:      "empty ciID and zero tenantID",
			ciID:      "",
			tenantID:  0,
			wantErr:   true,
			expectErr: ErrInvalidRelationInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.GetRelationsByCiID(tt.ciID, tt.tenantID)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetRelationsByCiID() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != tt.expectErr {
				t.Errorf("expected error %v, got %v", tt.expectErr, err)
			}
		})
	}
}

// TestIsValidRelationType tests relation type validation
func TestIsValidRelationType(t *testing.T) {
	validTypes := []string{
		"DEPENDS_ON",
		"HOSTED_ON",
		"CONNECTS_TO",
		"BELONGS_TO",
		"USES",
		"CONTAINS",
		"VERSION_OF",
		"DEPLOYED_TO",
		"MONITORED_BY",
	}

	for _, rt := range validTypes {
		if !IsValidRelationType(rt) {
			t.Errorf("expected %s to be valid", rt)
		}
	}

	invalidTypes := []string{
		"",
		"INVALID",
		"depends_on",
		"HOSTED_ON_INVALID",
	}

	for _, rt := range invalidTypes {
		if IsValidRelationType(rt) {
			t.Errorf("expected %s to be invalid", rt)
		}
	}
}

// TestValidRelationTypes tests that ValidRelationTypes returns expected count
func TestValidRelationTypes(t *testing.T) {
	types := ValidRelationTypes()
	expectedCount := 9 // DEPENDS_ON, HOSTED_ON, CONNECTS_TO, BELONGS_TO, USES, CONTAINS, VERSION_OF, DEPLOYED_TO, MONITORED_BY

	if len(types) != expectedCount {
		t.Errorf("expected %d relation types, got %d", expectedCount, len(types))
	}
}