package models

// RowEditorSpecRequest is the body of POST /row-editors/register.
//
// tenant_id deliberately does not appear here. Tenant came from the request
// body with binding:"required" before, which let any caller claim any tenant id
// while registering an editor — and registration is what decides which table a
// tenant may write. The handler takes it from the JWT-verified Gin context.
type RowEditorSpecRequest struct {
	TableName     string       `json:"table_name" binding:"required"`
	PrimaryKey    string       `json:"primary_key" binding:"required"`
	VersionColumn string       `json:"version_column"`
	SoftDelete    bool         `json:"soft_delete"`
	Columns       []ColumnSpec `json:"columns" binding:"required"`
}

type ColumnSpec struct {
	Name       string `json:"name" binding:"required"`
	ReadOnly   bool   `json:"read_only"`
	IsRequired bool   `json:"is_required"`
}

// RowCreateRequest is the body of POST /rows/:editor/create. See
// RowEditorSpecRequest for why tenant_id is not accepted here.
type RowCreateRequest struct {
	Row map[string]interface{} `json:"row" binding:"required"`
}

type RowUpdateRequest struct {
	RowID   string                 `json:"row_id" binding:"required"`
	Changes map[string]interface{} `json:"changes"`
	Version int64                  `json:"version"`
}

// BatchCreateRequest is the body of POST /rows/:editor/batch-create. See
// RowEditorSpecRequest for why tenant_id is not accepted here.
type BatchCreateRequest struct {
	Rows []map[string]interface{} `json:"rows" binding:"required"`
}

type BatchUpdateRequest struct {
	RowIDs  []string               `json:"row_ids" binding:"required"`
	Changes map[string]interface{} `json:"changes"`
	Version int64                  `json:"version"`
}

type RowEditorResponse struct {
	Affected int                    `json:"affected"`
	NewRow   map[string]interface{} `json:"new_row,omitempty"`
}

type RowEditorStats struct {
	TableName  string   `json:"table_name"`
	PrimaryKey string   `json:"primary_key"`
	Columns    int      `json:"columns"`
	ReadOnly   []string `json:"read_only_columns"`
}
