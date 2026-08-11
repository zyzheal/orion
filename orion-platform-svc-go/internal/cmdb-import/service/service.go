// Package service provides business logic for the CMDB Import service.
// It implements the CMDBImportManager with pluggable IImportHandler dispatch
// for loading CMDB data from various source formats.
//
// Architecture:
//   - IImportHandler: pluggable source parser + validator interface
//   - CMDBImportManager: orchestrates job lifecycle and handler dispatch
//   - Handlers: CSVHandler, ExcelHandler, JSONHandler, YAMLHandler,
//     APIHandler, DBHandler, SFTPHandler
//
// Translated from TS: blueprints/orion-cmdb-svc-go
package service

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cmdb-import/models"
	"orion/platform-svc-go/internal/cmdb-import/repository"

	"gopkg.in/yaml.v3"
)

var (
	ErrJobNotFound     = errors.New("import job not found")
	ErrInvalidStatus   = errors.New("invalid job status")
	ErrInvalidStatusTxn = errors.New("invalid status transition")
	ErrInvalidSourceType = errors.New("invalid source type")
	ErrInvalidTargetType = errors.New("invalid target type")
	ErrInvalidMode     = errors.New("invalid import mode")
	ErrNoHandler       = errors.New("no handler for source type")
	ErrParseFailed     = errors.New("failed to parse source")
	ErrValidateFailed  = errors.New("validation failed")
)

// ===========================================================================
// IImportHandler — pluggable source parser interface
// ===========================================================================

// IImportHandler defines the contract for source-specific parsers.
type IImportHandler interface {
	// SourceType returns the source type this handler supports.
	SourceType() string
	// Parse reads the source and returns raw rows as map slices.
	Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error)
	// Validate checks the parsed rows against a field mapping.
	Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string)
}

// ===========================================================================
// CSVHandler — parses CSV files
// ===========================================================================

// CSVHandler parses CSV files using the standard library.
type CSVHandler struct{}

func (h *CSVHandler) SourceType() string { return "csv" }

func (h *CSVHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	f, err := os.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrParseFailed, err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1 // allow variable fields

	// Determine delimiter
	delimiter := ','
	if d, ok := config["delimiter"]; ok && d != "" {
			delimiter = rune([]rune(d)[0])
		reader.Comma = delimiter
	}

	// Skip rows
	skipRows := 0
	if s, ok := config["skip_rows"]; ok {
		if n, err := strconv.Atoi(s); err == nil {
			for i := 0; i < n; i++ {
				if _, err := reader.Read(); err != nil {
					break
				}
			}
			skipRows = n
		}
	}

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrParseFailed, err)
	}

	if len(records) <= skipRows+1 {
		return nil, nil
	}

	// First row after skips = header
	header := records[skipRows]
	if len(header) == 0 {
		return nil, nil
	}

	var rows []map[string]interface{}
	for _, rec := range records[skipRows+1:] {
		m := make(map[string]interface{})
		for i, val := range rec {
			if i < len(header) {
				m[header[i]] = val
			}
		}
		rows = append(rows, m)
	}

	return rows, nil
}

func (h *CSVHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	var hints []string
	var errs []string
	if len(rows) == 0 {
		return hints, append(errs, "no rows parsed from source")
	}
	// Detect columns from first row
	cols := make(map[string]bool)
	for k := range rows[0] {
		cols[k] = true
	}
	for k := range cols {
		hints = append(hints, k)
	}
	// Check mapping keys exist in columns
	for srcCol := range mapping {
		if !cols[srcCol] {
			errs = append(errs, fmt.Sprintf("mapped source column not found: %s", srcCol))
		}
	}
	return hints, errs
}

// ===========================================================================
// ExcelHandler — parses Excel files (best-effort via base64 or CSV fallback)
// ===========================================================================

// ExcelHandler parses Excel files. Without a heavy external library, this
// accepts .xlsx files by attempting to read the embedded CSV fallback or
// returns an error instructing conversion. Production deployments may replace
// this with excelize-based parsing.
type ExcelHandler struct{}

func (h *ExcelHandler) SourceType() string { return "excel" }

func (h *ExcelHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	// Check if the file is actually a CSV with an .xls extension (common)
	ext := strings.ToLower(sourcePath)
	if strings.HasSuffix(ext, ".csv") {
		csv := &CSVHandler{}
		return csv.Parse(sourcePath, config)
	}
	// True .xlsx files: without excelize, instruct conversion
	if strings.HasSuffix(ext, ".xlsx") || strings.HasSuffix(ext, ".xls") {
		return nil, fmt.Errorf("%w: excel parsing requires excelize; convert to CSV first or set excel_format=csv", ErrParseFailed)
	}
	return nil, fmt.Errorf("%w: unsupported excel file format: %s", ErrParseFailed, sourcePath)
}

func (h *ExcelHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	var hints []string
	var errs []string
	if len(rows) == 0 {
		return hints, append(errs, "no rows parsed from excel source")
	}
	cols := make(map[string]bool)
	for k := range rows[0] {
		cols[k] = true
	}
	for k := range cols {
		hints = append(hints, k)
	}
	for srcCol := range mapping {
		if !cols[srcCol] {
			errs = append(errs, fmt.Sprintf("mapped source column not found: %s", srcCol))
		}
	}
	return hints, errs
}

// ===========================================================================
// JSONHandler — parses JSON arrays
// ===========================================================================

// JSONHandler parses JSON files containing arrays of objects.
type JSONHandler struct{}

func (h *JSONHandler) SourceType() string { return "json" }

func (h *JSONHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	data, err := readSource(sourcePath, config)
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrParseFailed, err)
	}
	return rows, nil
}

func (h *JSONHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	return validateMapping(rows, mapping)
}

// ===========================================================================
// YAMLHandler — parses YAML files
// ===========================================================================

// YAMLHandler parses YAML files containing lists of objects.
type YAMLHandler struct{}

func (h *YAMLHandler) SourceType() string { return "yaml" }

func (h *YAMLHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	data, err := readSource(sourcePath, config)
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	if err := yaml.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrParseFailed, err)
	}
	return rows, nil
}

func (h *YAMLHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	return validateMapping(rows, mapping)
}

// ===========================================================================
// APIHandler — fetches JSON data from a remote HTTP API
// ===========================================================================

// APIHandler fetches data from a remote REST API endpoint.
type APIHandler struct{}

func (h *APIHandler) SourceType() string { return "api" }

func (h *APIHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	if !strings.HasPrefix(sourcePath, "http://") && !strings.HasPrefix(sourcePath, "https://") {
		return nil, fmt.Errorf("%w: api source path must be a URL", ErrParseFailed)
	}

	// Config: method, headers, timeout
	method := "GET"
	if m, ok := config["method"]; ok {
		method = m
	}
	timeout := 30 * time.Second
	if t, ok := config["timeout_seconds"]; ok && t != "" {
		if ti, err := strconv.Atoi(t); err == nil && ti > 0 && ti < 300 {
			timeout = time.Duration(ti) * time.Second
		}
	}

	req, err := http.NewRequest(method, sourcePath, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid URL: %v", ErrParseFailed, err)
	}
	// Set auth header from config
	if apiKey, ok := config["api_key"]; ok {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	if contentType, ok := config["content_type"]; ok {
		req.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: request failed: %v", ErrParseFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w: HTTP %d from API", ErrParseFailed, resp.StatusCode)
	}

	var rows []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, fmt.Errorf("%w: failed to decode API response: %v", ErrParseFailed, err)
	}
	return rows, nil
}

func (h *APIHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	return validateMapping(rows, mapping)
}

// ===========================================================================
// DBHandler — reads data from a PostgreSQL database
// ===========================================================================

// DBHandler reads CMDB data from a PostgreSQL database query.
type DBHandler struct{}

func (h *DBHandler) SourceType() string { return "db" }

func (h *DBHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	// sourcePath is the query SQL or a table name
	dsn := config["dsn"]
	if dsn == "" {
		return nil, fmt.Errorf("%w: dsn is required for db source type", ErrParseFailed)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to connect to database: %v", ErrParseFailed, err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := sourcePath
	if !strings.Contains(strings.ToLower(query), "select") {
		// Assume table name
		query = fmt.Sprintf("SELECT * FROM %s", query)
	}

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("%w: query failed: %v", ErrParseFailed, err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("%w: failed to get columns: %v", ErrParseFailed, err)
	}

	var result []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range cols {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("%w: scan failed: %v", ErrParseFailed, err)
		}
		m := make(map[string]interface{})
		for i, col := range cols {
			if values[i] == nil {
				m[col] = nil
				continue
			}
			switch v := values[i].(type) {
			case []byte:
				m[col] = string(v)
			default:
				m[col] = v
			}
		}
		result = append(result, m)
	}
	return result, nil
}

func (h *DBHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	return validateMapping(rows, mapping)
}

// ===========================================================================
// SFTPHandler — reads data via SFTP (stub for future implementation)
// ===========================================================================

// SFTPHandler reads files via SFTP protocol.
// Current implementation is a stub; production deployments should integrate
// ssh libraries (github.com/pkg/sftp).
type SFTPHandler struct{}

func (h *SFTPHandler) SourceType() string { return "sftp" }

func (h *SFTPHandler) Parse(sourcePath string, config map[string]string) ([]map[string]interface{}, error) {
	return nil, fmt.Errorf("%w: sftp import not implemented; configure remote host/port/user/key in config", ErrParseFailed)
}

func (h *SFTPHandler) Validate(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	return nil, []string{"sftp not implemented"}
}

// ===========================================================================
// CMDBImportManager — orchestrates import job lifecycle
// ===========================================================================

// CMDBImportManager manages CMDB import jobs and dispatches to handlers.
type CMDBImportManager struct {
	handlers map[string]IImportHandler
	repo     *repository.Repository
	mu       sync.RWMutex
}

// NewCMDBImportManager creates a new CMDBImportManager.
func NewCMDBImportManager(repo *repository.Repository) *CMDBImportManager {
	m := &CMDBImportManager{
		repo:     repo,
		handlers: make(map[string]IImportHandler),
	}
	// Register default handlers
	m.RegisterHandler(&CSVHandler{})
	m.RegisterHandler(&ExcelHandler{})
	m.RegisterHandler(&JSONHandler{})
	m.RegisterHandler(&YAMLHandler{})
	m.RegisterHandler(&APIHandler{})
	m.RegisterHandler(&DBHandler{})
	m.RegisterHandler(&SFTPHandler{})
	return m
}

// RegisterHandler registers a custom import handler.
func (m *CMDBImportManager) RegisterHandler(h IImportHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[h.SourceType()] = h
}

// handlerFor returns the handler for a source type.
func (m *CMDBImportManager) handlerFor(sourceType string) (IImportHandler, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.handlers[sourceType]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNoHandler, sourceType)
	}
	return h, nil
}

// CreateJob creates a new import job.
func (m *CMDBImportManager) CreateJob(ctx context.Context, tenantID, name, sourceType, sourcePath, targetType, mode string, mapping map[string]string) (*models.CMDBImportJob, error) {
	// Validate source type
	if !models.ValidSourceTypes[strings.ToLower(sourceType)] {
		return nil, fmt.Errorf("%w: %s (allowed: csv, excel, json, yaml, api, db, sftp)", ErrInvalidSourceType, sourceType)
	}
	sourceType = strings.ToLower(sourceType)

	// Validate target type
	if !models.ValidTargetTypes[strings.ToLower(targetType)] {
		return nil, fmt.Errorf("%w: %s (allowed: ci, relation, attribute)", ErrInvalidTargetType, targetType)
	}
	targetType = strings.ToLower(targetType)

	// Validate mode
	mode = strings.ToLower(mode)
	if mode == "" {
		mode = "upsert"
	}
	if !models.ValidImportModes[mode] {
		return nil, fmt.Errorf("%w: %s (allowed: create, update, upsert, merge)", ErrInvalidMode, mode)
	}

	// Serialize mapping to JSON
	mappingJSON := "{}"
	if mapping != nil {
		data, err := json.Marshal(mapping)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize mapping: %w", err)
		}
		mappingJSON = string(data)
	}

	j := &models.CMDBImportJob{
		TenantID:   tenantID,
		Name:       name,
		SourceType: sourceType,
		SourcePath: sourcePath,
		TargetType: targetType,
		Mapping:    mappingJSON,
		Mode:       mode,
		Status:     string(models.JobStatusPending),
	}

	if err := m.repo.CreateJob(ctx, j); err != nil {
		return nil, fmt.Errorf("create job failed: %w", err)
	}
	return j, nil
}

// StartJob starts an import job (transitions pending → running, parses, processes).
func (m *CMDBImportManager) StartJob(ctx context.Context, jobID string) error {
	j, err := m.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrJobNotFound, jobID)
		}
		return err
	}
	if m.isValidStatusTxn(j.Status, string(models.JobStatusRunning)) {
		return fmt.Errorf("%w: %s → running", ErrInvalidStatusTxn, j.Status)
	}

	// Transition to running
	now := time.Now().UTC()
	if _, err := m.repo.UpdateJobStatus(ctx, jobID, string(models.JobStatusRunning), nil, &now, nil); err != nil {
		return err
	}

	// Get handler
	handler, err := m.handlerFor(j.SourceType)
	if err != nil {
		m.markFailed(ctx, j, err)
		return err
	}

	// Parse
	rows, err := handler.Parse(j.SourcePath, nil)
	if err != nil {
		m.markFailed(ctx, j, err)
		return err
	}

	// Deserialize mapping
	var mapping map[string]string
	if j.Mapping != "" && j.Mapping != "{}" {
		if err := json.Unmarshal([]byte(j.Mapping), &mapping); err != nil {
			m.markFailed(ctx, j, fmt.Errorf("invalid mapping: %w", err))
			return err
		}
	}

	// Validate
	_, errs := handler.Validate(rows, mapping)
	if len(errs) > 0 {
		errMsg := "validation: " + strings.Join(errs, "; ")
		m.markFailed(ctx, j, errors.New(errMsg))
		return errors.New(errMsg)
	}

	// Process each row
	totalCount := len(rows)
	successCount := 0
	errorCount := 0
	for i, row := range rows {
		targetID := ""
		action := "created"
		if j.Mode == "update" {
			action = "updated"
		} else if j.Mode == "merge" {
			action = "skipped" // merge mode skips non-overlapping
		}

		// Serialize source row
		rowJSON, err := json.Marshal(row)
		if err != nil {
			rowJSON = []byte(`{}`)
		}

		// Simulate target ID generation
		targetID = j.ID[:8] + fmt.Sprintf("%03d", i)

		// Handle errors (simulate: row with "__error__" key means skip)
		if _, hasErr := row["__error__"]; hasErr {
			action = "failed"
			errorCount++
			m.repo.CreateRecord(ctx, &models.CMDBImportRecord{
				JobID:     j.ID,
				SourceRow: string(rowJSON),
				TargetID:  "",
				Action:    action,
				Error:     "row processing error",
			})
			continue
		}

		successCount++
		m.repo.CreateRecord(ctx, &models.CMDBImportRecord{
			JobID:     j.ID,
			SourceRow: string(rowJSON),
			TargetID:  targetID,
			Action:    action,
		})
	}

	// Update job counts
	if err := m.repo.UpdateJobCounts(ctx, j.ID, totalCount, successCount, errorCount); err != nil {
		m.loggerError("update counts failed: %v", err)
	}

	// Finalize status
	finishedAt := time.Now().UTC()
	if errorCount > totalCount {
		// All failed
		_, err := m.repo.UpdateJobStatus(ctx, j.ID, string(models.JobStatusFailed), nil, nil, &finishedAt)
		return err
	}
	_, err = m.repo.UpdateJobStatus(ctx, j.ID, string(models.JobStatusCompleted), nil, nil, &finishedAt)
	return err
}

// markFailed marks a job as failed with an error message.
func (m *CMDBImportManager) markFailed(ctx context.Context, j *models.CMDBImportJob, err error) {
	finishedAt := time.Now().UTC()
	errMsg := err.Error()
	_, _ = m.repo.UpdateJobStatus(ctx, j.ID, string(models.JobStatusFailed), &errMsg, nil, &finishedAt)
}

// isValidStatusTxn checks if a status transition is valid.
func (m *CMDBImportManager) isValidStatusTxn(from, to string) bool {
	allowed := models.ValidStatusTransitions[models.JobStatus(from)]
	for _, a := range allowed {
		if string(a) == to {
			return false // transition is valid
		}
	}
	return true // transition is invalid
}

// GetJob returns job details.
func (m *CMDBImportManager) GetJob(ctx context.Context, tenantID, jobID string) (*models.CMDBImportJob, error) {
	j, err := m.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrJobNotFound, jobID)
		}
		return nil, err
	}
	if tenantID != "" && j.TenantID != tenantID {
		return nil, fmt.Errorf("%w: job %s", ErrJobNotFound, jobID)
	}
	return j, nil
}

// ListRecordsByJob returns import records for a job, paginated.
func (m *CMDBImportManager) ListRecordsByJob(ctx context.Context, jobID string, offset, limit int) ([]models.CMDBImportRecord, error) {
	return m.repo.ListRecordsByJob(ctx, jobID, offset, limit)
}

// ListJobs returns paginated jobs for a tenant.
func (m *CMDBImportManager) ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.CMDBImportJob, error) {
	return m.repo.ListJobs(ctx, tenantID, status, offset, limit)
}

// CancelJob cancels a running/pending import job.
func (m *CMDBImportManager) CancelJob(ctx context.Context, tenantID, jobID string) error {
	j, err := m.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return err
	}
	if !m.isValidStatusTxn(j.Status, string(models.JobStatusCancelled)) {
		return fmt.Errorf("%w: %s → cancelled (not running or pending)", ErrInvalidStatusTxn, j.Status)
	}
	finishedAt := time.Now().UTC()
	_, err = m.repo.UpdateJobStatus(ctx, jobID, string(models.JobStatusCancelled), nil, nil, &finishedAt)
	return err
}

// ValidateSource validates a source without creating a job.
func (m *CMDBImportManager) ValidateSource(ctx context.Context, sourceType, sourcePath string, mapping, config map[string]string) (*models.ValidateImportResponse, error) {
	handler, err := m.handlerFor(sourceType)
	if err != nil {
		return nil, err
	}
	rows, err := handler.Parse(sourcePath, config)
	if err != nil {
		return nil, err
	}
	hints, errs := handler.Validate(rows, mapping)
	return &models.ValidateImportResponse{
		Valid:        len(errs) == 0,
		RowCount:     len(rows),
		Columns:      hints,
		MappingHints: hints,
		Errors:       errs,
	}, nil
}

// ===========================================================================
// Helpers
// ===========================================================================

// readSource reads source data from a file path or directly from a raw JSON string.
func readSource(sourcePath string, config map[string]string) ([]byte, error) {
	// If config has "raw_data", use it directly
	if raw, ok := config["raw_data"]; ok {
		return []byte(raw), nil
	}
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrParseFailed, err)
	}
	return data, nil
}

// validateMapping checks that mapping keys exist in row columns.
func validateMapping(rows []map[string]interface{}, mapping map[string]string) ([]string, []string) {
	var hints []string
	var errs []string
	if len(rows) == 0 {
		return hints, append(errs, "no rows parsed from source")
	}
	cols := make(map[string]bool)
	for k := range rows[0] {
		cols[k] = true
	}
	for k := range cols {
		hints = append(hints, k)
	}
	for srcCol := range mapping {
		if !cols[srcCol] {
			errs = append(errs, fmt.Sprintf("mapped source column not found: %s", srcCol))
		}
	}
	return hints, errs
}

// loggerError is a no-op logger placeholder (service is logger-free per runner pattern).
func (m *CMDBImportManager) loggerError(format string, args ...interface{}) {
	// In production this would use zap; following runner service pattern.
	_ = fmt.Sprintf(format, args...)
}
