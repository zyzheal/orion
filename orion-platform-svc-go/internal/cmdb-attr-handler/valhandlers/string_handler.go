package handlers

import (
	"fmt"
	"strings"
)

// stringValueHandler handles plain string attribute values.
type stringValueHandler struct{}

func (h stringValueHandler) Type() string { return "string" }

func (h stringValueHandler) Validate(value string) error {
	if len(value) > 10240 {
		return fmt.Errorf("string value exceeds max length 10240 (got %d)", len(value))
	}
	return nil
}

func (h stringValueHandler) Parse(value string) (interface{}, error) {
	return value, nil
}

func (h stringValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h stringValueHandler) Compare(a, b string) int {
	return strings.Compare(a, b)
}
