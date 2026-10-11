package attribute

import (
	"context"
	"errors"
	"testing"
)

func TestSchema_Valid(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Validator: map[string]any{"values": []any{"low", "high"}}},
		{ID: "2", Name: "port", AttributeType: AttrTypeInt, Validator: map[string]any{"min": 1, "max": 65535}},
	}
	values := map[string]any{
		"level": "low",
		"port":  8080,
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, values)
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors, got %d: %v", result.Len(), result)
	}
	if !IsValid(result) {
		t.Fatal("expected IsValid to be true")
	}
}

func TestSchema_RequiredMissing(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Required: true},
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, map[string]any{})
	if result.Len() != 1 {
		t.Fatalf("expected 1 error, got %d", result.Len())
	}
	// Verify it's a ValidationError on the "level" attribute.
	var ve *ValidationError
	if !asValidationError(result.Errors[0], &ve) {
		t.Fatalf("expected ValidationError, got %T", result.Errors[0])
	}
	if ve.Attribute != "level" {
		t.Fatalf("expected attribute=level, got %q", ve.Attribute)
	}
}

func TestSchema_OptionalMissing_NoError(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Required: false},
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, map[string]any{})
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors for missing optional, got %d", result.Len())
	}
}

func TestSchema_UnknownAttribute(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Validator: map[string]any{"values": []any{"low", "high"}}},
	}
	values := map[string]any{
		"level":   "low",
		"unknown": "value",
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, values)
	if result.Len() != 1 {
		t.Fatalf("expected 1 error (unknown attr), got %d: %v", result.Len(), result)
	}
}

func TestSchema_ValidationFails(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Validator: map[string]any{"values": []any{"low", "high"}}},
	}
	values := map[string]any{
		"level": "middle", // not allowed
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, values)
	if result.Len() != 1 {
		t.Fatalf("expected 1 error, got %d", result.Len())
	}
}

func TestSchema_EmptyDefinitions(t *testing.T) {
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", nil, map[string]any{})
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors for empty defs, got %d", result.Len())
	}
}

func TestSchema_NilDefinitions(t *testing.T) {
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", nil, nil)
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors for nil defs, got %d", result.Len())
	}
}

func TestSchema_NilValues(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum},
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, nil)
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors (all optional), got %d", result.Len())
	}
}

func TestSchema_MultipleErrors(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "req1", AttributeType: AttrTypeEnum, Required: true},
		{ID: "2", Name: "req2", AttributeType: AttrTypeEnum, Required: true},
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, map[string]any{})
	if result.Len() != 2 {
		t.Fatalf("expected 2 errors, got %d", result.Len())
	}
}

func TestSchema_ErrValidationError_Sentinel(t *testing.T) {
	defs := []*Attribute{
		{ID: "1", Name: "req", AttributeType: AttrTypeEnum, Required: true},
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, nil)
	if result.Len() == 0 {
		t.Fatal("expected errors")
	}
	// Verify ErrValidationError matches any ValidationErrors with errors.
	if !errors.Is(result, ErrValidationError) {
		t.Fatalf("expected errors.Is to match ErrValidationError")
	}
}

func TestSchema_ErrValidationError_NilResult(t *testing.T) {
	var nilResult *ValidationErrors
	if errors.Is(nilResult, ErrValidationError) {
		t.Fatal("nil ValidationErrors should not match ErrValidationError")
	}
	// Empty result should not match either.
	empty := &ValidationErrors{}
	if errors.Is(empty, ErrValidationError) {
		t.Fatal("empty ValidationErrors should not match ErrValidationError")
	}
}

func TestValidationErrors_Error_Empty(t *testing.T) {
	v := &ValidationErrors{}
	if v.Error() == "" {
		t.Fatal("expected non-empty error message for empty ValidationErrors")
	}
}

func TestValidationErrors_Nil_Error(t *testing.T) {
	var v *ValidationErrors
	if v.Len() != 0 {
		t.Fatal("nil ValidationErrors.Len() should be 0")
	}
	msg := v.Error()
	if msg[:len("attribute")] != "attribute" {
		t.Fatal("nil ValidationErrors.Error() should start with 'attribute'")
	}
	_ = msg // just exercise
}

func TestSchema_WithCustomFactory(t *testing.T) {
	// Custom factory with only the enum handler.
	f := NewAttrValueHandlerFactory()
	f.Register(&EnumValidatorHandler{})
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum, Validator: map[string]any{"values": []any{"low", "high"}}},
	}
	values := map[string]any{"level": "high"}
	result := ValidateCIAttributes(context.Background(), f, "t1", "ci-1", defs, values)
	if result.Len() != 0 {
		t.Fatalf("expected 0 errors, got %d", result.Len())
	}
}

func TestSchema_AttributeIDMissing(t *testing.T) {
	defs := []*Attribute{
		{Name: "level", AttributeType: AttrTypeEnum}, // no ID
	}
	result := ValidateCIAttributes(context.Background(), nil, "t1", "ci-1", defs, nil)
	if result.Len() != 1 {
		t.Fatalf("expected 1 error (missing ID), got %d", result.Len())
	}
}

func TestSchema_AttributeBuildFails(t *testing.T) {
	// Use empty factory so enum handler is unregistered — BuildValidator returns ErrNoValidator.
	f := NewAttrValueHandlerFactory()
	defs := []*Attribute{
		{ID: "1", Name: "level", AttributeType: AttrTypeEnum},
	}
	values := map[string]any{"level": "low"}
	result := ValidateCIAttributes(context.Background(), f, "t1", "ci-1", defs, values)
	if result.Len() != 1 {
		t.Fatalf("expected 1 error (build failure), got %d", result.Len())
	}
	if !errors.Is(result.Errors[0], ErrNoValidator) {
		t.Fatalf("expected ErrNoValidator, got %v", result.Errors[0])
	}
}
