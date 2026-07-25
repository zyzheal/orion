package datasource

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
)

// CSVSource implements DataSource for CSV files.
type CSVSource struct {
	cfg *DataSourceConfig
}

// NewCSVSource creates a new CSVSource from config.
func NewCSVSource(cfg *DataSourceConfig) (*CSVSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	return &CSVSource{cfg: cfg}, nil
}

// Type returns the data source type.
func (c *CSVSource) Type() DataSourceType {
	return TypeCSV
}

// Connect performs a lightweight check that the CSV file exists and is readable.
func (c *CSVSource) Connect(ctx context.Context) error {
	path := c.getPath()
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to stat csv file: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("csv path is a directory, expected a file")
	}
	return nil
}

// Close releases resources (none held).
func (c *CSVSource) Close() error {
	return nil
}

// Execute reads the CSV file and returns results.
func (c *CSVSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	path := c.getPath()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open csv file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // Allow variable number of fields

	var allRecords [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read csv row: %w", err)
		}
		allRecords = append(allRecords, record)
	}

	if len(allRecords) == 0 {
		return &QueryResult{Fields: []string{}, Total: 0}, nil
	}

	fields := allRecords[0]
	result := &QueryResult{Fields: fields}
	for _, rec := range allRecords[1:] {
		var row []interface{}
		for _, val := range rec {
			row = append(row, val)
		}
		result.Rows = append(result.Rows, row)
	}
	result.Total = len(result.Rows)

	return result, nil
}

// Health checks if the CSV file is accessible.
func (c *CSVSource) Health(ctx context.Context) (bool, error) {
	return c.Connect(ctx) == nil, nil
}

// -- Private helpers --------------------------------------------------

func (c *CSVSource) getPath() string {
	if v, ok := c.cfg.Config["path"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "/tmp/datasource.csv"
}
