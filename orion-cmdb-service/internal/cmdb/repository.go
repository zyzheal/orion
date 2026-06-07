package cmdb

import (
	"errors"

	"gorm.io/gorm"
)

// Repository defines the data access layer for CI
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new CI repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create creates a new CI in the database
func (r *Repository) Create(ci *CI) error {
	return r.db.Create(ci).Error
}

// GetByID retrieves a CI by its primary key ID.
// DEPRECATED: Use GetByIDWithTenant with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) GetByID(id string) (*CI, error) {
	var ci CI
	err := r.db.Where("id = ?", id).First(&ci).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCINotFound
		}
		return nil, err
	}
	return &ci, nil
}

// GetByIDWithTenant retrieves a CI by ID with tenant isolation
func (r *Repository) GetByIDWithTenant(id string, tenantID int64) (*CI, error) {
	var ci CI
	err := r.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&ci).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCINotFound
		}
		return nil, err
	}
	return &ci, nil
}

// GetByCiID retrieves a CI by its ci_id and tenant_id
func (r *Repository) GetByCiID(ciID string, tenantID int64) (*CI, error) {
	var ci CI
	err := r.db.Where("ci_id = ? AND tenant_id = ?", ciID, tenantID).First(&ci).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCINotFound
		}
		return nil, err
	}
	return &ci, nil
}

// Update updates an existing CI.
// DEPRECATED: Use UpdateWithTenant with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) Update(id string, input *UpdateCIInput) (*CI, error) {
	ci, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	return r.updateCI(ci, input)
}

// UpdateWithTenant updates an existing CI with tenant isolation
func (r *Repository) UpdateWithTenant(id string, tenantID int64, input *UpdateCIInput) (*CI, error) {
	ci, err := r.GetByIDWithTenant(id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.updateCI(ci, input)
}

// updateCI performs the actual update logic
func (r *Repository) updateCI(ci *CI, input *UpdateCIInput) (*CI, error) {
	// Build updates using map for GORM
	updates := make(map[string]interface{})

	if input.Description != "" {
		updates["description"] = input.Description
	}
	if input.Status != "" {
		updates["status"] = input.Status
	}
	if input.Environment != "" {
		updates["environment"] = input.Environment
	}
	if input.Tags != nil {
		updates["tags"] = input.Tags
	}
	if input.Attributes != nil {
		updates["attributes"] = input.Attributes
	}

	// Increment version
	updates["version"] = gorm.Expr("version + 1")

	if len(updates) > 0 {
		err := r.db.Model(ci).Updates(updates).Error
		if err != nil {
			return nil, err
		}
	}

	// Reload the updated CI
	return r.GetByID(ci.ID)
}

// Delete soft deletes a CI.
// DEPRECATED: Use DeleteWithTenant with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) Delete(id string) error {
	result := r.db.Delete(&CI{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCINotFound
	}
	return nil
}

// DeleteWithTenant soft deletes a CI with tenant isolation
func (r *Repository) DeleteWithTenant(id string, tenantID int64) error {
	result := r.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&CI{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCINotFound
	}
	return nil
}

// List retrieves CIs with filtering and pagination
func (r *Repository) List(ciType, status, search string, page, pageSize int, tenantID int64) ([]CI, int64, error) {
	var cis []CI
	var total int64

	query := r.db.Model(&CI{}).Where("tenant_id = ?", tenantID)

	// Apply filters
	if ciType != "" {
		query = query.Where("ci_type = ?", ciType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name LIKE ? OR ci_id LIKE ? OR description LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	// Get total count
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	// Apply pagination
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&cis).Error
	if err != nil {
		return nil, 0, err
	}

	return cis, total, nil
}

// Exists checks if a CI with the given ci_id exists for a tenant
func (r *Repository) Exists(ciID string, tenantID int64) bool {
	var count int64
	r.db.Model(&CI{}).Where("ci_id = ? AND tenant_id = ?", ciID, tenantID).Count(&count)
	return count > 0
}

// GetByIDs retrieves multiple CIs by their IDs.
// DEPRECATED: Use GetByIDsAndTenant with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) GetByIDs(ids []string) ([]CI, error) {
	var cis []CI
	err := r.db.Where("id IN ?", ids).Find(&cis).Error
	return cis, err
}

// GetByIDsAndTenant retrieves multiple CIs by their IDs, scoped to a tenant.
func (r *Repository) GetByIDsAndTenant(ids []string, tenantID int64) ([]CI, error) {
	var cis []CI
	err := r.db.Where("id IN ? AND tenant_id = ?", ids, tenantID).Find(&cis).Error
	return cis, err
}

// Count counts CIs by type and status
func (r *Repository) Count(ciType, status string, tenantID int64) (int64, error) {
	var count int64
	query := r.db.Model(&CI{}).Where("tenant_id = ?", tenantID)

	if ciType != "" {
		query = query.Where("ci_type = ?", ciType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Count(&count).Error
	return count, err
}