package service

import (
	"context"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/repository"
)

type Service struct {
	mu      sync.RWMutex
	editors map[string]*roweditor.RowEditor
	repo    *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{editors: make(map[string]*roweditor.RowEditor), repo: repo}
}

func (s *Service) RegisterEditor(ctx context.Context, name string, req *models.RowEditorSpecRequest) error {
	cols := make([]roweditor.ColumnSpec, 0, len(req.Columns))
	for _, c := range req.Columns {
		cols = append(cols, roweditor.ColumnSpec{
			Name:     c.Name,
			ReadOnly: c.ReadOnly,
			Type:     "string",
		})
	}
	spec := roweditor.RowSpec{
		TableName:     req.TableName,
		PrimaryKey:    req.PrimaryKey,
		Columns:       cols,
		VersionColumn: req.VersionColumn,
	}
	editor, err := roweditor.NewRowEditor(spec)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.editors[name] = editor
	s.mu.Unlock()
	if s.repo != nil {
		return s.repo.Save(ctx, name, spec)
	}
	return nil
}

func (s *Service) GetEditor(name string) (*roweditor.RowEditor, error) {
	s.mu.RLock()
	ed, ok := s.editors[name]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("roweditor: editor %q not registered", name)
	}
	return ed, nil
}

func (s *Service) CreateRow(ctx context.Context, editorName string, db roweditor.DBOperations, req *models.RowCreateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	row := roweditor.Row(req.Row)
	created, err := ed.Create(ctx, db, req.TenantID, row)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: 1, NewRow: *created}, nil
}

func (s *Service) ReadRow(ctx context.Context, editorName string, db roweditor.DBOperations, tenantID, rowID string) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	row, err := ed.Read(ctx, db, tenantID, rowID)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: 1, NewRow: *row}, nil
}

func (s *Service) UpdateRow(ctx context.Context, editorName string, db roweditor.DBOperations, req *models.RowUpdateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{TenantID: req.RowID[:8], Version: req.Version}
	change := roweditor.RowChange{RowID: req.RowID, Columns: req.Changes}
	result, err := ed.Update(ctx, db, opts, change)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: result.Changed}, nil
}

func (s *Service) DeleteRow(ctx context.Context, editorName string, db roweditor.DBOperations, tenantID, rowID string) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{TenantID: tenantID}
	result, err := ed.Delete(ctx, db, opts, rowID, false)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: result.Changed}, nil
}

func (s *Service) BatchCreate(ctx context.Context, editorName string, db roweditor.DBOperations, req *models.BatchCreateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	rows := make([]roweditor.Row, 0, len(req.Rows))
	for _, r := range req.Rows {
		rows = append(rows, roweditor.Row(r))
	}
	count, err := ed.BatchCreate(ctx, db, req.TenantID, rows)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: count}, nil
}

func (s *Service) BatchUpdate(ctx context.Context, editorName string, db roweditor.DBOperations, req *models.BatchUpdateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{Version: req.Version}
	change := roweditor.BatchChange{RowIDs: req.RowIDs, Columns: req.Changes}
	results, err := ed.BatchUpdate(ctx, db, opts, change)
	if err != nil {
		return nil, err
	}
	total := 0
	for _, r := range results {
		total += r.Changed
	}
	return &models.RowEditorResponse{Affected: total}, nil
}

func (s *Service) Stats(ctx context.Context, editorName string) (*models.RowEditorStats, error) {
	ed, err := s.GetEditor(editorName)
	if err != nil {
		return nil, err
	}
	spec := ed.Spec()
	ro := make([]string, 0)
	for _, c := range spec.Columns {
		if c.ReadOnly {
			ro = append(ro, c.Name)
		}
	}
	return &models.RowEditorStats{
		TableName:  spec.TableName,
		PrimaryKey: spec.PrimaryKey,
		Columns:    len(spec.Columns),
		ReadOnly:   ro,
	}, nil
}
