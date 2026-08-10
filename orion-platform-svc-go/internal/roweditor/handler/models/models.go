package models

type RowEditorSpecRequest struct {
        TableName       string       `json:"table_name" binding:"required"`
        PrimaryKey      string       `json:"primary_key" binding:"required"`
        TenantColumn    string       `json:"tenant_column"`
        VersionColumn   string       `json:"version_column"`
        StatusColumn    string       `json:"status_column"`
        SoftDelete      bool         `json:"soft_delete"`
        Columns         []ColumnSpec `json:"columns" binding:"required"`
}

type ColumnSpec struct {
        Name       string `json:"name" binding:"required"`
        ReadOnly   bool   `json:"read_only"`
        IsRequired bool   `json:"is_required"`
}

type RowCreateRequest struct {
        TenantID string                 `json:"tenant_id" binding:"required"`
        Row      map[string]interface{} `json:"row" binding:"required"`
}

type RowUpdateRequest struct {
        RowID        string                 `json:"row_id" binding:"required"`
        Changes      map[string]interface{} `json:"changes"`
        NewRow       map[string]interface{} `json:"new_row"`
        Version      int64                  `json:"version"`
        SoftDelete   bool                   `json:"soft_delete"`
}

type BatchCreateRequest struct {
        TenantID string                   `json:"tenant_id" binding:"required"`
        Rows     []map[string]interface{} `json:"rows" binding:"required"`
}

type BatchUpdateRequest struct {
        RowIDs  []string               `json:"row_ids" binding:"required"`
        Changes map[string]interface{} `json:"changes"`
        Version int64                  `json:"version"`
}

type RowEditorResponse struct {
        Affected int    `json:"affected"`
        OldRow   map[string]interface{} `json:"old_row,omitempty"`
        NewRow   map[string]interface{} `json:"new_row,omitempty"`
        Version  int64  `json:"version"`
}

type RowEditorStats struct {
        TableName  string `json:"table_name"`
        PrimaryKey string `json:"primary_key"`
        Columns    int    `json:"columns"`
        ReadOnly   []string `json:"read_only_columns"`
}
