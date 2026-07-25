package handlers

import "fmt"

// referenceValueHandler handles reference attribute values (CI UUIDs / IDs).
type referenceValueHandler struct{}

func (h referenceValueHandler) Type() string { return "reference" }

func (h referenceValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	// Accept UUID format or non-empty identifier
	if len(value) < 3 {
		return fmt.Errorf("reference value too short (min 3 chars)")
	}
	return nil
}

func (h referenceValueHandler) Parse(value string) (interface{}, error) {
	return value, nil
}

func (h referenceValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h referenceValueHandler) Compare(a, b string) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}
