package formatters

import (
	"encoding/json"
	"fmt"
	"io"
)

// ===================================================================
// JSON Formatter

// ToJSONRecords writes a slice of maps as a single JSON array.
//
// Records are serialised as [ {...}, {...}, ... ].  For very large exports
// (millions of rows) use the JSONL writer instead.
func ToJSONRecords(out io.Writer, records []map[string]interface{}) error {
	data, err := json.Marshal(records)
	if err != nil {
		return fmt.Errorf("json: marshal: %w", err)
	}
	_, err = out.Write(data)
	if err != nil {
		return fmt.Errorf("json: write: %w", err)
	}
	_, err = out.Write([]byte("\n"))
		if err != nil {
			return fmt.Errorf("json: write newline: %w", err)
		}
		return nil
}

// ToJSONLRecords writes each record as a separate JSON object on its own line.
//
// Suitable for streaming very large result sets — the caller can write to a
// response body while rows are still being fetched.
func ToJSONLRecords(out io.Writer, records []map[string]interface{}) error {
	for _, r := range records {
		data, err := json.Marshal(r)
		if err != nil {
			return fmt.Errorf("jsonl: marshal: %w", err)
		}
		if _, err := out.Write(data); err != nil {
			return fmt.Errorf("jsonl: write: %w", err)
		}
		if _, err := out.Write([]byte("\n")); err != nil {
			return fmt.Errorf("jsonl: write newline: %w", err)
		}
	}
	return nil
}

// FromJSONReader parses the reader as either a JSON array or a single JSON
// object and returns the result as a list of maps.
//
// Supported input shapes:
//   • [..., ...]           → list of records
//   • { ... }              → single record (wrapped in a list)
//   • {"records": [...] }  → common wrapper pattern
func FromJSONReader(in io.Reader) ([]map[string]interface{}, error) {
	buf := make([]byte, 0, 64*1024)
	for {
		n := 64 * 1024
		buf2 := make([]byte, n)
		readN, err := in.Read(buf2)
		buf = append(buf, buf2[:readN]...)
		if err != nil {
			if err != io.EOF {
				return nil, fmt.Errorf("json: read: %w", err)
			}
			break
		}
	}

	var arr []map[string]interface{}
	if err := json.Unmarshal(buf, &arr); err == nil {
		return arr, nil
	}

	// Try object with "records" key.
	var wrapped struct {
		Records json.RawMessage `json:"records"`
	}
	if err := json.Unmarshal(buf, &wrapped); err == nil && len(wrapped.Records) > 0 {
		return FromJSONReaderBytes(wrapped.Records)
	}

	// Try single object.
	var obj map[string]interface{}
	if err := json.Unmarshal(buf, &obj); err != nil {
		return nil, fmt.Errorf("json: expected array, object with 'records', or single object: %w", err)
	}
	return []map[string]interface{}{obj}, nil
}

// FromJSONReaderBytes parses raw JSON bytes (for wrapped payloads).
func FromJSONReaderBytes(raw []byte) ([]map[string]interface{}, error) {
	var arr []map[string]interface{}
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr, nil
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, fmt.Errorf("json: cannot parse nested records: %w", err)
	}
	return []map[string]interface{}{obj}, nil
}
