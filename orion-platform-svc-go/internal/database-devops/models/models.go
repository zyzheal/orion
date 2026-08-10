package models

import "time"

type DatabaseDevopsItem struct {
    ID        string    `json:"id"`
    TenantID  string    `json:"tenant_id"`
    Name      string    `json:"name"`
    Description string   `json:"description"`
    Enabled   bool      `json:"enabled"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type CreateDatabaseDevopsRequest struct {
    Name        string `json:"name" binding:"required"`
    Description string `json:"description"`
    Enabled     bool   `json:"enabled"`
}
