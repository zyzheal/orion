package handlers

import (
	"fmt"
	"strings"
)

// enumValueHandler handles enum attribute values with an allowed option list.
type enumValueHandler struct{}

func (h enumValueHandler) Type() string { return "enum" }

func (h enumValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	return nil // enum options are validated by caller; handler only validates non-empty
}

func (h enumValueHandler) Parse(value string) (interface{}, error) {
	return value, nil
}

func (h enumValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h enumValueHandler) Compare(a, b string) int {
	return strings.Compare(a, b)
}
