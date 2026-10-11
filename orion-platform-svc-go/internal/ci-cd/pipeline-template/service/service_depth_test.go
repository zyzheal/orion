package service

import (
	"testing"

	"orion/platform-svc-go/internal/ci-cd/pipeline-template/models"
)

// ---------------------------------------------------------------------------
// strPtr
// ---------------------------------------------------------------------------

func TestStrPtrReturnsNonNilWithSameValue(t *testing.T) {
	p := strPtr("hello")
	if p == nil || *p != "hello" {
		t.Errorf("*p = %v, want hello", p)
	}
}

func TestStrPtrEmptyString(t *testing.T) {
	p := strPtr("")
	if p == nil || *p != "" {
		t.Error("pointer to empty string should be non-nil with empty value")
	}
}

func TestStrPtrDistinctPointers(t *testing.T) {
	a := strPtr("same")
	b := strPtr("same")
	if a == b {
		t.Error("distinct calls should yield distinct pointers")
	}
	if *a != *b {
		t.Error("but values should be equal")
	}
}

// ---------------------------------------------------------------------------
// extractYAMLFromConfig — JSONB → YAML string
// ---------------------------------------------------------------------------

func TestExtractYAMLFromConfigNilInput(t *testing.T) {
	if got := extractYAMLFromConfig(nil); got != "" {
		t.Errorf("nil cfg should return empty, got %q", got)
	}
}

func TestExtractYAMLFromConfigEmptyBytes(t *testing.T) {
	if got := extractYAMLFromConfig(models.JSONB{}); got != "" {
		t.Errorf("empty JSONB should return empty, got %q", got)
	}
}

func TestExtractYAMLFromConfigInvalidJSON(t *testing.T) {
	if got := extractYAMLFromConfig(models.JSONB(`not json`)); got != "" {
		t.Errorf("invalid JSON should return empty, got %q", got)
	}
}

func TestExtractYAMLFromConfigMissingKey(t *testing.T) {
	if got := extractYAMLFromConfig(models.JSONB(`{"other":"x"}`)); got != "" {
		t.Errorf("missing yamlDefinition should return empty, got %q", got)
	}
}

func TestExtractYAMLFromConfigNonStringYAML(t *testing.T) {
	// yamlDefinition is present but not a string → returns ""
	if got := extractYAMLFromConfig(models.JSONB(`{"yamlDefinition":42}`)); got != "" {
		t.Errorf("non-string yamlDefinition should return empty, got %q", got)
	}
}

func TestExtractYAMLFromConfigValidString(t *testing.T) {
	// JSON escapes newlines as \n inside strings; we build the JSON by hand
	// to guarantee validity.
	in := `{"yamlDefinition":"apiVersion: orion/v1\nkind: Pipeline"}`
	want := "apiVersion: orion/v1\nkind: Pipeline"
	if got := extractYAMLFromConfig(models.JSONB(in)); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExtractYAMLFromConfigNestedObjectsIgnored(t *testing.T) {
	// yamlDefinition must be a plain string; object form is not extracted.
	in := `{"yamlDefinition":{"apiVersion":"orion/v1"}}`
	if got := extractYAMLFromConfig(models.JSONB(in)); got != "" {
		t.Errorf("object form of yamlDefinition should be ignored, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// builtins — the seeded template definitions
// ---------------------------------------------------------------------------

func TestBuiltinsAreNonEmptyAndWellFormed(t *testing.T) {
	if len(builtins) == 0 {
		t.Fatal("builtins must be non-empty")
	}
	seenNames := map[string]bool{}
	for i, b := range builtins {
		if b.Name == "" {
			t.Errorf("builtins[%d] has empty name", i)
		}
		if seenNames[b.Name] {
			t.Errorf("duplicate builtin name: %s", b.Name)
		}
		seenNames[b.Name] = true

		if b.Category == "" {
			t.Errorf("builtins[%d] (%s) has empty category", i, b.Name)
		}
		if b.YAML == "" {
			t.Errorf("builtins[%d] (%s) has empty YAML", i, b.Name)
		}
		if !isJSONish(b.YAML) {
			// YAML content should at least start with apiVersion or kind
			if b.YAML[:len("apiVersion")] != "apiVersion" && b.YAML[:len("kind")] != "kind" {
				t.Errorf("builtins[%d] (%s) YAML doesn't look like a pipeline definition", i, b.Name)
			}
		}
	}
}

// isJSONish is a helper: true if the string looks like it's parseable JSON.
func isJSONish(s string) bool {
	return len(s) > 0 && (s[0] == '{' || s[0] == '[')
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestErrPipelineTemplateNotFoundIsAliasForErrNotFound(t *testing.T) {
	if ErrPipelineTemplateNotFound != ErrNotFound {
		t.Error("ErrPipelineTemplateNotFound should be an alias for ErrNotFound")
	}
}
