package database_devops

import (
    "context"
    "errors"
    "time"
    "gorm.io/gorm"
)

type DatabaseRepository struct { db *gorm.DB }
func NewDatabaseRepository(db *gorm.DB) *DatabaseRepository { return &DatabaseRepository{db: db} }

func (r *DatabaseRepository) Create(ctx context.Context, instance *DatabaseInstance) error {
    return r.db.WithContext(ctx).Create(instance).Error
}
func (r *DatabaseRepository) GetByID(ctx context.Context, id string) (*DatabaseInstance, error) {
    var instance DatabaseInstance
    err := r.db.WithContext(ctx).First(&instance, "id = ?", id).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) { return nil, ErrInstanceNotFound }
        return nil, err
    }
    return &instance, nil
}
func (r *DatabaseRepository) ListByTenant(ctx context.Context, tenantID string) ([]DatabaseInstance, error) {
    var instances []DatabaseInstance
    return instances, r.db.WithContext(ctx).Where("tenant_id = ?", tenantID).Order("created_at DESC").Find(&instances).Error
}
func (r *DatabaseRepository) Update(ctx context.Context, instance *DatabaseInstance) error {
    return r.db.WithContext(ctx).Select("name", "status", "metrics", "tags", "labels", "updated_at").Save(instance).Error
}
func (r *DatabaseRepository) SoftDelete(ctx context.Context, id, tenantID string) error {
    return r.db.WithContext(ctx).Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&DatabaseInstance{}).Error
}

type BackupRepository struct { db *gorm.DB }
func NewBackupRepository(db *gorm.DB) *BackupRepository { return &BackupRepository{db: db} }
func (r *BackupRepository) CreateRecord(ctx context.Context, record *BackupRecord) error {
    return r.db.WithContext(ctx).Create(record).Error
}
func (r *BackupRepository) GetLatestByDatabase(ctx context.Context, databaseID string) (*BackupRecord, error) {
    var record BackupRecord
    err := r.db.WithContext(ctx).Where("database_id = ?", databaseID).Order("started_at DESC").First(&record).Error
    if err != nil && errors.Is(err, gorm.ErrRecordNotFound) { return nil, nil }
    return &record, err
}
func (r *BackupRepository) UpdateStatus(ctx context.Context, id string, status string, finishedAt *time.Time) error {
    updates := map[string]interface{}{"status": status, "updated_at": time.Now()}
    if finishedAt != nil { updates["finished_at"] = finishedAt }
    return r.db.WithContext(ctx).Model(&BackupRecord{}).Where("id = ?", id).Updates(updates).Error
}

type OperationRepository struct { db *gorm.DB }
func NewOperationRepository(db *gorm.DB) *OperationRepository { return &OperationRepository{db: db} }
func (r *OperationRepository) Create(ctx context.Context, op *DBOperation) error {
    return r.db.WithContext(ctx).Create(op).Error
}
func (r *OperationRepository) UpdateProgress(ctx context.Context, id string, progress int, logs string) error {
    return r.db.WithContext(ctx).Model(&DBOperation{}).Where("id = ?", id).Updates(map[string]interface{}{"progress": progress, "logs": logs, "updated_at": time.Now()}).Error
}
func (r *OperationRepository) UpdateStatus(ctx context.Context, id string, status string) error {
    now := time.Now()
    updates := map[string]interface{}{"status": status, "updated_at": now}
    if status == "succeeded" || status == "failed" { updates["finished_at"] = &now }
    return r.db.WithContext(ctx).Model(&DBOperation{}).Where("id = ?", id).Updates(updates).Error
}

var (
    ErrInstanceNotFound = errors.New("database instance not found")
    ErrBackupNotFound   = errors.New("backup record not found")
)