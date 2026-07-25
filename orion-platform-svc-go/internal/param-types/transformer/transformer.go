package transformer

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Transformation context holds options and metadata.
// ---------------------------------------------------------------------------

type Transformer struct {
	// Enable strict mode — errors on lossy conversions instead of silently
	// falling back to string representation.
	Strict bool
}

// NewTransformer creates a Transformer with defaults (non-strict).
func NewTransformer() *Transformer {
	return &Transformer{Strict: false}
}

// ---------------------------------------------------------------------------
// Transformation error — distinct from validation errors.
// ---------------------------------------------------------------------------

// TransformError indicates a failed type conversion.
type TransformError struct {
	FromType  string `json:"from_type"`  // source type
	ToType    string `json:"to_type"`    // target type
	Value     interface{} `json:"value"` // original value
	Message   string `json:"message"`
}

func (e *TransformError) Error() string {
	return fmt.Sprintf("transform %s→%s: %s (value=%v)", e.FromType, e.ToType, e.Message, e.Value)
}

// ---------------------------------------------------------------------------
// Transform converts a parameter value from one type representation to
// another. The fromValue is the raw string representation of the source
// value. The toType is the target type code.
// ---------------------------------------------------------------------------

func (t *Transformer) Transform(fromType, toType, fromValue string) (interface{}, error) {
	if fromType == toType {
		return fromValue, nil
	}

	// Parse source value
	src, err := parseValue(fromType, fromValue)
	if err != nil {
		return nil, &TransformError{
			FromType: fromType, ToType: toType, Value: fromValue,
			Message: fmt.Sprintf("cannot parse source: %v", err),
		}
	}

	// Convert to target
	switch toType {
	case "string":
		return t.toString(src, fromType), nil
	case "number":
		return t.toNumber(src, fromType)
	case "boolean":
		return t.toBoolean(src, fromType)
	case "select":
		return t.toSelect(src, fromType)
	case "array":
		return t.toArray(src, fromType)
	case "object":
		return t.toObject(src, fromType)
	case "password":
		return t.toString(src, fromType), nil
	case "file":
		return t.toString(src, fromType), nil
	case "json":
		return t.toJSON(src, fromType)
	case "datetime":
		return t.toDateTime(src, fromType)
	default:
		return nil, &TransformError{
			FromType: fromType, ToType: toType, Value: fromValue,
			Message: fmt.Sprintf("unknown target type: %s", toType),
		}
	}
}

// ---------------------------------------------------------------------------
// ToRawValue converts a parsed value back to a string suitable for API
// responses or downstream consumption.
// ---------------------------------------------------------------------------

func (t *Transformer) ToRawValue(valueType string, value interface{}) string {
	switch val := value.(type) {
	case string:
		return val
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case float64:
		if val == float64(int64(val)) {
			return strconv.FormatInt(int64(val), 10)
		}
		return fmt.Sprintf("%g", val)
	case bool:
		return strconv.FormatBool(val)
	case time.Time:
		return val.Format(time.RFC3339)
	case []interface{}:
		return t.serializeArray(val)
	case map[string]interface{}:
		return t.serializeObject(val)
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", val)
	}
}

// ---------------------------------------------------------------------------
// SerializeValue produces a JSON-serializable representation for a parsed
// value, for use in API responses or logging.
// ---------------------------------------------------------------------------

func (t *Transformer) SerializeValue(valueType string, value interface{}) interface{} {
	switch val := value.(type) {
	case string:
		return val
	case []string:
		// Convert []string → []interface{} for JSON marshal
		out := make([]interface{}, len(val))
		for i, v := range val {
			out[i] = v
		}
		return out
	case map[string]string:
		out := make(map[string]interface{})
		for k, v := range val {
			out[k] = v
		}
		return out
	case time.Time:
		return val.Format(time.RFC3339)
	case nil:
		return nil
	default:
		return val
	}
}

// ---------------------------------------------------------------------------
// BatchTransform transforms multiple values at once.
// ---------------------------------------------------------------------------

type TransformInput struct {
	FromType string `json:"from_type"`
	ToType   string `json:"to_type"`
	Value    string `json:"value"`
	Param    string `json:"param,omitempty"`
}

type TransformOutput struct {
	Param    string      `json:"param,omitempty"`
	Value    interface{} `json:"value"`
	Success  bool        `json:"success"`
	Error    string      `json:"error,omitempty"`
}

func (t *Transformer) BatchTransform(inputs []TransformInput) []TransformOutput {
	outputs := make([]TransformOutput, len(inputs))
	for i, in := range inputs {
		val, err := t.Transform(in.FromType, in.ToType, in.Value)
		outputs[i] = TransformOutput{
			Param:   in.Param,
			Value:   val,
			Success: err == nil,
			Error:   errStr(err),
		}
	}
	return outputs
}

// ---------------------------------------------------------------------------
// CoerceWithDefault attempts to parse a value; if parsing fails, returns the
// default. Useful for handling empty or malformed user input.
// ---------------------------------------------------------------------------

func (t *Transformer) CoerceWithDefault(paramType, value, defaultValue string) (interface{}, error) {
	parsed, err := parseValue(paramType, value)
	if err != nil && value != "" {
		// Empty value + error → fall back to default
		return parseValue(paramType, defaultValue)
	}
	if err != nil {
		// Empty value and parsing defaulted to nil → use default
		if defaultValue != "" {
			return parseValue(paramType, defaultValue)
		}
		return nil, err
	}
	return parsed, nil
}

// ---------------------------------------------------------------------------
// Conversion implementations
// ---------------------------------------------------------------------------

func (t *Transformer) toString(src interface{}, fromType string) string {
	switch val := src.(type) {
	case string:
		return val
	case nil:
		return ""
	case bool:
		return strconv.FormatBool(val)
	case float64:
		if val == float64(int64(val)) {
			return strconv.FormatInt(int64(val), 10)
		}
		return fmt.Sprintf("%g", val)
	case time.Time:
		return val.Format(time.RFC3339)
	case []interface{}:
		return t.serializeArray(val)
	case map[string]interface{}:
		return t.serializeObject(val)
	default:
		return fmt.Sprintf("%v", val)
	}
}

func (t *Transformer) toNumber(src interface{}, fromType string) (float64, error) {
	switch val := src.(type) {
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil && t.Strict {
			return 0, &TransformError{
				FromType: fromType, ToType: "number", Value: val,
				Message: fmt.Sprintf("string to number: %v", err),
			}
		}
		return f, err
	case bool:
		if val {
			return 1.0, nil
		}
		return 0.0, nil
	case float64:
		return val, nil
	case nil:
		return 0.0, nil
	default:
		if t.Strict {
			return 0, &TransformError{
				FromType: fromType, ToType: "number", Value: val,
				Message: fmt.Sprintf("unsupported source type %T", val),
			}
		}
		return parseFloat64(fmt.Sprintf("%v", val))
	}
}

func (t *Transformer) toBoolean(src interface{}, fromType string) (bool, error) {
	switch val := src.(type) {
	case string:
		return strconv.ParseBool(val)
	case bool:
		return val, nil
	case float64:
		return val != 0, nil
	case nil:
		return false, nil
	default:
		return fmt.Sprintf("%v", val) != "false" && fmt.Sprintf("%v", val) != "", nil
	}
}

func (t *Transformer) toSelect(src interface{}, fromType string) (string, error) {
	switch val := src.(type) {
	case string:
		return val, nil
	case bool:
		if val {
			return "true", nil
		}
		return "false", nil
	case float64:
		return fmt.Sprintf("%g", val), nil
	case nil:
		return "", nil
	default:
		return fmt.Sprintf("%v", val), nil
	}
}

func (t *Transformer) toArray(src interface{}, fromType string) ([]string, error) {
	switch val := src.(type) {
	case string:
		if val == "" {
			return []string{}, nil
		}
		items := strings.Split(val, ",")
		out := make([]string, 0, len(items))
		for _, item := range items {
			t := strings.TrimSpace(item)
			if t != "" {
				out = append(out, t)
			}
		}
		return out, nil
	case bool:
		if val {
			return []string{"true"}, nil
		}
		return []string{"false"}, nil
	case float64:
		return []string{fmt.Sprintf("%g", val)}, nil
	case nil:
		return []string{}, nil
	default:
		s := fmt.Sprintf("%v", val)
		return strings.Split(s, ","), nil
	}
}

func (t *Transformer) toObject(src interface{}, fromType string) (map[string]interface{}, error) {
	switch val := src.(type) {
	case string:
		var obj map[string]interface{}
		if val == "" {
			return map[string]interface{}{}, nil
		}
		if err := json.Unmarshal([]byte(val), &obj); err != nil {
			if t.Strict {
				return nil, &TransformError{
					FromType: fromType, ToType: "object", Value: val,
					Message: fmt.Sprintf("string to object: %v", err),
				}
			}
			return map[string]interface{}{"raw": val}, nil
		}
		return obj, nil
	case bool:
		return map[string]interface{}{"value": val}, nil
	case float64:
		return map[string]interface{}{"value": val}, nil
	case nil:
		return map[string]interface{}{}, nil
	default:
		return map[string]interface{}{"value": val}, nil
	}
}

func (t *Transformer) toJSON(src interface{}, fromType string) (string, error) {
	switch val := src.(type) {
	case string:
		// If already valid JSON, return as-is
		if isJSON(val) {
			return val, nil
		}
		// Escaped as JSON string value
		b, err := json.Marshal(val)
		if err != nil {
			return val, nil
		}
		return string(b), nil
	case bool:
		return strconv.FormatBool(val), nil
	case float64:
		return fmt.Sprintf("%g", val), nil
	case nil:
		return "null", nil
	default:
		b, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val), nil
		}
		return string(b), nil
	}
}

func (t *Transformer) toDateTime(src interface{}, fromType string) (string, error) {
	switch val := src.(type) {
	case string:
		// If already RFC3339, return as-is
		if _, err := time.Parse(time.RFC3339, val); err == nil {
			return val, nil
		}
		if _, err := time.Parse("2006-01-02", val); err == nil {
			return val, nil
		}
		if t.Strict {
			return "", &TransformError{
				FromType: fromType, ToType: "datetime", Value: val,
				Message: fmt.Sprintf("invalid datetime string: %q", val),
			}
		}
		return val, nil
	case time.Time:
		return val.Format(time.RFC3339), nil
	case float64:
		// Treat as unix timestamp
		tm := time.Unix(int64(val), 0).UTC()
		return tm.Format(time.RFC3339), nil
	case bool:
		if val {
			return time.Now().UTC().Format(time.RFC3339), nil
		}
		return time.Unix(0, 0).UTC().Format(time.RFC3339), nil
	case nil:
		return "", nil
	default:
		return fmt.Sprintf("%v", val), nil
	}
}

// ---------------------------------------------------------------------------
// Value parser (reverse of serialization)
// ---------------------------------------------------------------------------

func parseValue(paramType, value string) (interface{}, error) {
	switch paramType {
	case "string":
		return value, nil
	case "number":
		return strconv.ParseFloat(strings.TrimSpace(value), 64)
	case "boolean":
		return strconv.ParseBool(value)
	case "select":
		return value, nil
	case "array":
		items := strings.Split(value, ",")
		out := make([]string, 0, len(items))
		for _, item := range items {
			t := strings.TrimSpace(item)
			if t != "" {
				out = append(out, t)
			}
		}
		return out, nil
	case "object":
		var obj map[string]interface{}
		if value == "" {
			return obj, nil
		}
		return obj, json.Unmarshal([]byte(value), &obj)
	case "password":
		return value, nil
	case "file":
		return value, nil
	case "json":
		var obj interface{}
		if err := json.Unmarshal([]byte(value), &obj); err != nil {
			return nil, err
		}
		return obj, nil
	case "datetime":
		for _, layout := range []string{time.RFC3339, "2006-01-02"} {
			if t, err := time.Parse(layout, strings.TrimSpace(value)); err == nil {
				return t, nil
			}
		}
		return value, nil
	default:
		return value, nil
	}
}

func parseFloat64(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

func isJSON(s string) bool {
	var v interface{}
	return json.Unmarshal([]byte(s), &v) == nil
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

func (t *Transformer) serializeArray(arr []interface{}) string {
	parts := make([]string, len(arr))
	for i, item := range arr {
		parts[i] = fmt.Sprintf("%v", item)
	}
	return strings.Join(parts, ",")
}

func (t *Transformer) serializeObject(obj map[string]interface{}) string {
	b, err := json.Marshal(obj)
	if err != nil {
		return fmt.Sprintf("%v", obj)
	}
	return string(b)
}

// ---------------------------------------------------------------------------
// Nested path utilities for complex parameters
// ---------------------------------------------------------------------------

// NestedPath extracts a value from a nested structure using dot-notation path.
// E.g., "config.database.name" on {"config":{"database":{"name":"prod"}}}
func (t *Transformer) NestedPath(obj map[string]interface{}, path string) (interface{}, bool) {
	parts := strings.Split(path, ".")
	current := interface{}(obj)
	for _, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			next, ok := v[part]
			if !ok {
				return nil, false
			}
			current = next
		default:
			return nil, false
		}
	}
	return current, true
}

// SetNestedPath sets a value at a dot-notation path, creating intermediate maps.
func (t *Transformer) SetNestedPath(obj map[string]interface{}, path string, value interface{}) {
	parts := strings.Split(path, ".")
	current := obj
	for i := 0; i < len(parts)-1; i++ {
		part := parts[i]
		next, ok := current[part]
		if !ok {
			next = make(map[string]interface{})
			current[part] = next
		}
		current = next.(map[string]interface{})
	}
	current[parts[len(parts)-1]] = value
}

// FlattenObject flattens a nested map into dot-notation keys.
func (t *Transformer) FlattenObject(obj map[string]interface{}, prefix string) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range obj {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		switch val := v.(type) {
		case map[string]interface{}:
			for nk, nv := range t.FlattenObject(val, key) {
				result[nk] = nv
			}
		default:
			result[key] = v
		}
	}
	return result
}

// UnflattenObject builds a nested map from dot-notation keys.
func (t *Transformer) UnflattenObject(flat map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for key, value := range flat {
		parts := strings.Split(key, ".")
		if len(parts) == 1 {
			result[key] = value
			continue
		}
		t.SetNestedPath(result, key, value)
	}
	return result
}

// ---------------------------------------------------------------------------
// Base64 helpers for binary file values
// ---------------------------------------------------------------------------

// EncodeBase64 converts a byte slice to base64 string.
func (t *Transformer) EncodeBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// DecodeBase64 converts a base64 string to byte slice.
func (t *Transformer) DecodeBase64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

// ---------------------------------------------------------------------------
// Format conversion helpers
// ---------------------------------------------------------------------------

// BytesToHuman converts bytes to human-readable format.
func (t *Transformer) BytesToHuman(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// HumanToBytes converts human-readable format to bytes.
func (t *Transformer) HumanToBytes(human string) (int64, error) {
	s := strings.TrimSpace(human)
	units := map[string]int64{"B": 1, "KB": 1024, "MB": 1048576, "GB": 1073741824, "TB": 1099511627776}

	for unit, mult := range units {
		suffix := " " + unit
		if strings.HasSuffix(strings.ToUpper(s), suffix) {
			numStr := strings.TrimSuffix(s, suffix)
			f, err := strconv.ParseFloat(strings.TrimSpace(numStr), 64)
			if err != nil {
				return 0, err
			}
			return int64(f * float64(mult)), nil
		}
	}

	// Plain number → bytes
	return strconv.ParseInt(s, 10, 64)
}
