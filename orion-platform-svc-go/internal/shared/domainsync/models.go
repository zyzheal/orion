package domainsync

import "time"

type DomainSyncType string

const (
	SyncAlertToIncident  DomainSyncType = "alert_to_incident"
	SyncIncidentToChange DomainSyncType = "incident_to_change"
	SyncChangeToPipeline DomainSyncType = "change_to_pipeline"
	SyncPipelineToCMDB   DomainSyncType = "pipeline_to_cmdb"
	SyncFullChain        DomainSyncType = "full_chain"
)

type DomainSyncEvent struct {
	ID           string         `json:"id"`
	Type         DomainSyncType `json:"type"`
	SourceDomain string         `json:"sourceDomain"`
	TargetDomain string         `json:"targetDomain"`
	TenantID     string         `json:"tenantId"`
	Payload      map[string]any `json:"payload"`
	CreatedAt    time.Time      `json:"createdAt"`
	Status       string         `json:"status"` // pending/executing/completed/failed
}

type SyncConfig struct {
	TenantID       string `json:"tenantId"`
	AutoEscalate   bool   `json:"autoEscalate"`
	SkipApproval   bool   `json:"skipApproval"`
	TimeoutSeconds int    `json:"timeoutSeconds"`
	NotifyOnFail   bool   `json:"notifyOnFail"`
}
