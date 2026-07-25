package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// JSONSource implements DataSource for JSON files.
type JSONSource struct {
	cfg *DataSourceConfig
}

// NewJSONSource creates a new JSONSource from config.
func NewJSONSource(cfg *DataSourceConfig) (*JSONSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	return &JSONSource{cfg: cfg}, nil
}

// Type returns the data source type.
func (j *JSONSource) Type() DataSourceType {
	return TypeJSON
}

// Connect performs a lightweight check that the JSON file exists and is readable.
func (j *JSONSource) Connect(ctx context.Context) error {
	path := j.getPath()
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to stat json file: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("json path is a directory, expected a file")
	}
	return nil
}

// Close releases resources (none held).
func (j *JSONSource) Close() error {
	return nil
}

// Execute reads the JSON file and returns results.
func (j *JSONSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	path := j.getPath()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open json file: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read json file: %w", err)
	}

	var body []map[string]interface{}
	if err := json.Unmarshal(data, &body); err != nil {
		// Try as a single object.
		var single map[string]interface{}
		if err2 := json.Unmarshal(data, &single); err2 != nil {
			return nil, fmt.Errorf("failed to decode json: %w", err)
		}
		body = append(body, single)
	}

	result := &QueryResult{}
	for _, item := range body {
		if len(result.Fields) == 0 {
			for k := range item {
				result.Fields = append(result.Fields, k)
			}
		}
		var row []interface{}
		for _, field := range result.Fields {
			if val, exists := item[field]; exists {
				row = append(row, val)
			} else {
				row = append(row, nil)
			}
		}
		if len(row) > 0 {
			result.Rows = append(result.Rows, row)
		}
	}

	result.Total = len(result.Rows)
	return result, nil
}

// Health checks if the JSON file is accessible.
func (j *JSONSource) Health(ctx context.Context) (bool, error) {
	return j.Connect(ctx) == nil, nil
}

// -- Private helpers --------------------------------------------------

func (j *JSONSource) getPath() string {
	if v, ok := j.cfg.Config["path"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "/tmp/datasource.json"
}
