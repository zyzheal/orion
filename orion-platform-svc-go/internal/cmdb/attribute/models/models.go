package models

import "time"

// Attribute defines a CMDB attribute schema entry.
type Attribute struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	CITypeID    string    `json:"ciTypeId" db:"ci_type_id"`
	Name        string    `json:"name" db:"name"`
	DataType    string    `json:"dataType" db:"data_type"`
	Required    bool      `json:"required" db:"required"`
	DefaultVal  *string   `json:"defaultValue" db:"default_value"`
	Description *string   `json:"description" db:"description"`
	OptionList  *string   `json:"optionList" db:"option_list"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateAttributeRequest struct {
	CITypeID    string  `json:"ciTypeId" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	DataType    string  `json:"dataType" binding:"required"`
	Required    bool    `json:"required"`
	DefaultVal  *string `json:"defaultValue"`
	Description *string `json:"description"`
	OptionList  *string `json:"optionList"`
	TenantID    *string `json:"tenantId"`
}
