package export

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/jung-kurt/gofpdf"
	"github.com/xuri/excelize/v2"
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
	Title     string                              `json:"title"`
	Sections  []map[string][]map[string]interface{} `json:"sections"`
	Metadata  map[string]interface{}              `json:"metadata"`
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
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, "", fmt.Errorf("flush csv: %w", err)
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

// exportExcel generates a real Excel file using excelize library.
func (e *Exporter) exportExcel(data *ReportData) ([]byte, string, error) {
	f := excelize.NewFile()
	sheetIdx := 0

	for _, section := range data.Sections {
		for name, rows := range section {
			var sheetName string
			if sheetIdx == 0 {
				// Rename default Sheet1
				sheetName = name
				if len(sheetName) > 31 {
					sheetName = sheetName[:31]
				}
				f.SetSheetName("Sheet1", sheetName)
			} else {
				sheetName = fmt.Sprintf("%s_%d", name, sheetIdx)
				if len(sheetName) > 31 {
					sheetName = sheetName[:31]
				}
				f.NewSheet(sheetName)
			}

			// Write title in row 1
			f.SetCellValue(sheetName, "A1", name)

			// Write headers in row 3, data from row 4
			if len(rows) > 0 {
				var headers []string
				for k := range rows[0] {
					headers = append(headers, k)
				}
				for i, h := range headers {
					cell := fmt.Sprintf("%s3", getExcelCol(i))
					f.SetCellValue(sheetName, cell, h)
				}
				for rowIdx, row := range rows {
					for colIdx, h := range headers {
						cell := fmt.Sprintf("%s%d", getExcelCol(colIdx), 4+rowIdx)
						f.SetCellValue(sheetName, cell, fmt.Sprintf("%v", row[h]))
					}
				}
			}
			sheetIdx++
		}
	}

	buf := new(bytes.Buffer)
	if err := f.Write(buf); err != nil {
		return nil, "", fmt.Errorf("write excel: %w", err)
	}
	return buf.Bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nil
}

// getExcelCol converts a column index to Excel column letter(s).
func getExcelCol(idx int) string {
	var col string
	for idx >= 0 {
		col = string(rune('A'+idx%26)) + col
		idx = idx/26 - 1
	}
	return col
}

// exportPDF generates a real PDF using gofpdf library.
func (e *Exporter) exportPDF(data *ReportData) ([]byte, string, error) {
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetTitle(data.Title, false)
	pdf.SetHeaderFunc(func() {
		pdf.SetFont("Helvetica", "B", 16)
		pdf.CellFormat(0, 10, data.Title, "", 1, "C", false, 0, "")
	})
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Helvetica", "I", 8)
		pdf.CellFormat(0, 10, fmt.Sprintf("Page %d", pdf.PageNo()), "", 1, "C", false, 0, "")
	})
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 12)

	for _, section := range data.Sections {
		for name, rows := range section {
			pdf.SetFont("Helvetica", "B", 14)
			pdf.CellFormat(0, 10, name, "", 1, "L", false, 0, "")
			pdf.SetFont("Helvetica", "", 10)
			if len(rows) > 0 {
				var headers []string
				for k := range rows[0] {
					headers = append(headers, k)
				}
				// Calculate column width to fit page
				pageWidth := 270.0 // A4 landscape usable width in mm
				colWidth := pageWidth / float64(len(headers))
				if colWidth > 60 {
					colWidth = 60
				}
				if colWidth < 20 {
					colWidth = 20
				}
				// Header row
				pdf.SetFont("Helvetica", "B", 10)
				for _, h := range headers {
					pdf.CellFormat(colWidth, 8, h, "1", 0, "L", false, 0, "")
				}
				pdf.Ln(8)
				// Data rows
				pdf.SetFont("Helvetica", "", 9)
				for _, row := range rows {
					for _, h := range headers {
						val := row[h]
						pdf.CellFormat(colWidth, 6, fmt.Sprintf("%v", val), "1", 0, "L", false, 0, "")
					}
					pdf.Ln(6)
				}
			}
			pdf.Ln(10)
		}
	}
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", fmt.Errorf("output pdf: %w", err)
	}
	return buf.Bytes(), "application/pdf", nil
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
