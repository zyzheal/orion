// Package jsonslice provides slice types that implement sql.Scanner and
// driver.Valuer for PostgreSQL JSONB array columns.
//
// Go's database/sql cannot scan JSONB array columns into []string, []int, or
// []struct because these types don't implement sql.Scanner. These wrappers
// solve both directions: Scan deserialises JSONB → typed slice, Value
// serialises typed slice → JSON string.
package jsonslice

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// StringArray is a []string that implements sql.Scanner and driver.Valuer
// for PostgreSQL JSONB text[] columns.
type StringArray []string

// Scan implements sql.Scanner. PostgreSQL returns JSONB as []byte or string.
func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("jsonslice.StringArray: cannot scan %T", src)
	}
	return json.Unmarshal(b, a)
}

// Value implements driver.Valuer. Returns the slice as a JSON string.
func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	b, err := json.Marshal([]string(a))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// IntArray is a []int that implements sql.Scanner and driver.Valuer
// for PostgreSQL JSONB integer[] columns.
type IntArray []int

// Scan implements sql.Scanner.
func (a *IntArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("jsonslice.IntArray: cannot scan %T", src)
	}
	return json.Unmarshal(b, a)
}

// Value implements driver.Valuer.
func (a IntArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	b, err := json.Marshal([]int(a))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// MarshalJSON returns the JSON array representation, matching the
// underlying slice's encoding.
func (a StringArray) MarshalJSON() ([]byte, error) {
	if a == nil {
		return []byte("null"), nil
	}
	return json.Marshal([]string(a))
}

func (a IntArray) MarshalJSON() ([]byte, error) {
	if a == nil {
		return []byte("null"), nil
	}
	return json.Marshal([]int(a))
}

// UnmarshalJSON allows JSON binding from HTTP request bodies.
func (a *StringArray) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*a = nil
		return nil
	}
	var s []string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	*a = StringArray(s)
	return nil
}

func (a *IntArray) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*a = nil
		return nil
	}
	var i []int
	if err := json.Unmarshal(data, &i); err != nil {
		return err
	}
	*a = IntArray(i)
	return nil
}
