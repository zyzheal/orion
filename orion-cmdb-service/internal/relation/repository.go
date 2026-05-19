package relation

import (
	"errors"

	"gorm.io/gorm"
)

// Repository defines the data access layer for CI relations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new relation repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create creates a new relation in the database
func (r *Repository) Create(relation *Relation) error {
	return r.db.Create(relation).Error
}

// GetByID retrieves a relation by its primary key ID
func (r *Repository) GetByID(id string) (*Relation, error) {
	var relation Relation
	err := r.db.Where("id = ?", id).First(&relation).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRelationNotFound
		}
		return nil, err
	}
	return &relation, nil
}

// GetByFromCiID retrieves relations by source CI ID
func (r *Repository) GetByFromCiID(fromCiID string, tenantID int64) ([]Relation, error) {
	var relations []Relation
	err := r.db.Where("from_ci_id = ? AND tenant_id = ?", fromCiID, tenantID).Find(&relations).Error
	return relations, err
}

// GetByToCiID retrieves relations by target CI ID
func (r *Repository) GetByToCiID(toCiID string, tenantID int64) ([]Relation, error) {
	var relations []Relation
	err := r.db.Where("to_ci_id = ? AND tenant_id = ?", toCiID, tenantID).Find(&relations).Error
	return relations, err
}

// GetByCiID retrieves all relations for a given CI (both as source and target)
func (r *Repository) GetByCiID(ciID string, tenantID int64) ([]Relation, error) {
	var relations []Relation
	err := r.db.Where("(from_ci_id = ? OR to_ci_id = ?) AND tenant_id = ?", ciID, ciID, tenantID).Find(&relations).Error
	return relations, err
}

// Exists checks if a relation with the same from_ci_id, to_ci_id, and relation_type already exists
func (r *Repository) Exists(fromCiID, toCiID, relationType string, tenantID int64) bool {
	var count int64
	r.db.Model(&Relation{}).
		Where("from_ci_id = ? AND to_ci_id = ? AND relation_type = ? AND tenant_id = ?",
			fromCiID, toCiID, relationType, tenantID).
		Count(&count)
	return count > 0
}

// Delete soft deletes a relation by ID
func (r *Repository) Delete(id string) error {
	result := r.db.Delete(&Relation{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrRelationNotFound
	}
	return nil
}

// DeleteByCiID soft deletes all relations associated with a CI
func (r *Repository) DeleteByCiID(ciID string, tenantID int64) error {
	result := r.db.Where("(from_ci_id = ? OR to_ci_id = ?) AND tenant_id = ?", ciID, ciID, tenantID).Delete(&Relation{})
	return result.Error
}