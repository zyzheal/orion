package handlers

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// tagsValueHandler handles tag attribute values (comma-separated or JSON array).
type tagsValueHandler struct{}

func (h tagsValueHandler) Type() string { return "tags" }

func (h tagsValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, err := h.Parse(value)
	return err
}

func (h tagsValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return []string{}, nil
	}
	var v []string
	if err := json.Unmarshal([]byte(value), &v); err == nil {
		return v, nil
	}
	// Fallback: comma-separated
	var tags []string
	for _, t := range strings.Split(value, ",") {
		t = strings.TrimSpace(t)
		if t != "" {
			tags = append(tags, t)
		}
	}
	return tags, nil
}

func (h tagsValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case []string:
		// Sort for deterministic output
		sorted := make([]string, len(t))
		copy(sorted, t)
		sort.Strings(sorted)
		b, _ := json.Marshal(sorted)
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

func (h tagsValueHandler) Compare(a, b string) int {
	va, _ := h.Parse(a)
	vb, _ := h.Parse(b)
	sa, _ := va.([]string)
	sb, _ := vb.([]string)
	// Normalize to lowercase for case-insensitive comparison
	for i := range sa {
		sa[i] = strings.ToLower(sa[i])
	}
	for i := range sb {
		sb[i] = strings.ToLower(sb[i])
	}
	sort.Strings(sa)
	sort.Strings(sb)
	for i := 0; i < len(sa) && i < len(sb); i++ {
		if sa[i] != sb[i] {
			if sa[i] < sb[i] {
				return -1
			}
			return 1
		}
	}
	return len(sa) - len(sb)
}
