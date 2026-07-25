package handlers

import (
	"fmt"
	"net/url"
	"strings"
)

// urlValueHandler handles URL attribute values.
type urlValueHandler struct{}

func (h urlValueHandler) Type() string { return "url" }

func (h urlValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("url is required")
	}
	u, err := url.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme == "" {
		return fmt.Errorf("URL missing scheme (http/https): %q", value)
	}
	if len(value) > 2048 {
		return fmt.Errorf("URL exceeds max length 2048")
	}
	return nil
}

func (h urlValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return nil, nil
	}
	u, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}
	return u, nil
}

func (h urlValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case *url.URL:
		return t.String()
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h urlValueHandler) Compare(a, b string) int {
	lowerA := strings.ToLower(strings.TrimSpace(a))
	lowerB := strings.ToLower(strings.TrimSpace(b))
	if lowerA < lowerB {
		return -1
	}
	if lowerA > lowerB {
		return 1
	}
	return 0
}
