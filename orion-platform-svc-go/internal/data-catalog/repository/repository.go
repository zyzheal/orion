package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/data-catalog/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CRUD ---

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Entry, error) {
	var items []models.Entry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM data_catalog_entries WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Entry, error) {
	var m models.Entry
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM data_catalog_entries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateEntryRequest) (*models.Entry, error) {
	now := time.Now().UTC()
	m := &models.Entry{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		Description:   req.Description,
		DataType:      req.DataType,
		TableName:     req.TableName,
		ColumnName:    req.ColumnName,
		DataFormat:    req.DataFormat,
		SampleValues:  req.SampleValues,
		SchemaVersion: req.SchemaVersion,
		Owner:         req.Owner,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO data_catalog_entries (id, tenant_id, name, description, data_type, table_name, column_name, data_format, sample_values, schema_version, owner, last_updated, created_at)
		 VALUES (:id, :tenant_id, :name, :description, :data_type, :table_name, :column_name, :data_format, :sample_values, :schema_version, :owner, :last_updated, :created_at)`, m)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.UpdateEntryRequest) (*models.Entry, error) {
	updates := make(map[string]any)
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.DataType != "" {
		updates["data_type"] = req.DataType
	}
	if req.TableName != "" {
		updates["table_name"] = req.TableName
	}
	if req.ColumnName != "" {
		updates["column_name"] = req.ColumnName
	}
	if req.DataFormat != "" {
		updates["data_format"] = req.DataFormat
	}
	if req.SampleValues != "" {
		updates["sample_values"] = req.SampleValues
	}
	if req.SchemaVersion != "" {
		updates["schema_version"] = req.SchemaVersion
	}
	if req.Owner != "" {
		updates["owner"] = req.Owner
	}
	updates["last_updated"] = time.Now().UTC()

	if len(updates) <= 1 { // only last_updated
		return r.GetByID(ctx, tenantID, id)
	}

	// Build dynamic SET clause
	setParts := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)+2)
	argIdx := 1
	for k, v := range updates {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE data_catalog_entries SET %s WHERE id=$%d AND tenant_id=$%d`,
		joinCommaSep(setParts), argIdx, argIdx+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM data_catalog_entries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Search implements full-text + filtered search over catalog entries.
func (r *Repository) Search(ctx context.Context, tenantID string, q models.SearchRequest) ([]models.Entry, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.Limit

	args := []any{tenantID}
	conds := []string{"tenant_id=$1"}
	argIdx := 2

	if q.Query != "" {
		conds = append(conds, fmt.Sprintf("name ILIKE $%d", argIdx))
		args = append(args, "%"+q.Query+"%")
		argIdx++
	}
	if q.DataType != "" {
		conds = append(conds, fmt.Sprintf("data_type=$%d", argIdx))
		args = append(args, q.DataType)
		argIdx++
	}
	if q.TableName != "" {
		conds = append(conds, fmt.Sprintf("table_name ILIKE $%d", argIdx))
		args = append(args, "%"+q.TableName+"%")
		argIdx++
	}
	if q.Owner != "" {
		conds = append(conds, fmt.Sprintf("owner=$%d", argIdx))
		args = append(args, q.Owner)
		argIdx++
	}
	if q.SchemaVer != "" {
		conds = append(conds, fmt.Sprintf("schema_version=$%d", argIdx))
		_ = argIdx // placeholder
		args = append(args, q.SchemaVer)
		argIdx++
	}

	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	query := fmt.Sprintf("SELECT * FROM data_catalog_entries WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1)
	args = append(args, q.Limit, offset)

	var items []models.Entry
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// Count returns the total number of catalog entries for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM data_catalog_entries WHERE tenant_id=$1`, tenantID)
	return total, err
}

// GetByTable returns all entries matching a table name (for table-level browsing).
func (r *Repository) GetByTable(ctx context.Context, tenantID, tableName string) ([]models.Entry, error) {
	var items []models.Entry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM data_catalog_entries WHERE tenant_id=$1 AND table_name=$2 ORDER BY column_name`, tenantID, tableName)
	return items, err
}

// uniqueID ensures idempotent migration-friendly unique constraint enforcement.
func uniqueID() string {
	return uuid.New().String()
}

func joinCommaSep(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}

// CreateOrUpdateCatalogEntry upserts a discovered table into the catalog.
// It creates a table-level entry and one entry per column, returning counts of new vs updated entries.
func (r *Repository) CreateOrUpdateCatalogEntry(ctx context.Context, tenantID string, databaseName string, schema *models.DiscoveredSchema) (int, int, error) {
	newCount, updatedCount := 0, 0

	// Upsert the table-level entry (no column_name).
	tableEntry := &models.Entry{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         schema.TableName,
		Description:  "Discovered table",
		DataType:     "table",
		TableName:    schema.TableName,
		ColumnName:   "",
		DatabaseName: databaseName,
		UpdatedAt:    time.Now().UTC(),
		CreatedAt:    time.Now().UTC(),
	}

	// Check if table entry already exists for this database.
	var existingID string
	err := r.db.GetContext(ctx, &existingID,
		`SELECT id FROM data_catalog_entries WHERE tenant_id=$1 AND table_name=$2 AND data_type=$3 AND database_name=$4 AND column_name=''`,
		tenantID, schema.TableName, "table", databaseName)

	if err == nil {
		// Exists — update timestamp.
		_, err = r.db.ExecContext(ctx,
			`UPDATE data_catalog_entries SET last_updated=$1 WHERE id=$2`,
			time.Now().UTC(), existingID)
		if err != nil {
			return newCount, updatedCount, err
		}
		updatedCount++
	} else {
		// Does not exist — create.
		_, err = r.db.NamedExecContext(ctx,
			`INSERT INTO data_catalog_entries (id, tenant_id, name, description, data_type, table_name, column_name, data_format, sample_values, schema_version, owner, database_name, last_updated, created_at)
			 VALUES (:id, :tenant_id, :name, :description, :data_type, :table_name, :column_name, :data_format, :sample_values, :schema_version, :owner, :database_name, :last_updated, :created_at)`,
			tableEntry)
		if err != nil {
			return newCount, updatedCount, err
		}
		newCount++
	}

	// Upsert column-level entries.
	for _, col := range schema.Columns {
		columnName := col.Name
		if columnName == "" {
			continue
		}
		var colEntryID string
		err = r.db.GetContext(ctx, &colEntryID,
			`SELECT id FROM data_catalog_entries WHERE tenant_id=$1 AND table_name=$2 AND column_name=$3 AND database_name=$4`,
			tenantID, schema.TableName, columnName, databaseName)

		if err == nil {
			_, err = r.db.ExecContext(ctx,
				`UPDATE data_catalog_entries SET data_type=$1, last_updated=$2 WHERE id=$3`,
				col.DataType, time.Now().UTC(), colEntryID)
			if err != nil {
				return newCount, updatedCount, err
			}
			updatedCount++
		} else {
			now := time.Now().UTC()
			_, err = r.db.ExecContext(ctx,
				`INSERT INTO data_catalog_entries (id, tenant_id, name, description, data_type, table_name, column_name, database_name, last_updated, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				uuid.New().String(), tenantID,
				col.DataType, fmt.Sprintf("Column %s in table %s", columnName, schema.TableName),
				col.DataType, schema.TableName, columnName, databaseName, now, now)
			if err != nil {
				return newCount, updatedCount, err
			}
			newCount++
		}
	}

	return newCount, updatedCount, nil
}
