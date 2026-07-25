package handlers

import (
	"fmt"
)

// diskValueHandler handles disk size attribute values (e.g. "1TB", "500GB").
type diskValueHandler struct{}

func (h diskValueHandler) Type() string { return "disk" }

func (h diskValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("disk size is required")
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid disk size: %w", err)
	}
	return nil
}

func (h diskValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return uint64(0), nil
	}
	bytes, err := parseResourceSize(value)
	return bytes, err
}

func (h diskValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case uint64:
		return formatHumanSize(t)
	case int64:
		return formatHumanSize(uint64(t))
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h diskValueHandler) Compare(a, b string) int {
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
	ba, _ := va.(uint64)
	bb, _ := vb.(uint64)
	if ba < bb {
		return -1
	}
	if ba > bb {
		return 1
	}
	return 0
}
