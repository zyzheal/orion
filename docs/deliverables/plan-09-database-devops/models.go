package database_devops

import (
	"time"

	"gorm.io/gorm"
)

// === 数据库实例模型 ===

type DatabaseInstance struct {
	ID        string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name      string         `json:"name" gorm:"uniqueIndex;size:128;not null"`
	Engine    string         `json:"engine" gorm:"size:32;not null"`
	Host      string         `json:"host" gorm:"size:512;not null"`
	Port      int            `json:"port" gorm:"not null"`
	Username  string         `json:"username" gorm:"size:128;not null"`
	Password  string         `json:"-" gorm:"size:256"`
	DBName    string         `json:"dbName" gorm:"size:128;not null"`
	Status    string         `json:"status" gorm:"size:16;default:'inactive'"`
	Role      string         `json:"role" gorm:"size:16;default:'standalone'"`
	TenantID  string         `json:"tenantId" gorm:"size:64;index;not null"`
	Metrics   string         `json:"metrics" gorm:"type:text"`
	Tags      string         `json:"tags" gorm:"type:text"`
	Labels    string         `json:"labels" gorm:"type:text"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (DatabaseInstance) TableName() string { return "database_instances" }

// === 备份策略模型 ===

type BackupPolicy struct {
	ID          string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	DatabaseID  string         `json:"databaseId" gorm:"size:64;index;not null"`
	Schedule    string         `json:"schedule" gorm:"size:64;not null"`
	Retention   int            `json:"retention" gorm:"not null"`
	Type        string         `json:"type" gorm:"size:32;not null"`
	Destination string         `json:"destination" gorm:"size:256"`
	Format      string         `json:"format" gorm:"size:32;default:'custom'"`
	Compression string         `json:"compression" gorm:"size:32"`
	Status      string         `json:"status" gorm:"size:16;default:'enabled'"`
	LastBackup  *time.Time     `json:"lastBackup"`
	NextBackup  *time.Time     `json:"nextBackup"`
	TenantID    string         `json:"tenantId" gorm:"size:64;index;not null"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func (BackupPolicy) TableName() string { return "backup_policies" }

// === 备份记录 ===

type BackupRecord struct {
	ID         string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PolicyID   string     `json:"policyId" gorm:"size:64;index;not null"`
	DatabaseID string     `json:"databaseId" gorm:"size:64;index;not null"`
	Status     string     `json:"status" gorm:"size:16;default:'pending'"`
	Path       string     `json:"path" gorm:"size:1024"`
	SizeBytes  int64      `json:"sizeBytes"`
	Duration   int        `json:"duration"`
	Checksum   string     `json:"checksum" gorm:"size:64"`
	Errors     string     `json:"errors" gorm:"type:text"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	TenantID   string     `json:"tenantId" gorm:"size:64;index;not null"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

func (BackupRecord) TableName() string { return "backup_records" }

// === 运维操作 ===

type DBOperation struct {
	ID         string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	DatabaseID string     `json:"databaseId" gorm:"size:64;index;not null"`
	Type       string     `json:"type" gorm:"size:32;not null"`
	Status     string     `json:"status" gorm:"size:16;default:'pending'"`
	Executor   string     `json:"executor" gorm:"size:128"`
	Progress   int        `json:"progress" gorm:"default:0"`
	Command    string     `json:"command" gorm:"type:text"`
	Logs       string     `json:"logs" gorm:"type:text"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	TenantID   string     `json:"tenantId" gorm:"size:64;index;not null"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

func (DBOperation) TableName() string { return "db_operations" }
