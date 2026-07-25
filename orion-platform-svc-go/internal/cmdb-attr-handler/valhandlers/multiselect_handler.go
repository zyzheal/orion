package handlers

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// multiselectValueHandler handles multi-select attribute values (JSON array of strings).
type multiselectValueHandler struct{}

func (h multiselectValueHandler) Type() string { return "multiselect" }

func (h multiselectValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid multiselect (expected JSON array of strings): %w", err)
	}
	return nil
}

func (h multiselectValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return []string{}, nil
	}
	var v []string
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		// Fallback: comma-separated
		return []string{strings.TrimSpace(value)}, nil
	}
	return v, nil
}

func (h multiselectValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case []string:
		b, _ := json.Marshal(t)
		return string(b)
	case []interface{}:
		b, _ := json.Marshal(t)
		return string(b)
	default:
		s := fmt.Sprintf("%v", v)
		if s == "" {
			return "[]"
		}
		return s
	}
}

func (h multiselectValueHandler) Compare(a, b string) int {
	va, _ := h.Parse(a)
	vb, _ := h.Parse(b)
	sa, _ := va.([]string)
	sb, _ := vb.([]string)
	sort.Strings(sa)
	sort.Strings(sb)
	for i := 0; i < len(sa) && i < len(sb); i++ {
		if sa[i] != sb[i] {
			return strings.Compare(sa[i], sb[i])
		}
	}
	return len(sa) - len(sb)
}
