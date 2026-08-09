package domainsync

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type DomainHandler func(ctx context.Context, event DomainSyncEvent) error

type DomainCoordinator struct {
	mu       sync.RWMutex
	handlers map[DomainSyncType]DomainHandler
	configs  map[string]SyncConfig
}

func NewDomainCoordinator() *DomainCoordinator {
	return &DomainCoordinator{
		handlers: make(map[DomainSyncType]DomainHandler),
		configs:  make(map[string]SyncConfig),
	}
}

func (dc *DomainCoordinator) RegisterHandler(syncType DomainSyncType, handler DomainHandler) {
	dc.mu.Lock()
	dc.handlers[syncType] = handler
	dc.mu.Unlock()
}

func (dc *DomainCoordinator) SetConfig(config SyncConfig) {
	dc.mu.Lock()
	dc.configs[config.TenantID] = config
	dc.mu.Unlock()
}

func (dc *DomainCoordinator) GetConfig(tenantID string) SyncConfig {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	return dc.configs[tenantID]
}

func (dc *DomainCoordinator) Execute(ctx context.Context, event DomainSyncEvent) error {
	dc.mu.RLock()
	handler, ok := dc.handlers[event.Type]
	dc.mu.RUnlock()
	if !ok {
		return fmt.Errorf("no handler registered for sync type: %s", event.Type)
	}
	return handler(ctx, event)
}

func (dc *DomainCoordinator) StartFullChain(ctx context.Context, tenantID string, triggerType string) error {
	chain := []DomainSyncType{
		SyncAlertToIncident,
		SyncIncidentToChange,
		SyncChangeToPipeline,
		SyncPipelineToCMDB,
	}
	for _, syncType := range chain {
		event := DomainSyncEvent{
			ID:           fmt.Sprintf("chain-%s-%d", tenantID, time.Now().UnixNano()),
			Type:         syncType,
			TenantID:     tenantID,
			SourceDomain: "auto",
			TargetDomain: triggerType,
			CreatedAt:    time.Now(),
			Status:       "executing",
		}
		if err := dc.Execute(ctx, event); err != nil {
			return fmt.Errorf("full chain failed at %s: %w", syncType, err)
		}
	}
	return nil
}
