package models

import "time"

// MCPServer represents a registered MCP server.
type MCPServer struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenant_id" db:"tenant_id"`
	Name      string     `json:"name" db:"name"`
	URL       string     `json:"url" db:"url"`
	Enabled   bool       `json:"enabled" db:"enabled"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// MCPTool represents a tool exposed by an MCP server.
type MCPTool struct {
	ID        string    `json:"id" db:"id"`
	ServerID  string    `json:"server_id" db:"server_id"`
	Name      string    `json:"name" db:"name"`
	Params    string    `json:"params" db:"params"` // JSON
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Request models ---

type CreateMCPServerRequest struct {
	Name    string `json:"name" binding:"required"`
	URL     string `json:"url" binding:"required"`
	Enabled bool   `json:"enabled"`
}

type UpdateMCPServerRequest struct {
	Name    *string `json:"name"`
	URL     *string `json:"url"`
	Enabled *bool   `json:"enabled"`
}

type ListMCPServersQuery struct {
	Name    string `json:"name" form:"name"`
	Enabled *bool  `json:"enabled" form:"enabled"`
	Limit   int    `json:"limit" form:"limit"`
	Offset  int    `json:"offset" form:"offset"`
}

type ListMCPToolsQuery struct {
	ServerID string `json:"server_id" form:"server_id"`
	Limit    int    `json:"limit" form:"limit"`
	Offset   int    `json:"offset" form:"offset"`
}

// --- Response models ---

type MCPServerListResponse struct {
	Servers []MCPServer `json:"servers"`
	Total   int         `json:"total"`
}

type MCPToolListResponse struct {
	Tools []MCPTool `json:"tools"`
	Total int       `json:"total"`
}
