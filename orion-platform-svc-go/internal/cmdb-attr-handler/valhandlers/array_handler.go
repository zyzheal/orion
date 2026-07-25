package handlers

import (
	"encoding/json"
	"fmt"
	"sort"
)

// arrayValueHandler handles generic JSON array attribute values.
type arrayValueHandler struct{}

func (h arrayValueHandler) Type() string { return "array" }

func (h arrayValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	var v interface{}
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		return fmt.Errorf("invalid array (expected JSON array): %w", err)
	}
	_, ok := v.([]interface{})
	if !ok {
		return fmt.Errorf("expected JSON array, got %T", v)
	}
	return nil
}

func (h arrayValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return []interface{}{}, nil
	}
	var v []interface{}
	if err := json.Unmarshal([]byte(value), &v); err != nil {
		return nil, fmt.Errorf("invalid array: %w", err)
	}
	return v, nil
}

func (h arrayValueHandler) Serialize(v interface{}) string {
	if v == nil {
		return "[]"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}

func (h arrayValueHandler) Compare(a, b string) int {
	va, _ := h.Parse(a)
	vb, _ := h.Parse(b)
	arrA, _ := va.([]interface{})
	arrB, _ := vb.([]interface{})
	ia := make([]string, len(arrA))
	for i, x := range arrA {
		ia[i] = fmt.Sprintf("%v", x)
	}
	ib := make([]string, len(arrB))
	for i, x := range arrB {
		ib[i] = fmt.Sprintf("%v", x)
	}
	sort.Strings(ia)
	sort.Strings(ib)
	sa := h.Serialize(ia)
	sb := h.Serialize(ib)
	if sa < sb {
		return -1
	}
	if sa > sb {
		return 1
	}
	return 0
}
