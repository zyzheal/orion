package handlers

import "fmt"

// passwordValueHandler handles password attribute values. Password values are stored
// as opaque strings; comparison is by exact equality only and the parsed value is
// never exposed beyond the handler boundary.
type passwordValueHandler struct{}

func (h passwordValueHandler) Type() string { return "password" }

func (h passwordValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("password value is required")
	}
	if len(value) < 8 {
		return fmt.Errorf("password too short (min 8 characters, got %d)", len(value))
	}
	if len(value) > 256 {
		return fmt.Errorf("password exceeds max length 256")
	}
	return nil
}

func (h passwordValueHandler) Parse(value string) (interface{}, error) {
	return value, nil
}

func (h passwordValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h passwordValueHandler) Compare(a, b string) int {
	if a == b {
		return 0
	}
	if a < b {
		return -1
	}
	return 1
}
