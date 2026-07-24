package formatters

import (
	"encoding/csv"
	"fmt"
	"io"
	"sort"
	"strconv"
)

// ===================================================================
// CSV Formatter

// ToCSVRows reads records (as a slice of maps) and streams them as CSV.
//
// fieldOrder gives the column sequence; if omitted, columns are sorted
// alphabetically by key.
func ToCSVRows(out io.Writer, records []map[string]interface{},
	fieldOrder []string, includeHeader bool) error {
	if len(records) == 0 {
		return nil
	}
	w := csv.NewWriter(out)
	defer w.Flush()

	// Build header from fieldOrder, then collect any leftover fields.
	header := make([]string, 0, len(fieldOrder)+len(records[0]))
	for _, f := range fieldOrder {
		if _, ok := records[0][f]; ok {
			header = append(header, f)
		}
	}
	for k, v := range records[0] {
		if v == nil {
			continue
		}
		seen := false
		for _, h := range header {
			if h == k {
				seen = true
				break
			}
		}
		if !seen {
			header = append(header, k)
		}
	}
	sort.Strings(header)

	if includeHeader {
		if err := w.Write(header); err != nil {
			return fmt.Errorf("csv: write header: %w", err)
		}
	}
	for _, r := range records {
		row := make([]string, len(header))
		for i, h := range header {
			val := r[h]
			row[i] = fmtValue(val)
		}
		if err := w.Write(row); err != nil {
			return fmt.Errorf("csv: write row: %w", err)
		}
	}
	return nil
}

// FromCSVRows parses a CSV reader into a list of field→value maps.
//
// If hasHeader is true, the first row is used as keys; otherwise rows are
// indexed numerically (col_0, col_1, ...).
func FromCSVRows(in io.Reader, hasHeader bool) ([]map[string]interface{}, error) {
	r := csv.NewReader(in)
	r.LazyQuotes = true     // be tolerant of real-world files
	r.TrimLeadingSpace = true
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("csv: parse: %w", err)
	}
	if len(records) == 0 {
		return nil, nil
	}

	start := 0
	headers := make([]string, 0)
	if hasHeader {
		headers = records[0]
		start = 1
	}

	rows := make([]map[string]interface{}, 0, len(records)-start)
	for i := start; i < len(records); i++ {
		row := records[i]
		m := make(map[string]interface{})
		for j, v := range row {
			key := fmt.Sprintf("col_%d", j)
			if j < len(headers) {
				key = headers[j]
			}
			m[key] = v
		}
		rows = append(rows, m)
	}
	return rows, nil
}

// fmtValue converts an arbitrary value to its string representation for CSV cells.
func fmtValue(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case int:
		return strconv.FormatInt(int64(t), 10)
	case int64:
		return strconv.FormatInt(t, 10)
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(t)
	default:
		return fmt.Sprintf("%v", t)
	}
}
