package saga

import (
	"fmt"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/infrastructure/saga"
)

// generateID returns a UUID-based identifier with the given prefix.
func generateID(prefix string) string {
	return fmt.Sprintf("%s-%s", prefix, uuid.New())
}

// getString reads a string value from ctxData, falling back to fallback if absent or empty.
func getString(m map[string]interface{}, key, fallback string) string {
	v, ok := m[key]
	if !ok {
		return fallback
	}
	s, _ := v.(string)
	if s == "" {
		return fallback
	}
	return s
}

// getInt reads an int value from ctxData, falling back to fallback if absent.
func getInt(m map[string]interface{}, key string, fallback int) int {
	v, ok := m[key]
	if !ok {
		return fallback
	}
	i, _ := v.(int)
	return i
}

// nowPtr returns a pointer to the current UTC time.
func nowPtr() *time.Time {
	now := time.Now().UTC()
	return &now
}

// getStrFromResult safely extracts a string value from stepResult.
// It also handles non-string types by converting them to their string representation
// so that callers do not need to do type assertions themselves.
func getStrFromResult(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	switch s := v.(type) {
	case string:
		return s
	case int:
		return fmt.Sprintf("%d", s)
	case float64:
		// json.Unmarshal decodes numbers as float64
		if s == float64(int64(s)) {
			return fmt.Sprintf("%d", int64(s))
		}
		return fmt.Sprintf("%g", s)
	default:
		if v == nil {
			return ""
		}
		return fmt.Sprintf("%v", v)
	}
}

// getStepsByID returns all step results for the given stepID (oldest last).
func getStepsByID(inst *saga.SagaInstance, stepID string) []saga.SagaStepResult {
	var matched []saga.SagaStepResult
	for i := len(inst.Steps) - 1; i >= 0; i-- {
		if inst.Steps[i].StepID == stepID {
			matched = append(matched, inst.Steps[i])
		}
	}
	return matched // already in reverse order
}

// clearStepsByStatus removes all steps with the given status and returns the
// number of steps removed (the count is recorded so the compensation can report
// how many items were reversed).
func clearStepsByStatus(inst *saga.SagaInstance, stepID, status string) int {
	clean := make([]saga.SagaStepResult, 0, len(inst.Steps))
	removed := 0
	for _, s := range inst.Steps {
		if s.StepID == stepID && s.Status == status {
			removed++
			continue
		}
		clean = append(clean, s)
	}
	inst.Steps = clean
	return removed
}
