package saga

import (
	"fmt"
	"time"
)

// generateID returns a short unique identifier for a given prefix.
// In production this would be a UUID; here we use a deterministic-looking string.
func generateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
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
