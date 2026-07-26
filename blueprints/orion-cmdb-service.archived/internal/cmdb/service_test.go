package cmdb

import (
	"testing"
)

// TestValidateCIInput_ValidInput tests validation with valid input
func TestValidateCIInput_ValidInput(t *testing.T) {
	validator := NewValidator()

	input := &CreateCIInput{
		CiID:        "app-001",
		CiType:      "APPLICATION",
		Name:        "Test Application",
		Description: "A test application",
		Status:      "ACTIVE",
		Environment: "production",
		Tags:        []string{"web", "critical"},
		Attributes:  map[string]string{"owner": "team-a"},
		TenantID:    1,
		CreatedBy:   "admin",
	}

	err := validator.ValidateCreateInput(input)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

// TestValidateCIInput_MissingCiID tests validation with missing ci_id
func TestValidateCIInput_MissingCiID(t *testing.T) {
	validator := NewValidator()

	input := &CreateCIInput{
		CiID:   "",
		CiType: "APPLICATION",
		Name:   "Test Application",
	}

	err := validator.ValidateCreateInput(input)
	if err == nil {
		t.Error("expected error for missing ci_id, got nil")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Error("expected ValidationError")
	}

	if validationErr.Field != "ci_id" {
		t.Errorf("expected field 'ci_id', got '%s'", validationErr.Field)
	}
}

// TestValidateCIInput_InvalidCiType tests validation with invalid ci_type
func TestValidateCIInput_InvalidCiType(t *testing.T) {
	validator := NewValidator()

	input := &CreateCIInput{
		CiID:   "app-001",
		CiType: "INVALID_TYPE",
		Name:   "Test Application",
	}

	err := validator.ValidateCreateInput(input)
	if err == nil {
		t.Error("expected error for invalid ci_type, got nil")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Error("expected ValidationError")
	}

	if validationErr.Field != "ci_type" {
		t.Errorf("expected field 'ci_type', got '%s'", validationErr.Field)
	}
}

// TestValidateCIInput_DefaultStatus tests that default status is applied
func TestValidateCIInput_DefaultStatus(t *testing.T) {
	validator := NewValidator()

	input := &CreateCIInput{
		CiID:   "app-001",
		CiType: "APPLICATION",
		Name:   "Test Application",
		Status: "", // Empty status should be set to ACTIVE
	}

	// Validate should pass (status is not required)
	err := validator.ValidateCreateInput(input)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	// Apply defaults
	validator.ApplyDefaults(input)

	// Check default status is applied
	if input.Status != "ACTIVE" {
		t.Errorf("expected status 'ACTIVE', got '%s'", input.Status)
	}
}

// TestValidateCIInput_AllValidCiTypes tests all valid CI types
func TestValidateCIInput_AllValidCiTypes(t *testing.T) {
	validator := NewValidator()

	validTypes := []string{
		"APPLICATION",
		"SERVICE",
		"DATABASE",
		"SERVER",
		"CONTAINER",
		"K8S_CLUSTER",
		"K8S_DEPLOYMENT",
		"K8S_POD",
		"NETWORK",
		"LOAD_BALANCER",
		"MIDDLEWARE",
		"PIPELINE",
		"ENVIRONMENT",
	}

	for _, ciType := range validTypes {
		input := &CreateCIInput{
			CiID:   "test-001",
			CiType: ciType,
			Name:   "Test CI",
		}

		err := validator.ValidateCreateInput(input)
		if err != nil {
			t.Errorf("expected no error for ci_type %s, got %v", ciType, err)
		}
	}
}

// TestValidateCIInput_InvalidStatus tests validation with invalid status
func TestValidateCIInput_InvalidStatus(t *testing.T) {
	validator := NewValidator()

	input := &CreateCIInput{
		CiID:   "app-001",
		CiType: "APPLICATION",
		Name:   "Test Application",
		Status: "INVALID_STATUS",
	}

	err := validator.ValidateCreateInput(input)
	if err == nil {
		t.Error("expected error for invalid status, got nil")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Error("expected ValidationError")
	}

	if validationErr.Field != "status" {
		t.Errorf("expected field 'status', got '%s'", validationErr.Field)
	}
}

// TestValidateUpdateInput_EmptyInput tests validation with empty update input
func TestValidateUpdateInput_EmptyInput(t *testing.T) {
	validator := NewValidator()

	input := &UpdateCIInput{}

	err := validator.ValidateUpdateInput(input)
	if err == nil {
		t.Error("expected error for empty update input, got nil")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Error("expected ValidationError")
	}

	if validationErr.Field != "input" {
		t.Errorf("expected field 'input', got '%s'", validationErr.Field)
	}
}

// TestValidateUpdateInput_ValidInput tests validation with valid update input
func TestValidateUpdateInput_ValidInput(t *testing.T) {
	validator := NewValidator()

	input := &UpdateCIInput{
		Description: "Updated description",
		Status:      "INACTIVE",
	}

	err := validator.ValidateUpdateInput(input)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

// TestApplyDefaults tests default value application
func TestApplyDefaults(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name     string
		input    *CreateCIInput
		check    func(*CreateCIInput)
	}{
		{
			name: "empty status should default to ACTIVE",
			input: &CreateCIInput{
				CiID:   "test-001",
				CiType: "APPLICATION",
				Name:   "Test",
				Status: "",
			},
			check: func(input *CreateCIInput) {
				if input.Status != "ACTIVE" {
					t.Errorf("expected status 'ACTIVE', got '%s'", input.Status)
				}
			},
		},
		{
			name: "nil tags should become empty slice",
			input: &CreateCIInput{
				CiID:   "test-001",
				CiType: "APPLICATION",
				Name:   "Test",
				Tags:   nil,
			},
			check: func(input *CreateCIInput) {
				if input.Tags == nil {
					t.Error("expected tags to be initialized, got nil")
				}
			},
		},
		{
			name: "nil attributes should become empty map",
			input: &CreateCIInput{
				CiID:       "test-001",
				CiType:     "APPLICATION",
				Name:       "Test",
				Attributes: nil,
			},
			check: func(input *CreateCIInput) {
				if input.Attributes == nil {
					t.Error("expected attributes to be initialized, got nil")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator.ApplyDefaults(tt.input)
			tt.check(tt.input)
		})
	}
}