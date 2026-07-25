package handlers

import (
	"encoding/json"
	"fmt"
)

// booleanValueHandler handles boolean attribute values.
type booleanValueHandler struct{}

func (h booleanValueHandler) Type() string { return "boolean" }

func (h booleanValueHandler) Validate(value string) error {
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid boolean: %w", err)
	}
	return nil
}

func (h booleanValueHandler) Parse(value string) (interface{}, error) {
	switch value {
	case "true":
		return true, nil
	case "false":
		return false, nil
	case "1":
		return true, nil
	case "0":
		return false, nil
	case "":
		return false, nil
	}
	var b bool
	if err := json.Unmarshal([]byte(value), &b); err != nil {
		return false, fmt.Errorf("invalid boolean value: %q", value)
	}
	return b, nil
}

func (h booleanValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h booleanValueHandler) Compare(a, b string) int {
	va, _ := h.Parse(a)
	vb, _ := h.Parse(b)
	ab, _ := va.(bool)
	bb, _ := vb.(bool)
	if ab == bb {
		return 0
	}
	if ab {
		return 1
	}
	return -1
}
