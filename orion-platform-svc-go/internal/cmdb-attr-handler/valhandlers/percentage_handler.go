package handlers

import (
	"fmt"
)

// percentageValueHandler handles percentage attribute values (0-100%).
type percentageValueHandler struct{}

func (h percentageValueHandler) Type() string { return "percentage" }

func (h percentageValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid percentage: %w", err)
	}
	return nil
}

func (h percentageValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return 0.0, nil
	}
	f, err := parsePercentage(value)
	return f, err
}

func (h percentageValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case float64:
		return fmt.Sprintf("%.1f%%", t)
	case float32:
		return fmt.Sprintf("%.1f%%", float64(t))
	case int:
		return fmt.Sprintf("%d%%", t)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h percentageValueHandler) Compare(a, b string) int {
	va, ea := h.Parse(a)
	vb, eb := h.Parse(b)
	if ea != nil && eb != nil {
		return 0
	}
	if ea != nil {
		return -1
	}
	if eb != nil {
		return 1
	}
	fa, _ := va.(float64)
	fb, _ := vb.(float64)
	if fa < fb {
		return -1
	}
	if fa > fb {
		return 1
	}
	return 0
}
