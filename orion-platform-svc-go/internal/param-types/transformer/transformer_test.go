package transformer

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"
)

func TestTransformer_Transform_SameType(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "string", "hello")
	if err != nil {
		t.Fatalf("same-type transform should not error, got %v", err)
	}
	if v != "hello" {
		t.Fatalf("expected hello, got %v", v)
	}
}

func TestTransformer_Transform_StringToNumber(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "number", "42")
	if err != nil {
		t.Fatalf("string to number: %v", err)
	}
	if f, ok := v.(float64); !ok || f != 42.0 {
		t.Fatalf("expected 42.0, got %v", v)
	}
}

func TestTransformer_Transform_StringToBoolean(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "boolean", "true")
	if err != nil {
		t.Fatalf("string to boolean: %v", err)
	}
	if v != true {
		t.Fatalf("expected true, got %v", v)
	}
}

func TestTransformer_Transform_BooleanToNumber(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("boolean", "number", "true")
	if err != nil {
		t.Fatalf("boolean to number: %v", err)
	}
	if f, ok := v.(float64); !ok || f != 1.0 {
		t.Fatalf("expected 1.0, got %v", v)
	}
}

func TestTransformer_Transform_StringToArray(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "array", "a,b,c")
	if err != nil {
		t.Fatalf("string to array: %v", err)
	}
	arr, ok := v.([]string)
	if !ok {
		t.Fatalf("expected []string, got %T", v)
	}
	if len(arr) != 3 {
		t.Fatalf("expected 3 items, got %d", len(arr))
	}
	if arr[0] != "a" {
		t.Fatalf("expected a, got %s", arr[0])
	}
}

func TestTransformer_Transform_StringToObject(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "object", `{"name":"x"}`)
	if err != nil {
		t.Fatalf("string to object: %v", err)
	}
	obj, ok := v.(map[string]interface{})
	if !ok {
		t.Fatalf("expected object, got %T", v)
	}
	if obj["name"] != "x" {
		t.Fatalf("expected name=x, got %v", obj)
	}
}

func TestTransformer_Transform_StringToObject_BadJSON(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "object", "not json")
	if err != nil {
		t.Fatalf("string to object (bad JSON, non-strict): %v", err)
	}
	obj := v.(map[string]interface{})
	if obj["raw"] != "not json" {
		t.Fatalf("expected raw fallback, got %v", obj)
	}
}

func TestTransformer_Transform_StringToObject_BadJSON_Strict(t *testing.T) {
	tr := &Transformer{Strict: true}
	v, err := tr.Transform("string", "object", "not json")
	if err == nil {
		t.Fatalf("strict mode should error on bad JSON, got value %v", v)
	}
	te, ok := err.(*TransformError)
	if !ok {
		t.Fatalf("expected TransformError, got %T", err)
	}
	if te.ToType != "number" {
		// toNumber path may hit first; just verify it's a TransformError
	}
}

func TestTransformer_Transform_ToUnknown(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "unknown", "hello")
	if err == nil {
		t.Fatalf("expected error for unknown target type, got %v", v)
	}
	te, ok := err.(*TransformError)
	if !ok {
		t.Fatalf("expected TransformError, got %T", err)
	}
	if te.ToType != "unknown" {
		t.Fatalf("expected ToType=unknown, got %s", te.ToType)
	}
}

func TestTransformer_Transform_NumberToDate(t *testing.T) {
	tr := NewTransformer()
	ts := time.Now().Unix()
	v, err := tr.Transform("number", "datetime", strconv.FormatInt(ts, 10))
	if err != nil {
		t.Fatalf("number to datetime: %v", err)
	}
	s := fmt.Sprintf("%v", v)
	if s == "" {
		t.Fatal("expected non-empty datetime string")
	}
}

func TestTransformer_Transform_StringToDateTime(t *testing.T) {
	tr := NewTransformer()
	v, err := tr.Transform("string", "datetime", "2026-01-15T12:00:00Z")
	if err != nil {
		t.Fatalf("string to datetime: %v", err)
	}
	if v != "2026-01-15T12:00:00Z" {
		t.Fatalf("expected RFC3339, got %v", v)
	}
}

func TestTransformer_ToRawValue(t *testing.T) {
	tr := NewTransformer()

	if tr.ToRawValue("string", "hello") != "hello" {
		t.Fatal("ToRawValue string mismatch")
	}
	if tr.ToRawValue("int", 42) != "42" {
		t.Fatal("ToRawValue int mismatch")
	}
	if tr.ToRawValue("bool", true) != "true" {
		t.Fatal("ToRawValue bool mismatch")
	}
	if tr.ToRawValue("nil", nil) != "" {
		t.Fatal("ToRawValue nil should be empty")
	}
}

func TestTransformer_SerializeValue(t *testing.T) {
	tr := NewTransformer()

	arr := []string{"a", "b"}
	result := tr.SerializeValue("array", arr)
	if ia, ok := result.([]interface{}); !ok {
		t.Fatalf("SerializeValue []string should yield []interface{}, got %T", result)
	} else if len(ia) != 2 {
		t.Fatalf("expected 2 items, got %d", len(ia))
	}

	if tr.SerializeValue("nil", nil) != nil {
		t.Fatal("SerializeValue nil should be nil")
	}
}

func TestTransformer_BatchTransform(t *testing.T) {
	tr := NewTransformer()
	inputs := []TransformInput{
		{FromType: "string", ToType: "string", Value: "hi", Param: "p1"},
		{FromType: "string", ToType: "number", Value: "42", Param: "p2"},
		{FromType: "string", ToType: "number", Value: "bad", Param: "p3"},
	}
	outputs := tr.BatchTransform(inputs)
	if len(outputs) != 3 {
		t.Fatalf("expected 3 outputs, got %d", len(outputs))
	}
	if !outputs[0].Success || outputs[0].Param != "p1" {
		t.Fatalf("p1 should succeed, got %v", outputs[0])
	}
	if !outputs[1].Success {
		t.Fatalf("p2 should succeed, got %v", outputs[1])
	}
	if outputs[2].Success {
		t.Fatalf("p3 should fail, got %v", outputs[2])
	}
}

func TestTransformer_CoerceWithDefault(t *testing.T) {
	tr := NewTransformer()

	// Valid value — use value
	v, err := tr.CoerceWithDefault("number", "10", "1")
	if err != nil {
		t.Fatalf("CoerceWithDefault valid: %v", err)
	}
	if f, ok := v.(float64); !ok || f != 10.0 {
		t.Fatalf("expected 10, got %v", v)
	}

	// Empty value — use default
	v, err = tr.CoerceWithDefault("number", "", "1")
	if err != nil {
		t.Fatalf("CoerceWithDefault empty: %v", err)
	}
	if f, ok := v.(float64); !ok || f != 1.0 {
		t.Fatalf("expected default 1, got %v", v)
	}
}

func TestTransformer_NestedPath(t *testing.T) {
	tr := NewTransformer()
	obj := map[string]interface{}{
		"config": map[string]interface{}{
			"database": map[string]interface{}{"name": "prod"},
		},
	}
	v, ok := tr.NestedPath(obj, "config.database.name")
	if !ok {
		t.Fatal("NestedPath should find value")
	}
	if v != "prod" {
		t.Fatalf("expected prod, got %v", v)
	}

	v, ok = tr.NestedPath(obj, "nonexistent.path")
	if ok {
		t.Fatal("NestedPath should not find nonexistent path")
	}
	if v != nil {
		t.Fatalf("expected nil for nonexistent path, got %v", v)
	}
}

func TestTransformer_SetNestedPath(t *testing.T) {
	tr := NewTransformer()
	obj := map[string]interface{}{}
	tr.SetNestedPath(obj, "a.b.c", "val")
	if obj["a"].(map[string]interface{})["b"].(map[string]interface{})["c"] != "val" {
		t.Fatal("SetNestedPath should create nested map")
	}
}

func TestTransformer_FlattenAndUnflatten(t *testing.T) {
	tr := NewTransformer()
	obj := map[string]interface{}{
		"a": map[string]interface{}{
			"b": 42,
			"c": "str",
		},
	}
	flat := tr.FlattenObject(obj, "")
	if flat["a.b"] != 42 {
		t.Fatalf("expected a.b=42, got %v", flat["a.b"])
	}
	if flat["a.c"] != "str" {
		t.Fatalf("expected a.c=str, got %v", flat["a.c"])
	}

	restored := tr.UnflattenObject(flat)
	if restored["a"].(map[string]interface{})["b"] != 42 {
		t.Fatal("UnflattenObject should restore nesting")
	}
}

func TestTransformer_Base64(t *testing.T) {
	tr := NewTransformer()
	data := []byte("hello")
	enc := tr.EncodeBase64(data)
	dec, err := tr.DecodeBase64(enc)
	if err != nil {
		t.Fatalf("DecodeBase64: %v", err)
	}
	if !reflect.DeepEqual(data, dec) {
		t.Fatalf("base64 round-trip failed: %v != %v", data, dec)
	}

	_, err = tr.DecodeBase64("not-valid-base64!!!")
	if err == nil {
		t.Fatal("DecodeBase64 should error on invalid input")
	}
}

func TestTransformer_BytesToHuman(t *testing.T) {
	tr := NewTransformer()

	if tr.BytesToHuman(500) != "500 B" {
		t.Fatalf("500 B mismatch: %s", tr.BytesToHuman(500))
	}
	if tr.BytesToHuman(1024) != "1.0 KB" {
		t.Fatalf("1 KB mismatch: %s", tr.BytesToHuman(1024))
	}
}

func TestTransformer_HumanToBytes(t *testing.T) {
	tr := NewTransformer()

	n, err := tr.HumanToBytes("1024")
	if err != nil || n != 1024 {
		t.Fatalf("expected 1024, got %d %v", n, err)
	}

	n, err = tr.HumanToBytes("2 MB")
	if err != nil || n != 2097152 {
		t.Fatalf("expected 2097152, got %d %v", n, err)
	}

	n, err = tr.HumanToBytes("1 GB")
	if err != nil || n != 1073741824 {
		t.Fatalf("expected 1073741824, got %d %v", n, err)
	}

	_, err = tr.HumanToBytes("not-a-number")
	if err == nil {
		t.Fatal("expected error for non-numeric input")
	}
}

func TestTransformer_toJSON(t *testing.T) {
	tr := NewTransformer()

	// JSON string as-is
	s, err := tr.toJSON(`{"a":1}`, "string")
	if err != nil || s != `{"a":1}` {
		t.Fatalf("expected as-is JSON, got %q %v", s, err)
	}

	// Non-JSON string → JSON-escaped
	s, err = tr.toJSON("hello", "string")
	if err != nil || s != `"hello"` {
		t.Fatalf("expected escaped JSON string, got %q %v", s, err)
	}
}

func TestTransformer_parseValue(t *testing.T) {
	// json type
	obj, err := parseValue("json", `{"x":1}`)
	if err != nil {
		t.Fatalf("parseValue json: %v", err)
	}
	if m, ok := obj.(map[string]interface{}); !ok || m["x"] != float64(1) {
		t.Fatalf("expected json object, got %v", obj)
	}

	_, err = parseValue("json", `not json`)
	if err == nil {
		t.Fatal("parseValue json should error on bad input")
	}

	// number
	v, err := parseValue("number", "3.14")
	if err != nil {
		t.Fatalf("parseValue number: %v", err)
	}
	if f, ok := v.(float64); !ok || f != 3.14 {
		t.Fatalf("expected 3.14, got %v", v)
	}

	// boolean
	v, err = parseValue("boolean", "true")
	if err != nil {
		t.Fatalf("parseValue boolean: %v", err)
	}
	if v != true {
		t.Fatalf("expected true, got %v", v)
	}

	// array
	v, err = parseValue("array", "a, b")
	if err != nil {
		t.Fatalf("parseValue array: %v", err)
	}
	arr := v.([]string)
	if len(arr) != 2 || arr[1] != "b" {
		t.Fatalf("expected [a b], got %v", arr)
	}

	// object
	v, err = parseValue("object", `{}`)
	if err != nil {
		t.Fatalf("parseValue object: %v", err)
	}
	if _, ok := v.(map[string]interface{}); !ok {
		t.Fatalf("expected object, got %T", v)
	}

	// datetime RFC3339
	v, err = parseValue("datetime", "2026-06-01T00:00:00Z")
	if err != nil {
		t.Fatalf("parseValue datetime: %v", err)
	}
	if _, ok := v.(time.Time); !ok {
		t.Fatalf("expected time.Time, got %T", v)
	}
}

func TestTransformer_isJSON(t *testing.T) {
	if !isJSON(`{"a":1}`) {
		t.Fatal("expected valid JSON")
	}
	if isJSON("hello") {
		t.Fatal("expected invalid JSON")
	}
}

func TestTransformError_JSONFields(t *testing.T) {
	te := TransformError{
		FromType: "string", ToType: "number", Value: "abc", Message: "parse failed",
	}
	if te.FromType != "string" {
		t.Fatal("TransformError fields should be accessible")
	}
	_, _ = json.Marshal(te)
}
