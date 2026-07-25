package handlers

import (
	"fmt"
)

// memoryValueHandler handles memory size attribute values (e.g. "4GB", "512MB").
type memoryValueHandler struct{}

func (h memoryValueHandler) Type() string { return "memory" }

func (h memoryValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("memory size is required")
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid memory size: %w", err)
	}
	return nil
}

func (h memoryValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return uint64(0), nil
	}
	bytes, err := parseResourceSize(value)
	return bytes, err
}

func (h memoryValueHandler) Serialize(v interface{}) string {
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

func (h memoryValueHandler) Compare(a, b string) int {
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
