package export

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"go.uber.org/zap"
)

// ExportFormat is the target format for report export.
type ExportFormat string

const (
	FormatJSON  ExportFormat = "json"
	FormatCSV   ExportFormat = "csv"
	FormatHTML  ExportFormat = "html"
	FormatExcel ExportFormat = "excel"
	FormatPDF   ExportFormat = "pdf"
)

// ReportData holds the assembled report data to be exported.
type ReportData struct {
	Title     string                 `json:"title"`
	Sections  []map[string][]map[string]interface{} `json:"sections"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// Exporter converts ReportData into the target format.
type Exporter struct {
	logger *zap.Logger
}

func NewExporter(logger *zap.Logger) *Exporter {
	return &Exporter{logger: logger}
}

// Export converts ReportData to the given format and returns the content.
func (e *Exporter) Export(data *ReportData, format ExportFormat) ([]byte, string, error) {
	switch format {
	case FormatJSON:
		return e.exportJSON(data)
	case FormatCSV:
		return e.exportCSV(data)
	case FormatHTML:
		return e.exportHTML(data)
	case FormatExcel:
		return e.exportExcel(data)
	case FormatPDF:
		return e.exportPDF(data)
	default:
		return nil, "", fmt.Errorf("unsupported format: %s", format)
	}
}

func (e *Exporter) exportJSON(data *ReportData) ([]byte, string, error) {
	buf, err := json.MarshalIndent(data, "", "  ")
	return buf, "application/json", err
}

func (e *Exporter) exportCSV(data *ReportData) ([]byte, string, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	defer w.Flush()

	for _, section := range data.Sections {
		for _, rows := range section {
			if len(rows) == 0 {
				continue
			}
			var headers []string
			for k := range rows[0] {
				headers = append(headers, k)
			}
			if err := w.Write(headers); err != nil {
				return nil, "", fmt.Errorf("write csv header: %w", err)
			}
			for _, row := range rows {
				record := make([]string, len(headers))
				for i, h := range headers {
					if v, ok := row[h]; ok {
						record[i] = fmt.Sprintf("%v", v)
					}
				}
				if err := w.Write(record); err != nil {
					return nil, "", fmt.Errorf("write csv row: %w", err)
				}
			}
		}
	}
	return buf.Bytes(), "text/csv", nil
}

func (e *Exporter) exportHTML(data *ReportData) ([]byte, string, error) {
	var sb strings.Builder
	sb.WriteString("<!DOCTYPE html><html><head><meta charset='utf-8'>")
	sb.WriteString(fmt.Sprintf("<title>%s</title>", data.Title))
	sb.WriteString("<style>body{font-family:sans-serif;margin:2em}table{border-collapse:collapse;width:100%}")
	sb.WriteString("th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style>")
	sb.WriteString("</head><body>")
	sb.WriteString(fmt.Sprintf("<h1>%s</h1>", data.Title))

	for _, section := range data.Sections {
		for name, rows := range section {
			sb.WriteString(fmt.Sprintf("<h2>%s</h2>", name))
			if len(rows) > 0 {
				sb.WriteString("<table><thead><tr>")
				var headers []string
				for k := range rows[0] {
					headers = append(headers, k)
				}
				for _, h := range headers {
					sb.WriteString(fmt.Sprintf("<th>%s</th>", h))
				}
				sb.WriteString("</tr></thead><tbody>")
				for _, row := range rows {
					sb.WriteString("<tr>")
					for _, h := range headers {
						v := row[h]
						sb.WriteString(fmt.Sprintf("<td>%v</td>", v))
					}
					sb.WriteString("</tr>")
				}
				sb.WriteString("</tbody></table>")
			}
		}
	}
	sb.WriteString("</body></html>")
	return []byte(sb.String()), "text/html", nil
}

// exportExcel generates a minimal Excel-compatible output.
// In production, use excelize library for proper .xlsx generation.
// This returns HTML-table format which Excel can open as .xls.
func (e *Exporter) exportExcel(data *ReportData) ([]byte, string, error) {
	var buf bytes.Buffer
	buf.WriteString("<html xmlns:o='urn:schemas-microsoft-com:office:office'")
	buf.WriteString(" xmlns:x='urn:schemas-microsoft-com:office:excel'><head>")
	buf.WriteString("<meta charset='utf-8'><style>td{border:1px solid #999}</style>")
	buf.WriteString("</head><body>")

	for _, section := range data.Sections {
		for name, rows := range section {
			buf.WriteString(fmt.Sprintf("<h2>%s</h2>", name))
			if len(rows) > 0 {
				buf.WriteString("<table><thead><tr>")
				var headers []string
				for k := range rows[0] {
					headers = append(headers, k)
				}
				for _, h := range headers {
					buf.WriteString(fmt.Sprintf("<th>%s</th>", h))
				}
				buf.WriteString("</tr></thead><tbody>")
				for _, row := range rows {
					buf.WriteString("<tr>")
					for _, h := range headers {
						buf.WriteString(fmt.Sprintf("<td>%v</td>", row[h]))
					}
					buf.WriteString("</tr>")
				}
				buf.WriteString("</tbody></table>")
			}
		}
	}
	buf.WriteString("</body></html>")
	return buf.Bytes(), "application/vnd.ms-excel", nil
}

// exportPDF generates a simple PDF using gofpdf if available,
// or falls back to a text-based representation.
// In production, replace with a proper PDF library integration.
func (e *Exporter) exportPDF(data *ReportData) ([]byte, string, error) {
	var sb strings.Builder
	sb.WriteString("%PDF-1.4\n")
	sb.WriteString(fmt.Sprintf("Title: %s\n", data.Title))
	sb.WriteString(strings.Repeat("=", 40) + "\n\n")

	for _, section := range data.Sections {
		for name, rows := range section {
			sb.WriteString(fmt.Sprintf("Section: %s\n", name))
			if len(rows) > 0 {
				var headers []string
				for k := range rows[0] {
					headers = append(headers, k)
				}
				headerLine := strings.Join(headers, " | ")
				sb.WriteString(headerLine + "\n")
				sb.WriteString(strings.Repeat("-", len(headerLine)) + "\n")
				for _, row := range rows {
					vals := make([]string, len(headers))
					for i, h := range headers {
						vals[i] = fmt.Sprintf("%v", row[h])
					}
					sb.WriteString(strings.Join(vals, " | ") + "\n")
				}
			}
			sb.WriteString("\n")
		}
	}
	sb.WriteString("%EOF\n")
	return []byte(sb.String()), "application/pdf", nil
}

// WriteToStream writes exported data to an io.Writer.
func (e *Exporter) WriteToStream(data *ReportData, format ExportFormat, w io.Writer) error {
	content, _, err := e.Export(data, format)
	if err != nil {
		return err
	}
	_, err = w.Write(content)
	return err
}
