package export

import (
	"bytes"
	"testing"

	"go.uber.org/zap"
)

func sampleReportData() *ReportData {
	return &ReportData{
		Title: "Test Report",
		Sections: []map[string][]map[string]interface{}{
			{
				"Sheet1": {
					{"name": "alice", "score": float64(95)},
					{"name": "bob", "score": float64(82)},
				},
			},
		},
		Metadata: map[string]interface{}{"version": "1.0"},
	}
}

func TestExport_JSON(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data, ct, err := e.Export(sampleReportData(), FormatJSON)
	if err != nil {
		t.Fatalf("json export: %v", err)
	}
	if ct != "application/json" {
		t.Errorf("expected application/json, got %s", ct)
	}
	if len(data) == 0 {
		t.Error("expected non-empty JSON")
	}
}

func TestExport_CSV(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data, ct, err := e.Export(sampleReportData(), FormatCSV)
	if err != nil {
		t.Fatalf("csv export: %v", err)
	}
	if ct != "text/csv" {
		t.Errorf("expected text/csv, got %s", ct)
	}
	if len(data) == 0 {
		t.Error("expected non-empty CSV")
	}
}

func TestExport_HTML(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data, ct, err := e.Export(sampleReportData(), FormatHTML)
	if err != nil {
		t.Fatalf("html export: %v", err)
	}
	if ct != "text/html" {
		t.Errorf("expected text/html, got %s", ct)
	}
	if len(data) == 0 {
		t.Error("expected non-empty HTML")
	}
}

func TestExport_Excel(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data, ct, err := e.Export(sampleReportData(), FormatExcel)
	if err != nil {
		t.Fatalf("excel export: %v", err)
	}
	if ct != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		t.Errorf("unexpected content type: %s", ct)
	}
	if len(data) == 0 {
		t.Error("expected non-empty Excel file")
	}
}

func TestExport_PDF(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data, ct, err := e.Export(sampleReportData(), FormatPDF)
	if err != nil {
		t.Fatalf("pdf export: %v", err)
	}
	if ct != "application/pdf" {
		t.Errorf("expected application/pdf, got %s", ct)
	}
	if len(data) == 0 {
		t.Error("expected non-empty PDF file")
	}
}

func TestExport_UnsupportedFormat(t *testing.T) {
	e := NewExporter(zap.NewNop())
	_, _, err := e.Export(sampleReportData(), ExportFormat("xml"))
	if err == nil {
		t.Fatal("expected error for unsupported format")
	}
}

func TestExport_EmptySections(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data := &ReportData{Title: "Empty", Sections: nil}
	_, _, err := e.Export(data, FormatJSON)
	if err != nil {
		t.Fatalf("json empty: %v", err)
	}
	_, _, err = e.Export(data, FormatCSV)
	if err != nil {
		t.Fatalf("csv empty: %v", err)
	}
	_, _, err = e.Export(data, FormatHTML)
	if err != nil {
		t.Fatalf("html empty: %v", err)
	}
	_, _, err = e.Export(data, FormatExcel)
	if err != nil {
		t.Fatalf("excel empty: %v", err)
	}
	_, _, err = e.Export(data, FormatPDF)
	if err != nil {
		t.Fatalf("pdf empty: %v", err)
	}
}

func TestExport_MultipleSections(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data := &ReportData{
		Title: "Multi",
		Sections: []map[string][]map[string]interface{}{
			{
				"First": {{"a": float64(1)}},
			},
			{
				"Second": {{"b": float64(2)}},
			},
		},
	}
	_, _, err := e.Export(data, FormatExcel)
	if err != nil {
		t.Fatalf("excel multi: %v", err)
	}
	_, _, err = e.Export(data, FormatPDF)
	if err != nil {
		t.Fatalf("pdf multi: %v", err)
	}
}

func TestWriteToStream(t *testing.T) {
	e := NewExporter(zap.NewNop())
	data := sampleReportData()
	var buf bytes.Buffer
	if err := e.WriteToStream(data, FormatJSON, &buf); err != nil {
		t.Fatalf("write stream: %v", err)
	}
	if buf.Len() == 0 {
		t.Error("expected non-empty stream")
	}
}

func TestGetExcelCol(t *testing.T) {
	tests := []struct {
		idx  int
		want string
	}{
		{0, "A"},
		{1, "B"},
		{25, "Z"},
		{26, "AA"},
		{27, "AB"},
	}
	for _, tt := range tests {
		got := getExcelCol(tt.idx)
		if got != tt.want {
			t.Errorf("getExcelCol(%d) = %s, want %s", tt.idx, got, tt.want)
		}
	}
}
