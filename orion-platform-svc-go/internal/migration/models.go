package migration

import "time"

// MigrationType identifies the kind of data movement.
type MigrationType string

const (
	MigrationSchema   MigrationType = "schema"
	MigrationData     MigrationType = "data"
	MigrationHybrid   MigrationType = "hybrid"
)

// MigrationDirection is forward or rollback.
type MigrationDirection string

const (
	DirectionForward  MigrationDirection = "forward"
	DirectionRollback MigrationDirection = "rollback"
)

// MigrationPhase tracks the current lifecycle step.
type MigrationPhase string

const (
	PhasePreflight  MigrationPhase = "preflight"
	PhaseExecuting  MigrationPhase = "executing"
	PhaseValidating MigrationPhase = "validating"
	PhaseCompleted  MigrationPhase = "completed"
	PhaseFailed     MigrationPhase = "failed"
	PhaseRolledBack MigrationPhase = "rolled_back"
)

// MigrationPlan describes a requested migration.
type MigrationPlan struct {
	ID              string             `json:"id"`
	TenantID        string             `json:"tenant_id"`
	Name            string             `json:"name"`
	Type            MigrationType      `json:"type"`
	Source          MigrationEndpoint  `json:"source"`
	Target          MigrationEndpoint  `json:"target"`
	Direction       MigrationDirection `json:"direction"`
	SqlStatements   []string           `json:"sql_statements,omitempty"`
	DataFilter      string             `json:"data_filter,omitempty"`
	BatchSize       int                `json:"batch_size,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	phase           MigrationPhase     // unexported; managed by service
}

// Phase returns the current lifecycle phase of the plan.
func (p *MigrationPlan) Phase() MigrationPhase { return p.phase }

// SetPhase updates the plan's phase.
func (p *MigrationPlan) SetPhase(phase MigrationPhase) {
	p.phase = phase
	p.UpdatedAt = time.Now().UTC()
}

// MigrationEndpoint identifies source/target of a migration.
type MigrationEndpoint struct {
	Name     string `json:"name"`
	Type     string `json:"type"` // "postgresql" | "mysql" | "redis"
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Schema   string `json:"schema,omitempty"`
	// User/Password are optional credentials used by DBFactory when
	// executing real SQL. When omitted, the factory falls back to
	// ORION_MIG_<SIDE>_USER / ORION_MIG_<SIDE>_PASSWORD env vars.
	User     string `json:"user,omitempty" alias:"username"`
	Password string `json:"password,omitempty"`
	SSLMode  string `json:"sslmode,omitempty"`
}

// MigrationStep is one atomic operation within a migration plan.
type MigrationStep struct {
	ID       string         `json:"id"`
	PlanID   string         `json:"plan_id"`
	Phase    MigrationPhase `json:"phase"`
	Status   string         `json:"status"` // "pending" | "running" | "done" | "failed"
	SQL      string         `json:"sql,omitempty"`
	Rows     int64          `json:"rows,omitempty"`
	ErrMsg   string         `json:"error_message,omitempty"`
	Started  *time.Time     `json:"started_at,omitempty"`
	Finished *time.Time     `json:"finished_at,omitempty"`
}

// MigrationResult is the response for Execute.
type MigrationResult struct {
	PlanID   string         `json:"plan_id"`
	Phase    MigrationPhase `json:"phase"`
	Status   string         `json:"status"`
	Steps    int            `json:"steps"`
	StepsOK  int            `json:"steps_ok"`
	StepsErr int            `json:"steps_err"`
	Rows     int64          `json:"rows_moved"`
	Duration time.Duration  `json:"duration"`
	Error    string         `json:"error,omitempty"`
}

// MigrationPlanStats summarizes the migration plan activity.
type MigrationPlanStats struct {
	TotalPlans   int   `json:"total_plans"`
	ActivePlans  int   `json:"active_plans"`
	Completed    int   `json:"completed"`
	Failed       int   `json:"failed"`
	RowsMigrated int64 `json:"rows_migrated"`
}

// CreatePlanInput is the request body for POST /migration/plans.
type CreatePlanInput struct {
	TenantID      string            `json:"-"`
	Name          string            `json:"name"`
	Type          MigrationType     `json:"type"`
	Source        MigrationEndpoint `json:"source"`
	Target        MigrationEndpoint `json:"target"`
	Direction     MigrationDirection `json:"direction,omitempty"`
	SqlStatements []string          `json:"sql_statements,omitempty"`
	DataFilter    string            `json:"data_filter,omitempty"`
	BatchSize     int               `json:"batch_size,omitempty"`
}

// UpdatePlanInput is the request body for PUT /migration/plans/:id.
type UpdatePlanInput struct {
	Name          *string            `json:"name,omitempty"`
	Type          *MigrationType     `json:"type,omitempty"`
	Direction     *MigrationDirection `json:"direction,omitempty"`
	SqlStatements *[]string          `json:"sql_statements,omitempty"`
	BatchSize     *int               `json:"batch_size,omitempty"`
}

// SchemaDiff is the output of a schema comparison.
type SchemaDiff struct {
	SourceEndpoint string        `json:"source"`
	TargetEndpoint string        `json:"target"`
	Additions      []SchemaObject `json:"additions,omitempty"`
	Removals       []SchemaObject `json:"removals,omitempty"`
	Modifications  []SchemaObject `json:"modifications,omitempty"`
	CheckedAt      time.Time     `json:"checked_at"`
}

// SchemaObject describes a single schema entity.
type SchemaObject struct {
	Name   string       `json:"name"`
	Type   string       `json:"type"` // "table" | "view" | "index" | "column"
	DDL    string       `json:"ddl,omitempty"`
	Change string       `json:"change"` // "added" | "removed" | "modified"
}
