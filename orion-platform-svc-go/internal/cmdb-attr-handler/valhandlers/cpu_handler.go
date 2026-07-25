package handlers

import (
	"fmt"
	"strconv"
	"strings"
)

// cpuValueHandler handles CPU count attribute values (e.g. "4", "16 vCPU", "8 cores").
type cpuValueHandler struct{}

func (h cpuValueHandler) Type() string { return "cpu" }

func (h cpuValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("cpu count is required")
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid CPU count: %w", err)
	}
	return nil
}

func (h cpuValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return int64(0), nil
	}
	v := strings.TrimSpace(value)
	// Strip suffixes: vCPU, cores, etc.
	v = strings.TrimSuffix(strings.ToLower(v), " vcpu")
	v = strings.TrimSuffix(v, " vcpu")
	v = strings.TrimSuffix(v, " cores")
	v = strings.TrimSuffix(v, " core")
	v = strings.TrimSpace(v)
	i, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid CPU count number: %q", value)
	}
	if i < 0 {
		return nil, fmt.Errorf("CPU count cannot be negative: %d", i)
	}
	return i, nil
}

func (h cpuValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case int64:
		return fmt.Sprintf("%d", t)
	case int:
		return fmt.Sprintf("%d", t)
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h cpuValueHandler) Compare(a, b string) int {
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
	ia, _ := va.(int64)
	ib, _ := vb.(int64)
	if ia < ib {
		return -1
	}
	if ia > ib {
		return 1
	}
	return 0
}
