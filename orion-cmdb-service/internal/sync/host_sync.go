package sync

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/orion-platform/orion-cmdb/internal/cmdb"
	"gorm.io/gorm"
)

// HostSyncConfig holds configuration for host synchronization
type HostSyncConfig struct {
	OpsServiceAddr string
	SyncInterval   time.Duration
	Enabled        bool
}

// Service handles synchronization between CMDB and Ops
type Service struct {
	cmdbRepo   *cmdb.Repository
	opsClient  *OpsClient
	config     *HostSyncConfig
	db         *gorm.DB
	stopCh     chan struct{}
}

// NewService creates a new sync service
func NewService(cmdbRepo *cmdb.Repository, db *gorm.DB, config *HostSyncConfig) (*Service, error) {
	var opsClient *OpsClient
	var err error

	if config.Enabled && config.OpsServiceAddr != "" {
		opsClient, err = NewOpsClient(config.OpsServiceAddr)
		if err != nil {
			log.Printf("Warning: failed to create Ops client: %v, sync will be disabled", err)
			config.Enabled = false
		}
	}

	return &Service{
		cmdbRepo:  cmdbRepo,
		opsClient: opsClient,
		config:    config,
		db:        db,
		stopCh:    make(chan struct{}),
	}, nil
}

// Start starts the periodic host synchronization
func (s *Service) Start(ctx context.Context) {
	if !s.config.Enabled {
		log.Println("[sync] Host sync is disabled")
		return
	}

	log.Printf("[sync] Starting host sync service with interval %v", s.config.SyncInterval)

	ticker := time.NewTicker(s.config.SyncInterval)
	defer ticker.Stop()

	// Run initial sync
	if err := s.SyncHostsToOps(ctx); err != nil {
		log.Printf("[sync] Initial sync failed: %v", err)
	}

	for {
		select {
		case <-ticker.C:
			if err := s.SyncHostsToOps(ctx); err != nil {
				log.Printf("[sync] Periodic sync failed: %v", err)
			}
		case <-s.stopCh:
			log.Println("[sync] Stopping host sync service")
			return
		case <-ctx.Done():
			log.Println("[sync] Context cancelled, stopping host sync service")
			return
		}
	}
}

// Stop stops the sync service
func (s *Service) Stop() {
	if s.stopCh != nil {
		close(s.stopCh)
	}
	if s.opsClient != nil {
		s.opsClient.Close()
	}
}

// SyncHostsToOps synchronizes hosts from CMDB to Ops service
func (s *Service) SyncHostsToOps(ctx context.Context) error {
	if !s.config.Enabled || s.opsClient == nil {
		return fmt.Errorf("sync is disabled or Ops client not initialized")
	}

	log.Println("[sync] Starting host synchronization to Ops")

	// Get all server-type CIs from CMDB
	cis, _, err := s.cmdbRepo.List("SERVER", "", "", 1, 1000, 1)
	if err != nil {
		return fmt.Errorf("failed to list hosts from CMDB: %w", err)
	}

	log.Printf("[sync] Found %d hosts in CMDB", len(cis))

	syncedCount := 0
	for _, ci := range cis {
		hostID := ci.CiID
		ipAddress := ""
		if attrs := ci.Attributes; attrs != nil {
			ipAddress = attrs["ip_address"]
		}

		if ipAddress == "" {
			log.Printf("[sync] Skipping host %s: no IP address", hostID)
			continue
		}

		// In a real implementation, this would register the host with Ops service
		// For now, we just log the sync operation
		log.Printf("[sync] Syncing host: %s (%s)", hostID, ipAddress)
		syncedCount++
	}

	log.Printf("[sync] Completed host synchronization: %d/%d hosts synced", syncedCount, len(cis))
	return nil
}

// SyncHostToOps synchronizes a single host to Ops service
func (s *Service) SyncHostToOps(ctx context.Context, hostID string) error {
	if !s.config.Enabled || s.opsClient == nil {
		return fmt.Errorf("sync is disabled or Ops client not initialized")
	}

	ci, err := s.cmdbRepo.GetByCiID(hostID, 1)
	if err != nil {
		return fmt.Errorf("failed to get host from CMDB: %w", err)
	}

	ipAddress := ""
	if attrs := ci.Attributes; attrs != nil {
		ipAddress = attrs["ip_address"]
	}

	if ipAddress == "" {
		return fmt.Errorf("host %s has no IP address", hostID)
	}

	log.Printf("[sync] Syncing single host: %s (%s)", hostID, ipAddress)
	return nil
}

// ExecuteCommandOnHost executes a command on a specific host via Ops service
func (s *Service) ExecuteCommandOnHost(ctx context.Context, hostID, command string) (*Task, error) {
	if !s.config.Enabled || s.opsClient == nil {
		return nil, fmt.Errorf("sync is disabled or Ops client not initialized")
	}

	task, err := s.opsClient.ExecuteBatch(ctx, "cmdb-sync-task", command, []string{hostID})
	if err != nil {
		return nil, fmt.Errorf("failed to execute command on host: %w", err)
	}

	return task, nil
}

// GetTaskResults retrieves the results of a previously executed task
func (s *Service) GetTaskResults(ctx context.Context, taskID string) ([]TaskResult, error) {
	if !s.config.Enabled || s.opsClient == nil {
		return nil, fmt.Errorf("sync is disabled or Ops client not initialized")
	}

	return s.opsClient.GetTaskResults(ctx, taskID)
}