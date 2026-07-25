package handlers

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// uuidValueHandler handles UUID attribute values.
type uuidValueHandler struct{}

func (h uuidValueHandler) Type() string { return "uuid" }

func (h uuidValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("UUID is required")
	}
	_, err := uuid.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid UUID: %q", value)
	}
	return nil
}

func (h uuidValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return uuid.Nil, nil
	}
	id, err := uuid.Parse(value)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID: %q", value)
	}
	return id, nil
}

func (h uuidValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case uuid.UUID:
		return t.String()
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h uuidValueHandler) Compare(a, b string) int {
	ua, _ := h.Parse(a)
	ub, _ := h.Parse(b)
	aa, _ := ua.(uuid.UUID)
	bb, _ := ub.(uuid.UUID)
	sa := strings.ToLower(aa.String())
	sb := strings.ToLower(bb.String())
	if sa < sb {
		return -1
	}
	if sa > sb {
		return 1
	}
	return 0
}
