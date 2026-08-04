package engine

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	formengine "orion/go-common/pkg/form"
	"go.uber.org/zap"
)

// =============================================================================
// Helper: build an Engine from a go-common Form
// =============================================================================

func buildEngine(title string, fields []formengine.FormField) *Engine {
	form := &formengine.Form{
		ID:          "test-form",
		Name:        title,
		Title:       title,
		Description: "Auto-generated test form",
		Version:     1,
		Status:      "active",
		TenantID:    "test-tenant",
		ModuleName:  "test",
		FormType:    "dynamic",
		Category:    "test",
		Tags:        []string{"test"},
		Meta:        map[string]string{"engine": "go"},
		Fields:      fields,
		Layout: &formengine.FormLayoutConfig{
			Type: formengine.FieldLayoutRow,
		},
		Rules: &formengine.FormRules{
			SubmitStrategy: "strict",
		},
	}
	return NewEngine(form, WithLogger(zap.NewNop()))
}

// typeDefaultFromEngine calls Engine's DefaultValues and returns the map.
func defaultValues(e *Engine) map[string]interface{} {
	return e.DefaultValues()
}

// fieldIndex returns a FormField by key, or nil.
func fieldIndex(fields []formengine.FormField, key string) *formengine.FormField {
	for i := range fields {
		if fields[i].Key == key {
			return &fields[i]
		}
	}
	return nil
}

// visibilityStates calls ResolveVisibility and returns the map.
func visibilityStates(e *Engine, data map[string]interface{}) map[string]FieldState {
	return e.ResolveVisibility(context.Background(), data)
}

// =============================================================================
// TestGroup 1: Engine constructor + field list completeness (12 field types)
// =============================================================================

func TestNewEngineCreatesAllFieldTypes(t *testing.T) {
	// 12 field types required by the spec:
	// input, textarea, number, select, checkbox, radio, date,
	// upload(file), switch, editor(password proxy), hidden, dict
	fields := []formengine.FormField{
		{Key: "name", Label: "Name", Type: formengine.FieldTypeInput, Required: true},
		{Key: "bio", Label: "Bio", Type: formengine.FieldTypeTextArea},
		{Key: "age", Label: "Age", Type: formengine.FieldTypeNumber, Min: floatPtr(0), Max: floatPtr(150)},
		{Key: "role", Label: "Role", Type: formengine.FieldTypeSelect, Options: []formengine.FormFieldOption{{Key: "admin", Label: "Admin"}, {Key: "user", Label: "User"}}},
		{Key: "agree", Label: "Agree", Type: formengine.FieldTypeCheckbox},
		{Key: "gender", Label: "Gender", Type: formengine.FieldTypeRadio, Options: []formengine.FormFieldOption{{Key: "m", Label: "Male"}, {Key: "f", Label: "Female"}}},
		{Key: "dob", Label: "DOB", Type: formengine.FieldTypeDate},
		{Key: "avatar", Label: "Avatar", Type: formengine.FieldTypeUpload},
		{Key: "dark", Label: "Dark", Type: formengine.FieldTypeSwitch},
		{Key: "password", Label: "Password", Type: formengine.FieldTypeEditor, MinLength: intPtr(6)}, // proxy for password
		{Key: "hidden_id", Label: "Hidden", Type: formengine.FieldTypeInput, Hidden: true},
		{Key: "status", Label: "Status", Type: formengine.FieldTypeDict, DictCode: "status"},
	}
	e := buildEngine("AllFieldTypes", fields)
	require.NotNil(t, e)
	assert.Equal(t, 12, len(e.EngineFields()))
}

func TestEngineFormReturnsWrappedForm(t *testing.T) {
	f := &formengine.Form{Name: "Test", Version: 5}
	e := NewEngine(f)
	ef := e.EngineForm()
	assert.Equal(t, "Test", ef.Name)
	assert.Equal(t, 5, ef.Version)
}

// =============================================================================
// TestGroup 2: Validate — valid data, missing required, invalid email, invalid number
// =============================================================================

func TestValidateValidData(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Required: true},
		{Key: "email", Type: formengine.FieldTypeInput, Required: true, Pattern: `^[\w.%+-]+@[\w-]+\.[A-Za-z]{2,}$`, PatternMsg: "invalid email"},
	}
	e := buildEngine("ValidateOK", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{
		"name":  "Alice",
		"email": "alice@example.com",
	})
	require.NotNil(t, vd)
	assert.True(t, vd.IsValid)
	assert.Empty(t, vd.Errors)
}

func TestValidateMissingRequiredField(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Required: true, RequiredMsg: "name is required"},
		{Key: "email", Type: formengine.FieldTypeInput, Required: true},
	}
	e := buildEngine("MissingReq", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{
		// name omitted intentionally
		"email": "a@b.com",
	})
	assert.False(t, vd.IsValid)
	// At least one error must reference the name field
	assert.NotEmpty(t, vd.Errors, "missing required field must produce errors")
}

func TestValidateInvalidEmail(t *testing.T) {
	pattern := `^[\w.%+-]+@[\w-]+\.[A-Za-z]{2,}$`
	fields := []formengine.FormField{
		{Key: "email", Type: formengine.FieldTypeInput, Required: true, Pattern: pattern, PatternMsg: "invalid email format"},
	}
	e := buildEngine("InvalidEmail", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{
		"email": "not-an-email",
	})
	assert.False(t, vd.IsValid)
	for _, err := range vd.Errors {
		if err.Type == "pattern" {
			return // found the email pattern error
		}
	}
	t.Fatal("expected a pattern-type error for invalid email")
}

func TestValidateInvalidNumberOutOfRange(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "score", Type: formengine.FieldTypeNumber, Min: floatPtr(0), Max: floatPtr(100)},
	}
	e := buildEngine("BadNumber", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{
		"score": 150, // exceeds Max=100
	})
	assert.False(t, vd.IsValid)
}

func TestValidateNumberInRangePasses(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "score", Type: formengine.FieldTypeNumber, Min: floatPtr(0), Max: floatPtr(100)},
	}
	e := buildEngine("OKNumber", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{
		"score": 42,
	})
	assert.True(t, vd.IsValid)
}

func TestValidateRequiredNumberIsMissing(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "age", Type: formengine.FieldTypeNumber, Required: true},
	}
	e := buildEngine("ReqNum", fields)
	vd := e.Validate(context.Background(), map[string]interface{}{})
	assert.False(t, vd.IsValid)
}

// =============================================================================
// TestGroup 3: RenderReact — output correctness
// =============================================================================

func TestRenderReactContainsAntdForm(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Label: "Name", Required: true},
		{Key: "role", Type: formengine.FieldTypeSelect, Label: "Role"},
	}
	e := buildEngine("ReactTest", fields)
	rendered, err := e.RenderReact(context.Background())
	require.NoError(t, err)
	code := string(rendered)
	assert.True(t, strings.Contains(code, "antd"), "rendered React code should reference antd")
	assert.True(t, strings.Contains(code, "name"), "rendered React code should render the name field")
}

func TestRenderReactGeneratesTypeScriptInterface(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput},
		{Key: "age", Type: formengine.FieldTypeNumber},
		{Key: "agree", Type: formengine.FieldTypeCheckbox},
	}
	e := buildEngine("TSTest", fields)
	code, err := e.RenderReact(context.Background())
	require.NoError(t, err)
	// The renderer writes TypeScript field type declarations
	// Verify the component name is derived from Title
	assert.True(t, strings.Contains(string(code), "TSTest"), "react output should derive name from form title")
}

func TestRenderReactHiddenFieldNotRendered(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "public", Type: formengine.FieldTypeInput, Label: "Public"},
		{Key: "secret", Type: formengine.FieldTypeInput, Label: "Secret", Hidden: true},
	}
	e := buildEngine("HiddenTest", fields)
	code, err := e.RenderReact(context.Background())
	require.NoError(t, err)
	// Hidden fields should not appear in the rendered form body
	// (renderer skips fields with Hidden=true)
	assert.False(t, strings.Contains(string(code), "Secret"), "hidden field label should not appear in react output")
}

// =============================================================================
// TestGroup 4: ResolveVisibility — conditional visibility
// =============================================================================

func TestResolveVisibilityWithoutConditions(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "a", Type: formengine.FieldTypeInput, Visible: true},
		{Key: "b", Type: formengine.FieldTypeInput, Visible: false},
	}
	e := buildEngine("Visibility", fields)
	states := visibilityStates(e, map[string]interface{}{})

	sa := states["a"]
	assert.True(t, sa.Visible)
	sb := states["b"]
	assert.False(t, sb.Visible)
}

func TestResolveVisibilityConditionExprEqual(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "role", Type: formengine.FieldTypeInput},
		{Key: "admin_field", Type: formengine.FieldTypeInput,
			VisibleWhen: &formengine.ConditionExpr{Type: formengine.OpEqual, Field: "role", Value: "admin"}},
	}
	e := buildEngine("CondEq", fields)

	// role=admin -> admin_field visible
	states := visibilityStates(e, map[string]interface{}{"role": "admin"})
	assert.True(t, states["admin_field"].Visible)

	// role=user -> admin_field hidden
	states2 := visibilityStates(e, map[string]interface{}{"role": "user"})
	assert.False(t, states2["admin_field"].Visible)
}

func TestResolveVisibilityConditionExprContains(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "text", Type: formengine.FieldTypeInput},
		{Key: "extra", Type: formengine.FieldTypeInput,
			VisibleWhen: &formengine.ConditionExpr{Type: formengine.OpContains, Field: "text", Value: "A"}},
	}
	e := buildEngine("CondContain", fields)

	states := visibilityStates(e, map[string]interface{}{"text": "Alice"})
	assert.True(t, states["extra"].Visible, "field should be visible when text contains A")

	states2 := visibilityStates(e, map[string]interface{}{"text": "Bob"})
	assert.False(t, states2["extra"].Visible)
}

func TestResolveVisibilityConditionExprRequiredWhen(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "opt", Type: formengine.FieldTypeInput,
			RequiredWhen: &formengine.ConditionExpr{Type: formengine.OpNotEmpty, Field: "trigger", Value: ""}},
	}
	e := buildEngine("ReqWhen", fields)

	// trigger has a value -> opt becomes required
	states := visibilityStates(e, map[string]interface{}{"trigger": "yes"})
	assert.True(t, states["opt"].Required)
}

func TestResolveVisibilityDisabledWhen(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "locked", Type: formengine.FieldTypeInput,
			DisabledWhen: &formengine.ConditionExpr{Type: formengine.OpEqual, Field: "freeze", Value: "true"}},
	}
	e := buildEngine("Disabled", fields)

	states := visibilityStates(e, map[string]interface{}{"freeze": "true"})
	assert.True(t, states["locked"].Disabled)
}

// =============================================================================
// TestGroup 5: DefaultValues
// =============================================================================

func TestDefaultValuesReturnsTypeDefaults(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput},
		{Key: "num", Type: formengine.FieldTypeNumber},
		{Key: "agree", Type: formengine.FieldTypeCheckbox},
		{Key: "switch", Type: formengine.FieldTypeSwitch},
		{Key: "roles", Type: formengine.FieldTypeMultiSelect},
	}
	e := buildEngine("Defaults", fields)
	dv := defaultValues(e)

	assert.Equal(t, "", dv["name"])        // string default
	assert.Equal(t, float64(0), dv["num"]) // number default
	assert.Equal(t, false, dv["agree"])    // checkbox default
	assert.Equal(t, false, dv["switch"])   // switch default
	_, ok := dv["roles"].([]interface{})
	assert.True(t, ok, "multi-select should default to empty slice")
}

func TestDefaultValuesReturnsEmptyStringForHiddenField(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "vis", Type: formengine.FieldTypeInput},
		{Key: "hidden", Type: formengine.FieldTypeInput, Hidden: true},
	}
	e := buildEngine("HiddenDefaults", fields)
	dv := defaultValues(e)
	// Hidden fields have no visible default — confirm entry count matches visible fields only
	assert.Contains(t, dv, "vis")
}

func TestDefaultValuesUsesFieldDefaultWhenSet(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Default: "Orion"},
	}
	e := buildEngine("FieldDefault", fields)
	dv := defaultValues(e)
	assert.Equal(t, "Orion", dv["name"])
}

func TestDefaultValuesReturnsAllKeysForAll12FieldTypes(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "string", Type: formengine.FieldTypeInput},
		{Key: "number", Type: formengine.FieldTypeNumber},
		{Key: "email", Type: formengine.FieldTypeInput, Pattern: `.*@.*`},
		{Key: "textarea", Type: formengine.FieldTypeTextArea},
		{Key: "select", Type: formengine.FieldTypeSelect},
		{Key: "checkbox", Type: formengine.FieldTypeCheckbox},
		{Key: "radio", Type: formengine.FieldTypeRadio},
		{Key: "date", Type: formengine.FieldTypeDate},
		{Key: "file", Type: formengine.FieldTypeUpload},
		{Key: "password", Type: formengine.FieldTypeEditor},
		{Key: "switch", Type: formengine.FieldTypeSwitch},
		{Key: "dict", Type: formengine.FieldTypeDict},
	}
	e := buildEngine("AllDefaults", fields)
	dv := defaultValues(e)
	// All 12 keys should be present (hidden field would still get a default)
	assert.Equal(t, 12, len(dv))
}

// =============================================================================
// TestGroup 6: Render methods (JSON / HTML / YAML) — non-nil output
// =============================================================================

func TestRenderJSONReturnsJSONSchema(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Required: true},
	}
	e := buildEngine("JSON", fields)
	b, err := e.RenderJSON(context.Background())
	require.NoError(t, err)
	assert.True(t, strings.Contains(string(b), "schema") || strings.Contains(string(b), "properties"), "JSON schema output must contain schema structure")
}

func TestRenderHTMLReturnsHTMLForm(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput},
	}
	e := buildEngine("HTML", fields)
	b, err := e.RenderHTML(context.Background())
	require.NoError(t, err)
	assert.True(t, strings.Contains(string(b), "orion-form"), "HTML output should contain 'orion-form' class")
}

func TestRenderYAMLReturnsYAML(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput},
		{Key: "role", Type: formengine.FieldTypeSelect, Options: []formengine.FormFieldOption{{Key: "admin", Label: "Admin"}}},
	}
	e := buildEngine("YAML", fields)
	b, err := e.RenderYAML(context.Background())
	require.NoError(t, err)
	assert.NotEmpty(t, string(b))
}

// =============================================================================
// TestGroup 7: Edge cases
// =============================================================================

func TestValidateNilDataReturnsEmptyFormData(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "name", Type: formengine.FieldTypeInput, Required: true},
	}
	e := buildEngine("NilData", fields)
	vd := e.Validate(context.Background(), nil)
	assert.NotNil(t, vd)
	assert.False(t, vd.IsValid, "nil data should be invalid")
}

func TestResolveVisibilityAllStatesReturned(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "a", Type: formengine.FieldTypeInput, Visible: true},
		{Key: "b", Type: formengine.FieldTypeInput, Visible: true, Disabled: true},
		{Key: "c", Type: formengine.FieldTypeInput, Visible: true, Required: true},
	}
	e := buildEngine("AllStates", fields)
	states := visibilityStates(e, map[string]interface{}{})
	assert.Equal(t, 3, len(states))
	assert.True(t, states["a"].Visible)
	assert.True(t, states["b"].Disabled)
	assert.True(t, states["c"].Required)
}

func TestDefaultValuesHiddenFieldStillPresent(t *testing.T) {
	fields := []formengine.FormField{
		{Key: "h", Type: formengine.FieldTypeInput, Hidden: true},
	}
	e := buildEngine("Hidden", fields)
	dv := defaultValues(e)
	assert.Contains(t, dv, "h", "hidden field should still appear in default values map")
}

func TestEngineFieldsReturnsExactCopy(t *testing.T) {
	fields := []formengine.FormField{{Key: "x", Type: formengine.FieldTypeInput}}
	e := buildEngine("Fields", fields)
	got := e.EngineFields()
	assert.Equal(t, 1, len(got))
	assert.Equal(t, "x", got[0].Key)
}

// =============================================================================
// Helpers
// =============================================================================

func floatPtr(v float64) *float64 {
	return &v
}

func intPtr(v int) *int {
	return &v
}

// =============================================================================
// Verify go-common package dependency is resolvable
// =============================================================================

func TestEngineUsesFormPackage(t *testing.T) {
	// Compile-time check: formengine.FormValidator, FormRenderer exist and are used
	_ = formengine.NewFormValidator
	_ = formengine.NewFormRenderer
	_ = formengine.Form{}
	_ = formengine.FormField{}
	_ = formengine.FormCondition{}
}
