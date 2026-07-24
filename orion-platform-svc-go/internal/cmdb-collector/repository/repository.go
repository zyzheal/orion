// Package repository provides PostgreSQL-backed data access for CMDB collector
// entities: Targets, Devices, and Collections.
//
// Follows the platform's established sqlx.DB pattern (see runner/repository,
// inception/repository).  All queries honour tenant_id for multi-tenancy
// isolation.
//
// Tables:
//   cmdb_targets      — remote endpoints to discover / collect from
//   cmdb_devices      — discovered or registered CMDB assets
//   cmdb_collections  — time-stamped attribute snapshots
//
// Rollback migration: 254_create_cmdb_collector_tables_down.sql
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound    = sql.ErrNoRows
	ErrDuplicate   = errors.New("duplicate key")
	ErrNotUnique   = errors.New("duplicate entry")
)

// Repository is the data access layer for cmdb_targets, cmdb_devices and
// cmdb_collections.
type Repository struct {
	db *sqlx.DB
}

// NewRepository returns a new Repository bound to the given PG pool.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Target CRUD
// ===========================================================================

// CreateTarget inserts a new target.  Generates a UUID for id.
func (r *Repository) CreateTarget(ctx context.Context, t *models.Target) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_targets
			(id, name, host, port, "type", protocol, tenant_id, config, metadata, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		t.ID, t.Name, t.Host, t.Port, t.TargetType, t.Protocol,
		t.TenantID, t.Config, t.Metadata, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetTarget returns the target with the given id.
func (r *Repository) GetTarget(ctx context.Context, id string) (*models.Target, error) {
	var t models.Target
	err := r.db.GetContext(ctx, &t,
		`SELECT id, name, host, port, "type", protocol, tenant_id, config,
		        metadata, created_at, updated_at
		 FROM cmdb_targets
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTargets returns paginated targets, optionally filtered by tenant and
// target type.
func (r *Repository) ListTargets(ctx context.Context, tenantID, targetType string, offset, limit int) ([]models.Target, error) {
	var items []models.Target
	var err error

	if tenantID != "" && targetType != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, name, host, port, "type", protocol, tenant_id, config,
			        metadata, created_at, updated_at
			 FROM cmdb_targets
			 WHERE tenant_id = $1 AND "type" = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, targetType, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, name, host, port, "type", protocol, tenant_id, config,
			        metadata, created_at, updated_at
			 FROM cmdb_targets
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, name, host, port, "type", protocol, tenant_id, config,
			        metadata, created_at, updated_at
			 FROM cmdb_targets
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	if err != nil {
		return nil, err
	}
	return items, nil
}

// DeleteTarget soft-deletes a target by setting updated_at as tombstone.  For
// backward compatibility with the platform pattern this method marks the target
// as deleted by deleting the row (hard delete); a soft-delete can be added
// later if needed.
func (r *Repository) DeleteTarget(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM cmdb_targets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ===========================================================================
// Device CRUD
// ===========================================================================

// CreateDevice inserts a new device.  Generates UUID for id.
func (r *Repository) CreateDevice(ctx context.Context, d *models.Device) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now
	d.LastSeenAt = &now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_devices
			(id, device_id, name, "type", vendor, model, ip, serial_number,
			 tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata,
			 created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
		d.ID, d.DeviceID, d.Name, d.DeviceType, d.Vendor, d.Model, d.IP,
		d.SerialNumber, d.TenantID, d.TargetID, d.Adapter, d.LastSeenAt,
		d.Attributes, d.Status, d.Metadata, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

// UpsertDevice inserts a device if new, or updates it if device_id already
// exists for the same tenant.  This is the upsert used by Discover() to keep
// the device registry in sync with the latest sweep.
func (r *Repository) UpsertDevice(ctx context.Context, d *models.Device) error {
	now := time.Now().UTC()
	d.LastSeenAt = &now
	d.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_devices
			(id, device_id, name, "type", vendor, model, ip, serial_number,
			 tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata,
			 created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		 ON CONFLICT (device_id, tenant_id)
		 DO UPDATE SET
			name = EXCLUDED.name, "type" = EXCLUDED."type",
			vendor = EXCLUDED.vendor, model = EXCLUDED.model, ip = EXCLUDED.ip,
			serial_number = EXCLUDED.serial_number, target_id = EXCLUDED.target_id,
			adapter = EXCLUDED.adapter, last_seen_at = EXCLUDED.last_seen_at,
			attributes = EXCLUDED.attributes, status = EXCLUDED.status,
			metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at`,
		d.ID, d.DeviceID, d.Name, d.DeviceType, d.Vendor, d.Model, d.IP,
		d.SerialNumber, d.TenantID, d.TargetID, d.Adapter, d.LastSeenAt,
		d.Attributes, d.Status, d.Metadata, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

// GetDevice returns the device with the given id.
func (r *Repository) GetDevice(ctx context.Context, id string) (*models.Device, error) {
	var d models.Device
	err := r.db.GetContext(ctx, &d,
		`SELECT id, device_id, name, "type", vendor, model, ip, serial_number,
		        tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata,
		        created_at, updated_at
		 FROM cmdb_devices
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// GetDeviceByDeviceID returns a device by its stable device_id within a tenant.
func (r *Repository) GetDeviceByDeviceID(ctx context.Context, tenantID, deviceID string) (*models.Device, error) {
	var d models.Device
	err := r.db.GetContext(ctx, &d,
		`SELECT id, device_id, name, "type", vendor, model, ip, serial_number,
		        tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata,
		        created_at, updated_at
		 FROM cmdb_devices
		 WHERE device_id = $1 AND tenant_id = $2`,
		deviceID, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListDevices returns paginated devices, optionally filtered by tenant and
// device type.
func (r *Repository) ListDevices(ctx context.Context, tenantID, deviceType, vendor string, offset, limit int) ([]models.Device, error) {
	var items []models.Device
	var err error

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argOffset := 2 // $1 is tenantID; first variable arg is $2

	switch {
	case deviceType != "" && vendor != "":
		where += " AND \"type\" = $" + fmt.Sprintf("%d", argOffset) + " AND vendor = $" + fmt.Sprintf("%d", argOffset+1)
		args = append(args, deviceType, vendor)
	case deviceType != "":
		where += " AND \"type\" = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, deviceType)
	case vendor != "":
		where += " AND vendor = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, vendor)
	}
	offsetArg := fmt.Sprintf("$%d", len(args)+1)
	limitArg := fmt.Sprintf("$%d", len(args)+2)
	args = append(args, offset, limit)

	query := `SELECT id, device_id, name, "type", vendor, model, ip, serial_number,
		        tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata,
		        created_at, updated_at
		 FROM cmdb_devices ` + where + ` ORDER BY last_seen_at DESC OFFSET ` + offsetArg + ` LIMIT ` + limitArg

	err = r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// DeleteDevice removes a device.
func (r *Repository) DeleteDevice(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM cmdb_devices WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ===========================================================================
// Collection CRUD
// ===========================================================================

// CreateCollection inserts a collection result.  Generates UUIDs for id and
// collection_id.
func (r *Repository) CreateCollection(ctx context.Context, c *models.Collection) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	if c.CollectionID == "" {
		c.CollectionID = uuid.New().String()
	}
	c.CreatedAt = time.Now().UTC()

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_collections
			(id, collection_id, collector, device_id, target_id, tenant_id, phase, status,
			 attribute_count, attributes, error, duration_ms, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		c.ID, c.CollectionID, c.Collector, c.DeviceID, c.TargetID,
		c.TenantID, c.Phase, c.Status, c.AttributeCount, c.Attributes,
		c.Error, c.DurationMs, c.CreatedAt,
	)
	return err
}

// GetCollection returns the collection with the given collection_id.
func (r *Repository) GetCollection(ctx context.Context, collectionID string) (*models.Collection, error) {
	var c models.Collection
	err := r.db.GetContext(ctx, &c,
		`SELECT id, collection_id, collector, device_id, target_id, tenant_id, phase,
		        status, attribute_count, attributes, error, duration_ms, created_at
		 FROM cmdb_collections
		 WHERE collection_id = $1`,
		collectionID,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ListCollections returns recent collections, filtered by tenant and
// optionally collector / device / status.
func (r *Repository) ListCollections(ctx context.Context, tenantID, collector, deviceID, status string, offset, limit int) ([]models.Collection, error) {
	var items []models.Collection
	var err error

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argOffset := 2

	switch {
	case collector != "" && deviceID != "" && status != "":
		where += " AND collector = $" + fmt.Sprintf("%d", argOffset) + " AND device_id = $" + fmt.Sprintf("%d", argOffset+1) + " AND status = $" + fmt.Sprintf("%d", argOffset+2)
		args = append(args, collector, deviceID, status)
	case collector != "" && deviceID != "":
		where += " AND collector = $" + fmt.Sprintf("%d", argOffset) + " AND device_id = $" + fmt.Sprintf("%d", argOffset+1)
		args = append(args, collector, deviceID)
	case collector != "":
		where += " AND collector = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, collector)
	case deviceID != "":
		where += " AND device_id = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, deviceID)
	case status != "":
		where += " AND status = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, status)
	}
	offsetArg := fmt.Sprintf("$%d", len(args)+1)
	limitArg := fmt.Sprintf("$%d", len(args)+2)
	args = append(args, offset, limit)

	query := `SELECT id, collection_id, collector, device_id, target_id, tenant_id, phase,
		        status, attribute_count, attributes, error, duration_ms, created_at
		 FROM cmdb_collections ` + where + ` ORDER BY created_at DESC OFFSET ` + offsetArg + ` LIMIT ` + limitArg

	err = r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ===========================================================================
// Count helpers
// ===========================================================================

// CountTargets returns the number of targets for a tenant.
func (r *Repository) CountTargets(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM cmdb_targets WHERE tenant_id = $1`, tenantID,
	)
	return n, err
}

// CountDevices returns the number of devices for a tenant.
func (r *Repository) CountDevices(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM cmdb_devices WHERE tenant_id = $1`, tenantID,
	)
	return n, err
}

// CountCollections returns the number of collections for a tenant.
func (r *Repository) CountCollections(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM cmdb_collections WHERE tenant_id = $1`, tenantID,
	)
	return n, err
}
