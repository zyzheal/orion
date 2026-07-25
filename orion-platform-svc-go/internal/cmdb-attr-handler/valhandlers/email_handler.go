package handlers

import (
	"fmt"
	"net/mail"
	"strings"
)

// emailValueHandler handles email address attribute values.
type emailValueHandler struct{}

func (h emailValueHandler) Type() string { return "email" }

func (h emailValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("email address is required")
	}
	_, err := mail.ParseAddress(value)
	if err != nil {
		return fmt.Errorf("invalid email address: %q", value)
	}
	if len(value) > 254 {
		return fmt.Errorf("email address exceeds max length 254")
	}
	return nil
}

func (h emailValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return "", nil
	}
	_, err := mail.ParseAddress(value)
	if err != nil {
		return nil, fmt.Errorf("invalid email address: %q", value)
	}
	return strings.ToLower(value), nil
}

func (h emailValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h emailValueHandler) Compare(a, b string) int {
	lowerA := strings.ToLower(a)
	lowerB := strings.ToLower(b)
	if lowerA < lowerB {
		return -1
	}
	if lowerA > lowerB {
		return 1
	}
	return 0
}
