package aireview

import (
	"strings"
	"testing"
)

func TestBuildPromptIncludesAllSections(t *testing.T) {
	req := SQLReviewRequest{
		SQL:         "SELECT * FROM users WHERE id = 1",
		DBType:      "postgres",
		Context:     "Load one user by id",
		ExplainPlan: "Seq Scan on users",
	}
	out := BuildPrompt(req)
	if !strings.Contains(out, "SELECT * FROM users WHERE id = 1") {
		t.Errorf("prompt missing SQL body")
	}
	if !strings.Contains(out, "postgres") {
		t.Errorf("prompt missing dbType")
	}
	if !strings.Contains(out, "Load one user by id") {
		t.Errorf("prompt missing context")
	}
	if !strings.Contains(out, "Seq Scan on users") {
		t.Errorf("prompt missing explain plan")
	}
	for _, want := range []string{"<sql>", "</sql>", "JSON", "suggestions"} {
		if !strings.Contains(out, want) {
			t.Errorf("prompt missing structural marker %q", want)
		}
	}
}

func TestBuildPromptDefaultsForOptionalFields(t *testing.T) {
	out := BuildPrompt(SQLReviewRequest{SQL: "SELECT 1"})
	for _, want := range []string{"(none)", "(unspecified, defaulting to mysql)", "SELECT 1"} {
		if !strings.Contains(out, want) {
			t.Errorf("expected %q in prompt for empty optional fields", want)
		}
	}
}

func TestParseAIResponseValid(t *testing.T) {
	body := []byte(`{"suggestions":[
	  {"category":"PERFORMANCE","severity":"WARNING","title":"T","description":"D","suggestion":"S","fixed_sql":"SELECT 1"}
	]}`)
	got, err := parseAIResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(got))
	}
	if got[0].Category != "performance" {
		t.Errorf("expected lowercased category, got %q", got[0].Category)
	}
	if got[0].Severity != "warning" {
		t.Errorf("expected lowercased severity, got %q", got[0].Severity)
	}
}

func TestParseAIResponseEmptySuggestions(t *testing.T) {
	got, err := parseAIResponse([]byte(`{"suggestions":[]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty, got %v", got)
	}
}

func TestParseAIResponseWithCodeFence(t *testing.T) {
	body := []byte("```json\n{\"suggestions\":[{\"category\":\"style\",\"severity\":\"info\",\"title\":\"x\"}]}\n```")
	got, err := parseAIResponse(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].Title != "x" {
		t.Errorf("unexpected parse: %v", got)
	}
}

func TestParseAImalformedReturnsEmptyNotError(t *testing.T) {
	// Contract: parse errors return empty slice, not error. We test the
	// underlying parseAIResponse returns an error here, and the client
	// layer handles it. This locks in the internal semantics.
	_, err := parseAIResponse([]byte(`not json at all`))
	if err == nil {
		t.Error("expected parse error for malformed JSON")
	}
}

func TestParseAIResponseEmptyBody(t *testing.T) {
	got, err := parseAIResponse(nil)
	if err != nil {
		t.Fatalf("nil body should not error: %v", err)
	}
	if got == nil {
		t.Error("expected non-nil empty slice")
	}
	if len(got) != 0 {
		t.Errorf("expected empty, got %v", got)
	}
}
