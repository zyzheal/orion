package cmdb

import (
	"fmt"
	"strings"
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Validator validates CI input
type Validator struct{}

// NewValidator creates a new validator
func NewValidator() *Validator {
	return &Validator{}
}

// ValidateCreateInput validates the input for creating a CI
func (v *Validator) ValidateCreateInput(input *CreateCIInput) error {
	// Validate required fields
	if strings.TrimSpace(input.CiID) == "" {
		return &ValidationError{Field: "ci_id", Message: "ci_id is required"}
	}
	if strings.TrimSpace(input.CiType) == "" {
		return &ValidationError{Field: "ci_type", Message: "ci_type is required"}
	}
	if strings.TrimSpace(input.Name) == "" {
		return &ValidationError{Field: "name", Message: "name is required"}
	}

	// Validate ci_type is valid
	if !IsValidCiType(input.CiType) {
		return &ValidationError{
			Field:   "ci_type",
			Message: fmt.Sprintf("invalid ci_type: %s. Valid types are: %s", input.CiType, strings.Join(validCiTypeStrings(), ", ")),
		}
	}

	// Validate status if provided
	if input.Status != "" && !isValidStatus(input.Status) {
		return &ValidationError{
			Field:   "status",
			Message: fmt.Sprintf("invalid status: %s. Valid statuses are: ACTIVE, INACTIVE, DECOMMISSIONED, PENDING, MAINTENANCE", input.Status),
		}
	}

	return nil
}

// ValidateUpdateInput validates the input for updating a CI
func (v *Validator) ValidateUpdateInput(input *UpdateCIInput) error {
	// At least one field must be provided
	if input.Description == "" &&
		input.Status == "" &&
		input.Environment == "" &&
		input.Tags == nil &&
		input.Attributes == nil {
		return &ValidationError{Field: "input", Message: "at least one field must be provided for update"}
	}

	// Validate status if provided
	if input.Status != "" && !isValidStatus(input.Status) {
		return &ValidationError{
			Field:   "status",
			Message: fmt.Sprintf("invalid status: %s. Valid statuses are: ACTIVE, INACTIVE, DECOMMISSIONED, PENDING, MAINTENANCE", input.Status),
		}
	}

	return nil
}

// ApplyDefaults applies default values to the input
func (v *Validator) ApplyDefaults(input *CreateCIInput) {
	// Set default status
	if input.Status == "" {
		input.Status = string(CiStatusActive)
	}

	// Initialize slices and maps if nil
	if input.Tags == nil {
		input.Tags = []string{}
	}
	if input.Attributes == nil {
		input.Attributes = make(map[string]string)
	}
}

// validCiTypeStrings returns all valid CI type strings
func validCiTypeStrings() []string {
	types := ValidCiTypes()
	result := make([]string, len(types))
	for i, t := range types {
		result[i] = string(t)
	}
	return result
}

// isValidStatus checks if the given status is valid
func isValidStatus(status string) bool {
	validStatuses := []string{
		string(CiStatusActive),
		string(CiStatusInactive),
		string(CiStatusDecommissioned),
		string(CiStatusPending),
		string(CiStatusMaintenance),
	}
	for _, s := range validStatuses {
		if status == s {
			return true
		}
	}
	return false
}