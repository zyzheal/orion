package handlers

import (
	"encoding/json"
	"fmt"
)

// jsonValueHandler handles arbitrary JSON object attribute values.
type jsonValueHandler struct{}

func (h jsonValueHandler) Type() string { return "json" }

func (h jsonValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	var v interface{}
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

func (h jsonValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return nil, nil
	}
	var v interface{}
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return v, nil
}

func (h jsonValueHandler) Serialize(v interface{}) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}

func (h jsonValueHandler) Compare(a, b string) int {
	if a == b {
		return 0
	}
	// Lexicographic fallback for JSON comparison
	if a < b {
		return -1
	}
	return 1
}
