package handlers

import (
	"fmt"
	"time"
)

// datetimeValueHandler handles RFC3339 timestamp attribute values.
type datetimeValueHandler struct{}

func (h datetimeValueHandler) Type() string { return "datetime" }

func (h datetimeValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid datetime: %w", err)
	}
	return nil
}

func (h datetimeValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return time.Time{}, nil
	}
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05Z", value)
		if err != nil {
			return nil, fmt.Errorf("invalid datetime format (expected RFC3339): %q", value)
		}
	}
	return t, nil
}

func (h datetimeValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h datetimeValueHandler) Compare(a, b string) int {
	t1, e1 := h.Parse(a)
	t2, e2 := h.Parse(b)
	if e1 != nil && e2 != nil {
		return 0
	}
	v1, _ := t1.(time.Time)
	v2, _ := t2.(time.Time)
	if e1 != nil {
		return 1
	}
	if e2 != nil {
		return -1
	}
	if v1.Equal(v2) {
		return 0
	}
	if v1.Before(v2) {
		return -1
	}
	return 1
}
