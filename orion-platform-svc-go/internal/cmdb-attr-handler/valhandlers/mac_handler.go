package handlers

import (
	"fmt"
	"net"
	"strings"
)

// macValueHandler handles MAC address attribute values.
type macValueHandler struct{}

func (h macValueHandler) Type() string { return "mac" }

func (h macValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("MAC address is required")
	}
	// Normalize: accept with or without separators
	norm := strings.ToUpper(strings.ReplaceAll(value, "-", ":"))
	norm = strings.ReplaceAll(norm, ".", ":")
	_, err := net.ParseMAC(norm)
	if err != nil {
		return fmt.Errorf("invalid MAC address: %q", value)
	}
	return nil
}

func (h macValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return "", nil
	}
	norm := strings.ToUpper(strings.ReplaceAll(value, "-", ":"))
	norm = strings.ReplaceAll(norm, ".", ":")
	m, err := net.ParseMAC(norm)
	if err != nil {
		return "", fmt.Errorf("invalid MAC address: %q", value)
	}
	return m.String(), nil
}

func (h macValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h macValueHandler) Compare(a, b string) int {
	va, _ := h.Parse(a)
	vb, _ := h.Parse(b)
	sa, _ := va.(string)
	sb, _ := vb.(string)
	if sa < sb {
		return -1
	}
	if sa > sb {
		return 1
	}
	return 0
}
