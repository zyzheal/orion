package handlers

import (
	"encoding/json"
	"fmt"
)

// numberValueHandler handles numeric (int/float) attribute values.
type numberValueHandler struct{}

func (h numberValueHandler) Type() string { return "number" }

func (h numberValueHandler) Validate(value string) error {
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid number: %w", err)
	}
	return nil
}

func (h numberValueHandler) Parse(value string) (interface{}, error) {
	if i, err := parseJSONNumberInt(value); err == nil {
		return i, nil
	}
	return parseJSONNumberFloat(value)
}

func (h numberValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case float64:
		if t == float64(int64(t)) {
			return fmt.Sprintf("%d", int64(t))
		}
		return fmt.Sprintf("%v", t)
	case int64:
		return fmt.Sprintf("%d", t)
	default:
		s, _ := json.Marshal(v)
		return string(s)
	}
}

func (h numberValueHandler) Compare(a, b string) int {
	va, ea := parseJSONNumberFloat(a)
	vb, eb := parseJSONNumberFloat(b)
	if ea != nil || eb != nil {
		return 0
	}
	if va < vb {
		return -1
	}
	if va > vb {
		return 1
	}
	return 0
}
