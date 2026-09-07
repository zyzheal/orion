package aireview

import (
	"encoding/json"
	"fmt"
	"strings"
)

// reviewPrompt is the template sent to the LLM. It is deliberately
// explicit about the JSON contract so parsing is deterministic.
const reviewPrompt = `You are a senior database engineer reviewing a single SQL statement.

SQL:
<sql>
%s
</sql>

DB Type: %s
Business Context: %s
EXPLAIN Plan: %s

Rules to check:
1. Index selection - will this query use optimal indexes?
2. Full table scans - detect unnecessary scans
3. N+1 queries - detect patterns suggesting repeated single-row queries
4. Deadlocks - detect lock ordering risks
5. Data types - detect implicit conversions
6. NULL handling - detect NULL trap logic errors
7. Pagination - detect OFFSET-based pagination on large tables
8. Business logic - flag suspicious patterns

Respond with ONLY valid JSON in this exact shape:
{
  "suggestions": [
    {
      "category": "performance|security|correctness|style",
      "severity": "info|warning|critical",
      "title": "...",
      "description": "...",
      "suggestion": "...",
      "fixed_sql": "..."
    }
  ]
}

If there are no issues, respond with {"suggestions": []}. Do not add prose, markdown fences, or commentary outside the JSON.`

// aiResponse is the on-wire JSON contract the LLM must return.
type aiResponse struct {
	Suggestions []AISuggestion `json:"suggestions"`
}

// BuildPrompt renders the review prompt for the given request.
// Empty optional fields render as "(none)" so the LLM does not mistake
// absence for "no context provided".
func BuildPrompt(req SQLReviewRequest) string {
	dbType := strings.TrimSpace(req.DBType)
	if dbType == "" {
		dbType = "(unspecified, defaulting to mysql)"
	}
	ctxField := strings.TrimSpace(req.Context)
	if ctxField == "" {
		ctxField = "(none)"
	}
	explain := strings.TrimSpace(req.ExplainPlan)
	if explain == "" {
		explain = "(none)"
	}
	return fmt.Sprintf(reviewPrompt, req.SQL, dbType, ctxField, explain)
}

// parseAIResponse parses the LLM output into structured suggestions.
//
// Parse errors are swallowed (returning an empty slice) because the LLM
// output is best-effort. Callers surface errors separately through the
// transport layer; a malformed LLM body should never fail the review.
func parseAIResponse(body []byte) ([]AISuggestion, error) {
	if len(body) == 0 {
		return []AISuggestion{}, nil
	}
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return []AISuggestion{}, nil
	}

	// The model may wrap JSON in markdown code fences. Strip them before
	// decoding so the parser still succeeds on mildly non-compliant output.
	payload, err := stripCodeFence(trimmed)
	if err != nil {
		return []AISuggestion{}, err
	}

	var parsed aiResponse
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		return []AISuggestion{}, err
	}

	// Normalize so downstream code does not have to nil-check every field.
	out := make([]AISuggestion, 0, len(parsed.Suggestions))
	for _, s := range parsed.Suggestions {
		s.Category = strings.ToLower(strings.TrimSpace(s.Category))
		s.Severity = strings.ToLower(strings.TrimSpace(s.Severity))
		out = append(out, s)
	}
	return out, nil
}

// stripCodeFence removes leading/trailing ```json ... ``` wrappers if the
// LLM wrapped its JSON response. Returns an error when the stripped payload
// is empty.
func stripCodeFence(s string) (string, error) {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s, nil
	}
	// Trim opening fence (possibly with language tag like ```json).
	rest := strings.TrimSpace(strings.TrimPrefix(s, "```"))
	// If the first line looks like a language tag, drop it.
	if nl := strings.Index(rest, "\n"); nl >= 0 {
		first := strings.TrimSpace(rest[:nl])
		// Common language tags: "json", "js", "javascript".
		if first == "json" || first == "js" || first == "javascript" || first == "JSON" {
			rest = strings.TrimSpace(rest[nl+1:])
		}
	}
	// Strip trailing fence.
	if idx := strings.LastIndex(rest, "```"); idx >= 0 {
		rest = strings.TrimSpace(rest[:idx])
	}
	if strings.TrimSpace(rest) == "" {
		return "", fmt.Errorf("empty response after stripping code fence")
	}
	return rest, nil
}
