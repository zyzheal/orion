package service

import (
	"context"
	"sync"

	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/repository"
)

// keySep separates the tenant from the editor name in the cache key. The two
// halves are user-controlled strings, so the separator must be one that neither
// can contain in any way that collides: tenant ids come from the JWT and names
// from the query string, and a plain "." would let tenant "a" name "b" collide
// with tenant "a.b" name "".
const keySep = "\x00"

func editorKey(tenantID, name string) string {
	return tenantID + keySep + name
}

type Service struct {
	mu sync.RWMutex
	// editors is keyed by tenant + name, not by name. The editor map holds the
	// table a tenant is allowed to write, so a bare name let tenant B register
	// "users" and silently take over tenant A's editor for the lifetime of the
	// process.
	editors map[string]*roweditor.RowEditor
	repo    *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{editors: make(map[string]*roweditor.RowEditor), repo: repo}
}

// RegisterEditor builds a RowEditor from the request, caches it for this tenant,
// and persists it. is_required and soft_delete are carried onto the spec so they
// survive a restart instead of being dropped at the service boundary.
func (s *Service) RegisterEditor(ctx context.Context, tenantID, name string, req *models.RowEditorSpecRequest) error {
	cols := make([]roweditor.ColumnSpec, 0, len(req.Columns))
	for _, c := range req.Columns {
		col := roweditor.ColumnSpec{
			Name:     c.Name,
			ReadOnly: c.ReadOnly,
			Type:     "string",
		}
		if c.IsRequired {
			// Required is what survives the persistence round trip; Validate is
			// re-derived from it. Without Required the flag was applied in memory
			// and then lost the moment the spec was loaded back.
			col.Required = true
		}
		cols = append(cols, col)
	}
	spec := roweditor.RowSpec{
		TableName:     req.TableName,
		PrimaryKey:    req.PrimaryKey,
		Columns:       cols,
		VersionColumn: req.VersionColumn,
		SoftDelete:    req.SoftDelete,
	}
	// Derive the validators from Required before the spec is cached, so the
	// in-memory editor enforces the same rules as one loaded from the database.
	spec.AttachRequiredValidators()
	editor, err := roweditor.NewRowEditor(spec)
	if err != nil {
		return err
	}
	if s.repo != nil {
		if err := s.repo.Save(ctx, tenantID, name, spec); err != nil {
			return err
		}
	}
	s.mu.Lock()
	s.editors[editorKey(tenantID, name)] = editor
	s.mu.Unlock()
	return nil
}

// GetEditor looks up the editor for the caller's tenant, loading it from the
// repository when it is not yet cached. Without the load path the persistence
// side of RegisterEditor was write-only: editors registered before a restart
// vanished, and so did every tenant that had not called /register this process.
func (s *Service) GetEditor(ctx context.Context, tenantID, name string) (*roweditor.RowEditor, error) {
	key := editorKey(tenantID, name)
	s.mu.RLock()
	ed, ok := s.editors[key]
	s.mu.RUnlock()
	if ok {
		return ed, nil
	}
	if s.repo == nil {
		return nil, roweditor.ErrEditorNotFound
	}
	spec, err := s.repo.Get(ctx, tenantID, name)
	if err != nil {
		return nil, err
	}
	if spec == nil {
		return nil, roweditor.ErrEditorNotFound
	}
	// Validate is excluded from the spec's JSON form, so a decoded spec has no
	// validators at all until this runs. A required column would otherwise be
	// writable with an empty value after a restart.
	spec.AttachRequiredValidators()
	loaded, err := roweditor.NewRowEditor(*spec)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.editors[key] = loaded
	s.mu.Unlock()
	return loaded, nil
}

func (s *Service) CreateRow(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, req *models.RowCreateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	created, err := ed.Create(ctx, db, tenantID, roweditor.Row(req.Row))
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: 1, NewRow: *created}, nil
}

func (s *Service) ReadRow(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, rowID string) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	found, err := ed.Read(ctx, db, tenantID, rowID)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: 1, NewRow: *found}, nil
}

func (s *Service) UpdateRow(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, req *models.RowUpdateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{TenantID: tenantID, Version: req.Version}
	change := roweditor.RowChange{RowID: req.RowID, Columns: req.Changes}
	result, err := ed.Update(ctx, db, opts, change)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: result.Changed}, nil
}

func (s *Service) DeleteRow(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, rowID string) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{TenantID: tenantID}
	// softDelete comes from the registered spec, not from the request body: the
	// delete route takes the row id from the path and has no body at all, so a
	// hardcoded false made every soft-delete editor perform hard deletes.
	result, err := ed.Delete(ctx, db, opts, rowID, ed.Spec().SoftDelete)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: result.Changed}, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, req *models.BatchCreateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	rows := make([]roweditor.Row, 0, len(req.Rows))
	for _, r := range req.Rows {
		rows = append(rows, roweditor.Row(r))
	}
	count, err := ed.BatchCreate(ctx, db, tenantID, rows)
	if err != nil {
		return nil, err
	}
	return &models.RowEditorResponse{Affected: count}, nil
}

func (s *Service) BatchUpdate(ctx context.Context, tenantID, editorName string, db roweditor.DBOperations, req *models.BatchUpdateRequest) (*models.RowEditorResponse, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
	if err != nil {
		return nil, err
	}
	opts := roweditor.EditOptions{TenantID: tenantID, Version: req.Version}
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

func (s *Service) Stats(ctx context.Context, tenantID, editorName string) (*models.RowEditorStats, error) {
	ed, err := s.GetEditor(ctx, tenantID, editorName)
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
