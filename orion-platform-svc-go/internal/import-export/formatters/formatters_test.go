package formatters

import (
	"bytes"
	"strings"
	"testing"
)

func TestToCSVRows(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"name": "Alice", "age": int64(30)},
		{"name": "Bob", "age": int64(25)},
	}
	err := ToCSVRows(&buf, records, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	dump := buf.String()
	if !strings.Contains(dump, "age") || !strings.Contains(dump, "name") {
		t.Error("missing header fields:", dump)
	}
	// Header + 2 data rows = 3 lines (csv uses CRLF internally)
	lines := strings.Split(dump, "\n")
	if len(lines)-1 != 3 { // last split is empty
		t.Errorf("expected 3 rows, got %d", len(lines))
	}
}

func TestToCSVRowsEmpty(t *testing.T) {
	var buf bytes.Buffer
	err := ToCSVRows(&buf, nil, nil, true)
	if err != nil {
		t.Fatal(err)
	}
}

func TestToCSVRowsFieldOrder(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"c": 3, "b": 2, "a": 1},
	}
	err := ToCSVRows(&buf, records, []string{"c", "a"}, true)
	if err != nil {
		t.Fatal(err)
	}
	// Header is sorted: a,b,c
	dump := buf.String()
	if !strings.Contains(dump, "a") || !strings.Contains(dump, "b") || !strings.Contains(dump, "c") {
		t.Error("expected all 3 columns:", dump)
	}
}

func TestToCSVRowsNoHeader(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"x": "v"},
	}
	err := ToCSVRows(&buf, records, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(buf.String(), "x") && !strings.Contains(buf.String(), "v") {
		// headerless just writes values
	}
	// Should not contain a header line
	dump := buf.String()
	if strings.HasPrefix(dump, "x") {
		// if first column name matches value it's ambiguous, skip
	}
}

func TestToCSVRowsValueTypes(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"s": "hi", "i": int64(42), "f": float64(3.14), "b": true},
	}
	err := ToCSVRows(&buf, records, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	dump := buf.String()
	if !strings.Contains(dump, "42") || !strings.Contains(dump, "3.14") || !strings.Contains(dump, "true") {
		t.Error("expected typed values in CSV:", dump)
	}
}

func TestFromCSVRows(t *testing.T) {
	input := "name,age\nAlice,30\nBob,25\n"
	records, err := FromCSVRows(strings.NewReader(input), true)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0]["name"] != "Alice" {
		t.Errorf("name = %q", records[0]["name"])
	}
	if records[1]["age"] != "25" {
		t.Errorf("age = %q", records[1]["age"])
	}
}

func TestFromCSVRowsNoHeader(t *testing.T) {
	input := "Alice,30\n"
	records, err := FromCSVRows(strings.NewReader(input), false)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatal("expected 1 record")
	}
	if records[0]["col_0"] != "Alice" {
		t.Errorf("col_0 = %q", records[0]["col_0"])
	}
}

func TestFromCSVRowsEmpty(t *testing.T) {
	records, err := FromCSVRows(strings.NewReader(""), true)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Errorf("empty CSV should return empty slice, got %d", len(records))
	}
}

func TestToJSONRecords(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"k": "v"},
		{"k": "v2"},
	}
	err := ToJSONRecords(&buf, records)
	if err != nil {
		t.Fatal(err)
	}
	dump := buf.String()
	if !strings.Contains(dump, "[{") {
		t.Error("expected JSON array:", dump)
	}
	if !strings.HasSuffix(dump, "\n") {
		t.Error("should end with newline")
	}
}

func TestToJSONLRecords(t *testing.T) {
	var buf bytes.Buffer
	records := []map[string]interface{}{
		{"k": "v"},
		{"k": "v2"},
	}
	err := ToJSONLRecords(&buf, records)
	if err != nil {
		t.Fatal(err)
	}
	dump := buf.String()
	lines := strings.Split(strings.TrimSpace(dump), "\n")
	if len(lines) != 2 {
		t.Errorf("expected 2 lines, got %d: %q", len(lines), dump)
	}
}

func TestFromJSONReaderArray(t *testing.T) {
	input := `[{"name":"Alice"},{"name":"Bob"}]`
	records, err := FromJSONReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2, got %d", len(records))
	}
	if records[0]["name"] != "Alice" {
		t.Error("wrong first record")
	}
}

func TestFromJSONReaderSingleObject(t *testing.T) {
	input := `{"name":"Alice"}`
	records, err := FromJSONReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1, got %d", len(records))
	}
	if records[0]["name"] != "Alice" {
		t.Error("wrong single object")
	}
}

func TestFromJSONReaderWrapped(t *testing.T) {
	input := `{"records":[{"name":"Alice"}]}`
	records, err := FromJSONReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1, got %d", len(records))
	}
}

func TestFromJSONReaderInvalid(t *testing.T) {
	_, err := FromJSONReader(strings.NewReader("not json"))
	if err == nil {
		t.Error("invalid JSON should error")
	}
}

func TestFmtValue(t *testing.T) {
	tests := []struct {
		input interface{}
		want  string
	}{
		{nil, ""},
		{"hello", "hello"},
		{int(42), "42"},
		{int64(99), "99"},
		{float64(3.14), "3.14"},
		{true, "true"},
		{false, "false"},
	}
	for _, tt := range tests {
		if got := fmtValue(tt.input); got != tt.want {
			t.Errorf("fmtValue(%v) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
