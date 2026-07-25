package handlers

import (
	"encoding/base64"
	"fmt"
)

// binaryValueHandler handles base64-encoded binary attribute values.
type binaryValueHandler struct{}

func (h binaryValueHandler) Type() string { return "binary" }

func (h binaryValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	if _, err := base64.StdEncoding.DecodeString(value); err != nil {
		return fmt.Errorf("invalid base64 binary value: %w", err)
	}
	return nil
}

func (h binaryValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return []byte{}, nil
	}
	b, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("invalid base64: %w", err)
	}
	return b, nil
}

func (h binaryValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case []byte:
		return base64.StdEncoding.EncodeToString(t)
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h binaryValueHandler) Compare(a, b string) int {
	if a == b {
		return 0
	}
	if a < b {
		return -1
	}
	return 1
}
