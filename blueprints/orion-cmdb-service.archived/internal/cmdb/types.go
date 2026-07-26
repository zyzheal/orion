package cmdb

import (
	"errors"
	"time"
)

type CiType string

const (
	CiTypeApplication   CiType = "APPLICATION"
	CiTypeService       CiType = "SERVICE"
	CiTypeDatabase      CiType = "DATABASE"
	CiTypeServer        CiType = "SERVER"
	CiTypeContainer     CiType = "CONTAINER"
	CiTypeK8sCluster    CiType = "K8S_CLUSTER"
	CiTypeK8sDeployment CiType = "K8S_DEPLOYMENT"
	CiTypeK8sPod        CiType = "K8S_POD"
	CiTypeNetwork       CiType = "NETWORK"
	CiTypeLoadBalancer  CiType = "LOAD_BALANCER"
	CiTypeMiddleware    CiType = "MIDDLEWARE"
	CiTypePipeline      CiType = "PIPELINE"
	CiTypeEnvironment   CiType = "ENVIRONMENT"
)

type CiStatus string

const (
	CiStatusActive         CiStatus = "ACTIVE"
	CiStatusInactive       CiStatus = "INACTIVE"
	CiStatusDecommissioned CiStatus = "DECOMMISSIONED"
	CiStatusPending        CiStatus = "PENDING"
	CiStatusMaintenance    CiStatus = "MAINTENANCE"
)

// ValidCiTypes returns all valid CI type values
func ValidCiTypes() []CiType {
	return []CiType{
		CiTypeApplication,
		CiTypeService,
		CiTypeDatabase,
		CiTypeServer,
		CiTypeContainer,
		CiTypeK8sCluster,
		CiTypeK8sDeployment,
		CiTypeK8sPod,
		CiTypeNetwork,
		CiTypeLoadBalancer,
		CiTypeMiddleware,
		CiTypePipeline,
		CiTypeEnvironment,
	}
}

// IsValidCiType checks if the given ciType is valid
func IsValidCiType(ciType string) bool {
	for _, valid := range ValidCiTypes() {
		if string(valid) == ciType {
			return true
		}
	}
	return false
}

// CI represents a Configuration Item in CMDB
type CI struct {
	ID          string            `json:"id" gorm:"primaryKey"`
	TenantID    int64             `json:"tenant_id" gorm:"index;not null"`
	CiID        string            `json:"ci_id" gorm:"uniqueIndex:idx_tenant_ci;not null"`
	CiType      string            `json:"ci_type" gorm:"not null"`
	Name        string            `json:"name" gorm:"not null"`
	Description string            `json:"description"`
	Status      string            `json:"status" gorm:"default:ACTIVE"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags" gorm:"serializer:json"`
	Attributes  map[string]string `json:"attributes" gorm:"serializer:json"`
	Version     int               `json:"version" gorm:"default:1"`
	CreatedBy   string            `json:"created_by"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	DeletedAt   *time.Time        `json:"deleted_at"`
}

// TableName returns the table name for CI model
func (CI) TableName() string {
	return "cmdb_cis"
}

// CreateCIInput represents the input for creating a new CI
type CreateCIInput struct {
	CiID        string            `json:"ci_id" validate:"required"`
	CiType      string            `json:"ci_type" validate:"required"`
	Name        string            `json:"name" validate:"required"`
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags"`
	Attributes  map[string]string `json:"attributes"`
	TenantID    int64             `json:"-"`
	CreatedBy   string            `json:"-"`
}

// UpdateCIInput represents the input for updating an existing CI
type UpdateCIInput struct {
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags"`
	Attributes  map[string]string `json:"attributes"`
}

// CIListResult represents the result of listing CIs
type CIListResult struct {
	Items      []CI  `json:"items"`
	TotalCount int64 `json:"total_count"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
}

// CI service errors
var (
	ErrCIExists    = errors.New("CI already exists")
	ErrCINotFound  = errors.New("CI not found")
	ErrInvalidInput = errors.New("invalid input")
)