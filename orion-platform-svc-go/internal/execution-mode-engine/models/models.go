package models


type ExecutionMode string

const (
	Synchronous  ExecutionMode = "synchronous"
	Asynchronous ExecutionMode = "asynchronous"
	Deferred     ExecutionMode = "deferred"
)

type ExecutionModeConfig struct {
	ID           string        `json:"id" db:"id"`
	TenantID     string        `json:"tenant_id" db:"tenant_id"`
	Name         string        `json:"name" db:"name"`
	Mode         ExecutionMode `json:"mode" db:"mode"`
	TimeoutMs    int64         `json:"timeout_ms" db:"timeout_ms"`
	Retries      int           `json:"retries" db:"retries"`
	WorkerPool   int           `json:"worker_pool" db:"worker_pool"`
	Enabled      bool          `json:"enabled" db:"enabled"`
}
