package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/schema-registry/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Postgres is a durable implementation of Interface backed by Postgres.
// It is drop-in compatible with InMemory — the only difference is that state
// survives process restarts.
type Postgres struct {
	db *sqlx.DB
}

// NewPostgres returns a Postgres repository. Callers should pass the same
// *sqlx.DB instance used by the rest of the platform so migrations and
// transactions share the connection pool.
func NewPostgres(db *sqlx.DB) *Postgres {
	return &Postgres{db: db}
}

// Compile-time check: Postgres must satisfy the repository.Interface.
var _ Interface = (*Postgres)(nil)

// columns is the canonical SELECT list. sqlx normalises column names by
// stripping underscores and lowercasing; the aliases below match the
// struct field names in row / rowVersion.
const columns = `
	id            AS id,
	tenant_id     AS tenantid,
	namespace     AS namespace,
	name          AS name,
	type          AS type,
	version       AS version,
	status        AS status,
	owner         AS owner,
	description   AS description,
	fields        AS fieldsraw,
	relationships AS relationshipsraw,
	indexes       AS indexesraw,
	compatibility AS compatibility,
	metadata      AS metadatraw,
	created_at    AS createdat,
	updated_at    AS updatedat`

const versionColumns = `
	id           AS id,
	tenant_id    AS tenantid,
	namespace    AS namespace,
	name         AS name,
	version      AS version,
	schema_json  AS schemaraw,
	changes      AS changesraw,
	released_at  AS releasedat,
	released_by  AS releasedby,
	created_at   AS createdat`

// row is the scan shape for schema_registry. JSONB columns come back as
// []byte and are decoded after the scan.
type row struct {
	ID            string
	TenantID      string
	Namespace     string
	Name          string
	Type          string
	Version       int
	Status        string
	Owner         string
	Description   string
	FieldsRaw     []byte
	RelationshipsRaw *[]byte
	IndexesRaw    *[]byte
	Compatibility string
	MetadataRaw   *[]byte
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// rowVersion is the scan shape for schema_registry_versions.
type rowVersion struct {
	ID         string
	TenantID   string
	Namespace  string
	Name       string
	Version    int
	SchemaRaw  *[]byte
	ChangesRaw *[]byte
	ReleasedAt time.Time
	ReleasedBy string
	CreatedAt  time.Time
}

func (r *Postgres) CreateSchema(ctx context.Context, s *models.Schema) error {
	if s == nil {
		return errors.New("schema is nil")
	}
	now := time.Now().UTC()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = now
	}
	if s.UpdatedAt.IsZero() {
		s.UpdatedAt = now
	}
	if s.Compatibility == "" {
		s.Compatibility = models.CompatibilityBackward
	}
	fields := marshalOr(s.Fields, []models.SchemaField{})
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO schema_registry
			(id, tenant_id, namespace, name, type, version, status, owner, description,
			 fields, relationships, indexes, compatibility, metadata, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		s.ID, defaultStr(s.TenantID, "default"), s.Namespace, s.Name, string(s.Type),
		s.Version, string(s.Status), s.Owner, nillable(s.Description),
		string(fields), nillableJSON(s.Relationships), nillableJSON(s.Indexes),
		string(s.Compatibility), nillableJSON(s.Metadata), s.CreatedAt, s.UpdatedAt)
	if err != nil {
		// unique violation on id => duplicate create
		if isUniqueViolation(err) {
			return fmt.Errorf("schema already exists: %s", s.ID)
		}
		return err
	}
	return nil
}

func (r *Postgres) GetSchema(ctx context.Context, namespace, name string) (*models.Schema, error) {
	var row row
	err := r.db.GetContext(ctx, &row, `SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`, namespace, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return decodeSchema(&row), nil
}

func (r *Postgres) ListSchemas(ctx context.Context, namespace string) ([]*models.Schema, error) {
	var rows []row
	var err error
	if namespace == "" {
		err = r.db.SelectContext(ctx, &rows, `SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' ORDER BY created_at DESC`)
	} else {
		err = r.db.SelectContext(ctx, &rows, `SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 ORDER BY created_at DESC`, namespace)
	}
	if err != nil {
		return nil, err
	}
	out := make([]*models.Schema, 0, len(rows))
	for i := range rows {
		out = append(out, decodeSchema(&rows[i]))
	}
	return out, nil
}

func (r *Postgres) QuerySchemas(ctx context.Context, q *models.QueryRequest) ([]*models.Schema, int, error) {
	if q == nil {
		q = &models.QueryRequest{}
	}
	// Build the WHERE clause incrementally, numbering Postgres placeholders.
	where := []string{"tenant_id = 'default'"}
	args := []interface{}{}
	addCond := func(cond string, val interface{}) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if q.Namespace != "" {
		addCond("namespace = $%d", q.Namespace)
	}
	if q.Type != "" {
		addCond("type = $%d", string(q.Type))
	}
	if q.Status != "" {
		addCond("status = $%d", string(q.Status))
	}
	if q.Owner != "" {
		addCond("owner = $%d", q.Owner)
	}
	whereStr := where[0]
	for i := 1; i < len(where); i++ {
		whereStr += " AND " + where[i]
	}
	query := `SELECT ` + columns + ` FROM schema_registry WHERE ` + whereStr + ` ORDER BY created_at DESC`

	var rows []row
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, 0, err
	}
	out := make([]*models.Schema, 0, len(rows))
	for i := range rows {
		out = append(out, decodeSchema(&rows[i]))
	}
	return out, len(out), nil
}

func (r *Postgres) UpdateSchema(ctx context.Context, s *models.Schema) error {
	if s == nil {
		return errors.New("schema is nil")
	}
	s.UpdatedAt = time.Now().UTC()
	res, err := r.db.ExecContext(ctx, `
		UPDATE schema_registry SET
		 type=$2, version=$3, status=$4, owner=$5, description=$6,
		 fields=$7, relationships=$8, indexes=$9, compatibility=$10, metadata=$11, updated_at=$12
		 WHERE id = $1`,
		s.ID, string(s.Type), s.Version, string(s.Status), s.Owner,
		nillable(s.Description), string(marshalOr(s.Fields, []models.SchemaField{})),
		nillableJSON(s.Relationships), nillableJSON(s.Indexes),
		string(s.Compatibility), nillableJSON(s.Metadata), s.UpdatedAt)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("schema not found: %s", s.ID)
	}
	return nil
}

func (r *Postgres) DeleteSchema(ctx context.Context, namespace, name string) error {
	id := key(namespace, name)
	res, err := r.db.ExecContext(ctx, `DELETE FROM schema_registry_versions WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`, namespace, name)
	if err != nil {
		return err
	}
	res, err = r.db.ExecContext(ctx, `DELETE FROM schema_registry WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrSchemaNotFound
	}
	return nil
}

func (r *Postgres) GetLatestVersion(ctx context.Context, namespace, name string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version, `SELECT version FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`, namespace, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrSchemaNotFound
		}
		return 0, err
	}
	return version, nil
}

func (r *Postgres) AppendVersion(ctx context.Context, namespace, name string, v *models.SchemaVersion) error {
	if v == nil {
		return errors.New("version is nil")
	}
	now := time.Now().UTC()
	if v.ReleasedAt.IsZero() {
		v.ReleasedAt = now
	}
	releasedAt := v.ReleasedAt
	// Snapshot the full schema at this version for later lookup. SchemaVersion
	// has no ID field; a fresh UUID is generated per append.
	var schemaRaw *[]byte
	if s, err := r.GetSchema(ctx, namespace, name); err == nil && s != nil {
		b, _ := json.Marshal(s)
		schemaRaw = &b
	}
	var changesRaw *[]byte
	if v.Changes != nil {
		b, _ := json.Marshal(v.Changes)
		changesRaw = &b
	}
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO schema_registry_versions
			(id, tenant_id, namespace, name, version, schema_json, changes, released_at, released_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		id, "default", namespace, name, v.Version,
		schemaRaw, changesRaw, releasedAt, v.ReleasedBy, now)
	if err != nil {
		if isUniqueViolation(err) {
			// Version already exists — update in place.
			_, _ = r.db.ExecContext(ctx, `
				UPDATE schema_registry_versions
				 SET schema_json=$1, changes=$2, released_at=$3, released_by=$4
				 WHERE tenant_id = 'default' AND namespace = $5 AND name = $6 AND version = $7`,
				schemaRaw, changesRaw, releasedAt, v.ReleasedBy, namespace, name, v.Version)
			return nil
		}
		return err
	}
	return nil
}

func (r *Postgres) GetVersionHistory(ctx context.Context, namespace, name string, limit int) ([]*models.SchemaVersion, error) {
	query := `SELECT ` + versionColumns + ` FROM schema_registry_versions
		WHERE tenant_id = 'default' AND namespace = $1 AND name = $2
		ORDER BY version DESC`
	args := []interface{}{namespace, name}
	if limit > 0 {
		query += ` LIMIT $3`
		args = append(args, limit)
	}
	var rows []rowVersion
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	out := make([]*models.SchemaVersion, 0, len(rows))
	for i := range rows {
		out = append(out, decodeVersion(&rows[i]))
	}
	return out, nil
}

func (r *Postgres) GetVersion(ctx context.Context, namespace, name string, version int) (*models.SchemaVersion, error) {
	var row rowVersion
	err := r.db.GetContext(ctx, &row, `SELECT `+versionColumns+` FROM schema_registry_versions
		WHERE tenant_id = 'default' AND namespace = $1 AND name = $2 AND version = $3`, namespace, name, version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrSchemaNotFound
		}
		return nil, err
	}
	return decodeVersion(&row), nil
}

func (r *Postgres) GetCompatibility(ctx context.Context, namespace, name string) (models.CompatibilityMode, error) {
	var mode string
	err := r.db.GetContext(ctx, &mode, `SELECT compatibility FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`, namespace, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrSchemaNotFound
		}
		return "", err
	}
	return models.CompatibilityMode(mode), nil
}

// --- helpers ---

func decodeSchema(r *row) *models.Schema {
	s := &models.Schema{
		ID:            r.ID,
		TenantID:      r.TenantID,
		Name:          r.Name,
		Namespace:     r.Namespace,
		Type:          models.SchemaType(r.Type),
		Version:       r.Version,
		Status:        models.SchemaStatus(r.Status),
		Owner:         r.Owner,
		Description:   r.Description,
		Compatibility: models.CompatibilityMode(r.Compatibility),
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
	if r.FieldsRaw != nil {
		_ = json.Unmarshal(r.FieldsRaw, &s.Fields)
	}
	if r.RelationshipsRaw != nil {
		_ = json.Unmarshal(*r.RelationshipsRaw, &s.Relationships)
	}
	if r.IndexesRaw != nil {
		_ = json.Unmarshal(*r.IndexesRaw, &s.Indexes)
	}
	if r.MetadataRaw != nil {
		m := map[string]interface{}{}
		if json.Unmarshal(*r.MetadataRaw, &m) == nil {
			s.Metadata = m
		}
	}
	return s
}

func decodeVersion(r *rowVersion) *models.SchemaVersion {
	v := &models.SchemaVersion{
		Version:    r.Version,
		ReleasedAt: r.ReleasedAt,
		ReleasedBy: r.ReleasedBy,
	}
	if r.SchemaRaw != nil {
		v.JSON = json.RawMessage(*r.SchemaRaw)
	}
	if r.ChangesRaw != nil {
		_ = json.Unmarshal(*r.ChangesRaw, &v.Changes)
	}
	return v
}

func marshalOr[T any](v T, fallback T) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		b, _ = json.Marshal(fallback)
	}
	return b
}

func nillable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nillableJSON(v interface{}) *[]byte {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	// Empty slice/map should be NULL rather than [] / {} to keep the DB clean.
	if string(b) == "null" || string(b) == "[]" || string(b) == "{}" {
		return nil
	}
	return &b
}

func defaultStr(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

// isUniqueViolation reports whether the error represents a Postgres unique
// constraint violation (code 23505). Used to distinguish "already exists"
// from other failures without depending on a specific driver.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return contains(s, "duplicate key") || contains(s, "23505") || contains(s, "unique_violation")
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
