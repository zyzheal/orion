package attribute

import (
	"regexp"
	"testing"
)

func TestEnumValidator_AcceptsAllowed(t *testing.T) {
	v := &EnumValidator{Allowed: []string{"a", "b", "c"}}
	if err := v.Validate(nil, "b"); err != nil {
		t.Fatalf("expected b to be allowed, got %v", err)
	}
}

func TestEnumValidator_RejectsNonAllowed(t *testing.T) {
	v := &EnumValidator{Allowed: []string{"a", "b"}}
	err := v.Validate(nil, "z")
	if err == nil {
		t.Fatal("expected error for non-allowed value")
	}
	var ve *ValidationError
	if !asValidationError(err, &ve) {
		t.Fatalf("expected ValidationError, got %T", err)
	}
}

func TestEnumValidator_RejectsNil(t *testing.T) {
	v := &EnumValidator{Allowed: []string{"a"}}
	if err := v.Validate(nil, nil); err == nil {
		t.Fatal("expected error for nil")
	}
}

func TestEnumValidator_RejectsWrongType(t *testing.T) {
	v := &EnumValidator{Allowed: []string{"1"}}
	if err := v.Validate(nil, 1); err == nil {
		t.Fatal("expected error for int value")
	}
}

func TestRangeValidator_AcceptsInRange(t *testing.T) {
	v := &RangeValidator{Min: 0, Max: 10}
	for _, v2 := range []any{0, 1, 5.5, 10} {
		if err := v.Validate(nil, v2); err != nil {
			t.Errorf("expected %v to be valid, got %v", v2, err)
		}
	}
}

func TestRangeValidator_RejectsOutOfRange(t *testing.T) {
	v := &RangeValidator{Min: 0, Max: 10}
	if err := v.Validate(nil, -1); err == nil {
		t.Error("expected error for -1")
	}
	if err := v.Validate(nil, 11); err == nil {
		t.Error("expected error for 11")
	}
}

func TestRangeValidator_AcceptsStringNumbers(t *testing.T) {
	v := &RangeValidator{Min: 0, Max: 10}
	if err := v.Validate(nil, "5"); err != nil {
		t.Fatalf("expected string \"5\" to be valid, got %v", err)
	}
}

func TestRangeValidator_RejectsNonNumber(t *testing.T) {
	v := &RangeValidator{Min: 0, Max: 10}
	if err := v.Validate(nil, "abc"); err == nil {
		t.Fatal("expected error for non-numeric string")
	}
}

func TestRangeValidator_RejectsNil(t *testing.T) {
	v := &RangeValidator{Min: 0, Max: 10}
	if err := v.Validate(nil, nil); err == nil {
		t.Fatal("expected error for nil")
	}
}

func TestCIRefValidator_AcceptsNonEmpty(t *testing.T) {
	v := &CIRefValidator{}
	if err := v.Validate(nil, "ci-123"); err != nil {
		t.Fatalf("expected ci-123 to be valid, got %v", err)
	}
}

func TestCIRefValidator_RejectsEmpty(t *testing.T) {
	v := &CIRefValidator{}
	if err := v.Validate(nil, ""); err == nil {
		t.Fatal("expected error for empty string")
	}
}

func TestCIRefValidator_RejectsNil(t *testing.T) {
	v := &CIRefValidator{}
	if err := v.Validate(nil, nil); err == nil {
		t.Fatal("expected error for nil")
	}
}

func TestCIRefValidator_RejectsWrongType(t *testing.T) {
	v := &CIRefValidator{}
	if err := v.Validate(nil, 42); err == nil {
		t.Fatal("expected error for int value")
	}
}

func TestPassValidator_AcceptsNonNil(t *testing.T) {
	v := &PassValidator{}
	if err := v.Validate(nil, "anything"); err != nil {
		t.Fatalf("expected anything to be valid, got %v", err)
	}
}

func TestPassValidator_RejectsNil(t *testing.T) {
	v := &PassValidator{}
	if err := v.Validate(nil, nil); err == nil {
		t.Fatal("expected error for nil")
	}
}

// asValidationError is a small wrapper so tests don't have to import
// errors just for a single Is check.
func asValidationError(err error, target **ValidationError) bool {
	if err == nil {
		return false
	}
	ve, ok := err.(*ValidationError)
	if !ok {
		return false
	}
	*target = ve
	return true
}
func TestRegexValidator_AcceptsMatch(t *testing.T) {
	v := &RegexValidator{
		Pattern: regexp.MustCompile(`^[a-z]+$`),
		Source:  `^[a-z]+$`,
	}
	if err := v.Validate(nil, "abc"); err != nil {
		t.Fatalf("expected abc to match, got %v", err)
	}
}

func TestRegexValidator_RejectsNonMatch(t *testing.T) {
	v := &RegexValidator{
		Pattern: regexp.MustCompile(`^[a-z]+$`),
		Source:  `^[a-z]+$`,
	}
	if err := v.Validate(nil, "ABC"); err == nil {
		t.Fatal("expected ABC to fail")
	}
}

func TestRegexValidator_RejectsNil(t *testing.T) {
	v := &RegexValidator{Pattern: regexp.MustCompile(`.*`), Source: ".*"}
	if err := v.Validate(nil, nil); err == nil {
		t.Fatal("expected error for nil")
	}
}
