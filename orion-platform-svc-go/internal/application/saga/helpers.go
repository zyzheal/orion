package saga

import (
	"fmt"
	"time"

	"github.com/google/uuid"
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
