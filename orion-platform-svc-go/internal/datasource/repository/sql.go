package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/datasource/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// columns is the canonical SELECT list. Every column is aliased to the field
// name sqlx normalises to (lowercase, underscores stripped): the table stores
// source_type / database_name / tenant_id but the model exposes Type /
// Database / TenantID, so a bare SELECT * would leave those fields empty.
const columns = `
	id            AS id,
	tenant_id     AS tenantid,
	name          AS name,
	source_type   AS type,
	host          AS host,
	port          AS port,
	database_name AS database,
	username      AS username,
	password_enc  AS passwordenc,
	ssl_mode      AS sslmode,
	auth_source   AS authsource,
	max_open_conns    AS maxopenconns,
	max_idle_conns    AS maxidleconns,
	conn_max_lifetime AS connmaxlifetime,
	status        AS status,
	last_checked  AS lastchecked,
	error         AS error,
	tags          AS tagsraw,
	created_at    AS createdat,
	updated_at    AS updatedat`

// dsWithTags is the scan shape: DataSource.Tags is a map and cannot be filled
// straight from a text column, so tags come in as raw JSON and are decoded after
// the scan. The embedded DataSource flattens into the same field names sqlx
// normalises, and no column is aliased to "tags", so the map field is never
// touched by the scanner.
type dsWithTags struct {
	models.DataSource
	TagsRaw *string `json:"-"`
}

func toDS(row *dsWithTags) *models.DataSource {
	row.Tags = decodeTags(row.TagsRaw)
	return &row.DataSource
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, ds *models.DataSource) error {
	now := time.Now().UTC()
	if ds.ID == "" {
		ds.ID = uuid.New().String()
	}
	ds.CreatedAt = now
	ds.UpdatedAt = now
	if ds.Status == "" {
		ds.Status = models.DSStatusActive
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO data_sources (id, tenant_id, name, source_type, host, port, database_name,
			username, password_enc, ssl_mode, auth_source, max_open_conns, max_idle_conns,
			conn_max_lifetime, status, error, tags, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
		ds.ID, ds.TenantID, ds.Name, ds.Type, ds.Host, ds.Port, ds.Database,
		ds.Username, ds.PasswordEnc, ds.SSLMode, ds.AuthSource, ds.MaxOpenConns, ds.MaxIdleConns,
		ds.ConnMaxLifetime, ds.Status, nillable(ds.Error), encodeTags(ds.Tags), now, now)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string) (*models.DataSource, error) {
	var row dsWithTags
	err := r.db.GetContext(ctx, &row, `SELECT `+columns+` FROM data_sources WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return toDS(&row), nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]*models.DataSource, error) {
	var rows []*dsWithTags
	err := r.db.SelectContext(ctx, &rows, `SELECT `+columns+` FROM data_sources WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	list := make([]*models.DataSource, 0, len(rows))
	for _, row := range rows {
		list = append(list, toDS(row))
	}
	return list, nil
}

func (r *Repository) Update(ctx context.Context, ds *models.DataSource) error {
	ds.UpdatedAt = time.Now().UTC()
	res, err := r.db.ExecContext(ctx, `
		UPDATE data_sources SET name = $2, source_type = $3, host = $4, port = $5,
			database_name = $6, username = $7, password_enc = $8, ssl_mode = $9, auth_source = $10,
			max_open_conns = $11, max_idle_conns = $12, conn_max_lifetime = $13, status = $14,
			error = $15, tags = $16, updated_at = $17 WHERE id = $1`,
		ds.ID, ds.Name, ds.Type, ds.Host, ds.Port,
		ds.Database, ds.Username, ds.PasswordEnc, ds.SSLMode, ds.AuthSource,
		ds.MaxOpenConns, ds.MaxIdleConns, ds.ConnMaxLifetime, ds.Status,
		nillable(ds.Error), encodeTags(ds.Tags), ds.UpdatedAt)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM data_sources WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// nillable returns nil for the empty string so error is stored as SQL NULL
// rather than an empty text value.
func nillable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func encodeTags(tags map[string]string) any {
	if len(tags) == 0 {
		return nil
	}
	b, err := json.Marshal(tags)
	if err != nil {
		return nil
	}
	return string(b)
}

func decodeTags(raw *string) map[string]string {
	if raw == nil || *raw == "" {
		return nil
	}
	tags := map[string]string{}
	if err := json.Unmarshal([]byte(*raw), &tags); err != nil {
		return nil
	}
	return tags
}
