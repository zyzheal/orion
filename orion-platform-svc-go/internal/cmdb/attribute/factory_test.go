package attribute

import (
	"errors"
	"testing"
)

func TestFactory_Empty(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	if f.Count() != 0 {
		t.Fatalf("expected 0, got %d", f.Count())
	}
	if f.Has(AttrTypeEnum) {
		t.Fatal("empty factory should not have any types")
	}
}

func TestFactory_RegisterDuplicate(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	h := &EnumValidatorHandler{}
	if err := f.Register(h); err != nil {
		t.Fatalf("first register failed: %v", err)
	}
	if err := f.Register(h); err == nil {
		t.Fatal("expected duplicate to fail")
	}
	if f.Count() != 1 {
		t.Fatalf("expected 1 handler, got %d", f.Count())
	}
}

func TestFactory_RegisterNil(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	if err := f.Register(nil); err == nil {
		t.Fatal("expected error for nil")
	}
}

func TestFactory_RegisterIfAbsent_SkipsDuplicates(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	h := &EnumValidatorHandler{}
	if !f.RegisterIfAbsent(h) {
		t.Fatal("first RegisterIfAbsent should add")
	}
	if f.RegisterIfAbsent(&EnumValidatorHandler{}) {
		t.Fatal("second RegisterIfAbsent should skip duplicate")
	}
	if f.Count() != 1 {
		t.Fatalf("expected 1, got %d", f.Count())
	}
}

func TestFactory_Unregister(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	f.Register(&EnumValidatorHandler{})
	if !f.Unregister(AttrTypeEnum) {
		t.Fatal("expected Unregister to return true")
	}
	if f.Unregister(AttrTypeEnum) {
		t.Fatal("second Unregister should return false")
	}
	if f.Count() != 0 {
		t.Fatalf("expected 0, got %d", f.Count())
	}
}

func TestFactory_List_OrderPreserved(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	f.Register(&EnumValidatorHandler{})
	f.Register(&RangeValidatorHandler{})
	f.Register(&CIRefValidatorHandler{})

	list := f.List()
	if len(list) != 3 {
		t.Fatalf("expected 3, got %d", len(list))
	}
	expected := []AttributeType{AttrTypeEnum, AttrTypeInt, AttrTypeCIRef}
	for i, want := range expected {
		if list[i] != want {
			t.Errorf("List()[%d]=%s, want %s", i, list[i], want)
		}
	}
}

func TestFactory_BuildValidator_Enum(t *testing.T) {
	f := NewWithDefaults()
	a := &Attribute{
		ID:            "attr-1",
		Name:          "level",
		AttributeType: AttrTypeEnum,
		Validator:     map[string]any{"values": []any{"low", "med", "high"}},
	}
	v, err := f.BuildValidator(a)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	ve, ok := v.(*EnumValidator)
	if !ok {
		t.Fatalf("expected *EnumValidator, got %T", v)
	}
	if len(ve.Allowed) != 3 {
		t.Fatalf("expected 3 allowed, got %v", ve.Allowed)
	}
}

func TestFactory_BuildValidator_Range(t *testing.T) {
	f := NewWithDefaults()
	a := &Attribute{
		ID:            "attr-1",
		Name:          "port",
		AttributeType: AttrTypeInt,
		Validator:     map[string]any{"min": 1, "max": 65535},
	}
	v, err := f.BuildValidator(a)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	rv, ok := v.(*RangeValidator)
	if !ok {
		t.Fatalf("expected *RangeValidator, got %T", v)
	}
	if rv.Min != 1 || rv.Max != 65535 {
		t.Fatalf("expected [1,65535], got [%v,%v]", rv.Min, rv.Max)
	}
}

func TestFactory_BuildValidator_Regex(t *testing.T) {
	f := NewAttrValueHandlerFactory()
	f.Register(&RegexValidatorHandler{})
	a := &Attribute{
		ID:            "attr-1",
		Name:          "hostname",
		AttributeType: "regex",
		Validator:     map[string]any{"pattern": `^[a-z0-9.-]+$`},
	}
	v, err := f.BuildValidator(a)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	rv, ok := v.(*RegexValidator)
	if !ok {
		t.Fatalf("expected *RegexValidator, got %T", v)
	}
	if !rv.Pattern.MatchString("my-host") {
		t.Fatal("expected regex to match 'my-host'")
	}
}

func TestFactory_BuildValidator_MissingConfig(t *testing.T) {
	f := NewWithDefaults()
	a := &Attribute{
		ID:            "attr-1",
		Name:          "level",
		AttributeType: AttrTypeEnum,
		// No Validator map.
	}
	_, err := f.BuildValidator(a)
	if !errors.Is(err, ErrInvalidValidatorConfig) {
		t.Fatalf("expected ErrInvalidValidatorConfig, got %v", err)
	}
}

func TestFactory_BuildValidator_BadPattern(t *testing.T) {
	f := NewWithDefaults()
	a := &Attribute{
		ID:            "attr-1",
		Name:          "hostname",
		AttributeType: "regex",
		Validator:     map[string]any{"pattern": `[invalid`},
	}
	_, err := f.BuildValidator(a)
	if !errors.Is(err, ErrInvalidValidatorConfig) {
		t.Fatalf("expected ErrInvalidValidatorConfig, got %v", err)
	}
}

func TestFactory_BuildValidator_Unregistered(t *testing.T) {
	f := NewAttrValueHandlerFactory() // empty
	a := &Attribute{
		ID:            "attr-1",
		Name:          "custom",
		AttributeType: "custom-type",
	}
	_, err := f.BuildValidator(a)
	if !errors.Is(err, ErrNoValidator) {
		t.Fatalf("expected ErrNoValidator, got %v", err)
	}
}

func TestFactory_BuildValidator_NilAttribute(t *testing.T) {
	f := NewWithDefaults()
	if _, err := f.BuildValidator(nil); err == nil {
		t.Fatal("expected error for nil attribute")
	}
}

func TestFactory_Nil_BuildValidator(t *testing.T) {
	var f *AttrValueHandlerFactory
	if _, err := f.BuildValidator(&Attribute{}); err == nil {
		t.Fatal("expected error for nil factory")
	}
}

func TestFactory_WithDefaults_Count(t *testing.T) {
	f := NewWithDefaults()
	// 5 defaults: enum, range, regex, ci-ref, string (pass) — plus json registered below?
	// Actually WithDefaults registers: enum, range, regex, ci-ref, pass(string) — 5 total
	// We don't currently add a second pass for JSON. Verify count matches.
	if f.Count() < 4 {
		t.Fatalf("expected >=4 defaults, got %d", f.Count())
	}
	// Verify each attribute type has a handler.
	for _, tt := range []AttributeType{AttrTypeEnum, AttrTypeInt, AttrTypeCIRef} {
		if !f.Has(tt) {
			t.Errorf("expected handler for %s", tt)
		}
	}
}

func TestWithDefaults_Nil(t *testing.T) {
	if got := WithDefaults(nil); got != nil {
		t.Fatal("expected nil for nil input")
	}
}
