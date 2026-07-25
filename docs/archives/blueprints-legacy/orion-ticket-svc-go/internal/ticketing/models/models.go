package models

import "time"

type Ticketing struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateTicketingRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateTicketingRequest struct {
	Name *string `json:"name"`
}
