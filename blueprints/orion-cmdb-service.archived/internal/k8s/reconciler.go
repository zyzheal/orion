package k8s

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/orion-platform/orion-cmdb/internal/cmdb"
)

// Reconciler periodically syncs K8s resources to CMDB
type Reconciler struct {
	config      *SyncConfig
	watcher     *Watcher
	cmdbService *cmdb.Service
	status      *SyncStatus
	statusMu    sync.RWMutex
	stopCh      chan struct{}
	wg          sync.WaitGroup
	tenantID    int64
}

// NewReconciler creates a new K8s reconciler
func NewReconciler(config *SyncConfig, cmdbService *cmdb.Service, tenantID int64) *Reconciler {
	return &Reconciler{
		config:      config,
		cmdbService: cmdbService,
		status: &SyncStatus{
			LastSyncTime:   "",
			ResourcesFound: 0,
			Added:          0,
			Updated:        0,
			Deleted:        0,
			Errors:         0,
		},
		stopCh:   make(chan struct{}),
		tenantID: tenantID,
	}
}

// Start starts the reconciler with periodic sync
func (r *Reconciler) Start(ctx context.Context) error {
	// Create watcher
	watcher, err := NewWatcher(r.config)
	if err != nil {
		return fmt.Errorf("failed to create watcher: %w", err)
	}
	r.watcher = watcher

	// Set up event handlers
	watcher.OnAdd(r.handleAdd)
	watcher.OnUpdate(r.handleUpdate)
	watcher.OnDelete(r.handleDelete)

	// Start watcher
	if err := watcher.Start(ctx); err != nil {
		return fmt.Errorf("failed to start watcher: %w", err)
	}

	// Start periodic reconciliation
	resyncInterval := time.Duration(r.config.ResyncInterval) * time.Second
	if resyncInterval <= 0 {
		resyncInterval = 60 * time.Second // Default 60 seconds
	}

	r.wg.Add(1)
	go r.runReconciliation(ctx, resyncInterval)

	return nil
}

// Stop stops the reconciler
func (r *Reconciler) Stop() error {
	close(r.stopCh)
	r.wg.Wait()

	if r.watcher != nil {
		r.watcher.Stop()
	}

	return nil
}

// SyncNow performs an immediate synchronization
func (r *Reconciler) SyncNow() (*SyncStatus, error) {
	ctx := context.Background()

	// Reset status
	r.statusMu.Lock()
	r.status.Added = 0
	r.status.Updated = 0
	r.status.Deleted = 0
	r.status.Errors = 0
	r.status.ResourcesFound = 0
	r.statusMu.Unlock()

	// List all K8s resources
	resources, err := r.watcher.ListResources(ctx)
	if err != nil {
		r.statusMu.Lock()
		r.status.Errors++
		r.statusMu.Unlock()
		return r.status, fmt.Errorf("failed to list resources: %w", err)
	}

	r.statusMu.Lock()
	r.status.ResourcesFound = len(resources)
	r.statusMu.Unlock()

	// Get existing CIs from CMDB
	existingCIs, _, err := r.cmdbService.ListCIs("", "", "", 1, 10000, r.tenantID)
	if err != nil {
		r.statusMu.Lock()
		r.status.Errors++
		r.statusMu.Unlock()
		return r.status, fmt.Errorf("failed to list existing CIs: %w", err)
	}

	// Build a map of existing CIs by K8s UID
	existingByUID := make(map[string]*cmdb.CI)
	for i := range existingCIs {
		ci := &existingCIs[i]
		if uid, ok := ci.Attributes["k8s_uid"]; ok {
			existingByUID[uid] = ci
		}
	}

	// Track which UIDs we see in K8s
	seenUIDs := make(map[string]bool)

	// Process each K8s resource
	for _, resource := range resources {
		seenUIDs[resource.UID] = true
		ciType := K8sResourceToCiType(resource.Kind)

		existingCI, exists := existingByUID[resource.UID]

		attributes := map[string]string{
			"k8s_uid":       resource.UID,
			"k8s_kind":      resource.Kind,
			"k8s_namespace": resource.Namespace,
			"k8s_api_version": resource.APIVersion,
			"k8s_status":    resource.Status,
		}

		tags := make([]string, 0)
		for k, v := range resource.Labels {
			tags = append(tags, fmt.Sprintf("%s=%s", k, v))
		}

		if !exists {
			// Create new CI
			input := &cmdb.CreateCIInput{
				CiID:        fmt.Sprintf("%s-%s-%s", resource.Kind, resource.Namespace, resource.Name),
				CiType:      ciType,
				Name:        resource.Name,
				Description: fmt.Sprintf("K8s %s in namespace %s", resource.Kind, resource.Namespace),
				Status:      "ACTIVE",
				Environment: resource.Namespace,
				Tags:        tags,
				Attributes:  attributes,
				TenantID:    r.tenantID,
				CreatedBy:   "k8s-reconciler",
			}

			_, err := r.cmdbService.CreateCI(input)
			if err != nil {
				r.statusMu.Lock()
				r.status.Errors++
				r.statusMu.Unlock()
				continue
			}

			r.statusMu.Lock()
			r.status.Added++
			r.statusMu.Unlock()
		} else {
			// Check if update needed
			updateNeeded := false
			input := &cmdb.UpdateCIInput{}

			if existingCI.Name != resource.Name {
				updateNeeded = true
				// Name is not updateable directly, update description instead
				input.Description = fmt.Sprintf("K8s %s in namespace %s", resource.Kind, resource.Namespace)
			}

			if existingCI.Status != "ACTIVE" && resource.Status == "Running" {
				updateNeeded = true
				input.Status = "ACTIVE"
			}

			// Always update attributes to keep them in sync
			updateNeeded = true
			input.Attributes = attributes
			input.Tags = tags

			if updateNeeded {
				_, err := r.cmdbService.UpdateCI(existingCI.ID, input)
				if err != nil {
					r.statusMu.Lock()
					r.status.Errors++
					r.statusMu.Unlock()
					continue
				}

				r.statusMu.Lock()
				r.status.Updated++
				r.statusMu.Unlock()
			}
		}
	}

	// Check for deleted resources
	for uid, ci := range existingByUID {
		if !seenUIDs[uid] {
			err := r.cmdbService.DeleteCI(ci.ID)
			if err != nil {
				r.statusMu.Lock()
				r.status.Errors++
				r.statusMu.Unlock()
				continue
			}

			r.statusMu.Lock()
			r.status.Deleted++
			r.statusMu.Unlock()
		}
	}

	// Update last sync time
	r.statusMu.Lock()
	r.status.LastSyncTime = time.Now().Format(time.RFC3339)
	r.statusMu.Unlock()

	return r.status, nil
}

// GetStatus returns the current sync status
func (r *Reconciler) GetStatus() *SyncStatus {
	r.statusMu.RLock()
	defer r.statusMu.RUnlock()

	return &SyncStatus{
		LastSyncTime:   r.status.LastSyncTime,
		ResourcesFound: r.status.ResourcesFound,
		Added:          r.status.Added,
		Updated:        r.status.Updated,
		Deleted:        r.status.Deleted,
		Errors:         r.status.Errors,
	}
}

// runReconciliation runs periodic reconciliation
func (r *Reconciler) runReconciliation(ctx context.Context, interval time.Duration) {
	defer r.wg.Done()

	// Initial sync
	r.SyncNow()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.stopCh:
			return
		case <-ticker.C:
			r.SyncNow()
		}
	}
}

// handleAdd handles K8s resource add events
func (r *Reconciler) handleAdd(resource K8sResource) {
	ciType := K8sResourceToCiType(resource.Kind)

	attributes := map[string]string{
		"k8s_uid":        resource.UID,
		"k8s_kind":       resource.Kind,
		"k8s_namespace":  resource.Namespace,
		"k8s_api_version": resource.APIVersion,
		"k8s_status":     resource.Status,
	}

	tags := make([]string, 0)
	for k, v := range resource.Labels {
		tags = append(tags, fmt.Sprintf("%s=%s", k, v))
	}

	input := &cmdb.CreateCIInput{
		CiID:        fmt.Sprintf("%s-%s-%s", resource.Kind, resource.Namespace, resource.Name),
		CiType:      ciType,
		Name:        resource.Name,
		Description: fmt.Sprintf("K8s %s in namespace %s", resource.Kind, resource.Namespace),
		Status:      "ACTIVE",
		Environment: resource.Namespace,
		Tags:        tags,
		Attributes:  attributes,
		TenantID:    r.tenantID,
		CreatedBy:   "k8s-reconciler",
	}

	_, err := r.cmdbService.CreateCI(input)
	if err != nil {
		fmt.Printf("Failed to create CI for K8s resource %s/%s: %v\n", resource.Namespace, resource.Name, err)
	}
}

// handleUpdate handles K8s resource update events
func (r *Reconciler) handleUpdate(oldResource, newResource K8sResource) {
	// Find existing CI by K8s UID
	existingCIs, _, err := r.cmdbService.ListCIs("", "", "", 1, 10000, r.tenantID)
	if err != nil {
		return
	}

	var existingCI *cmdb.CI
	for i := range existingCIs {
		ci := &existingCIs[i]
		if uid, ok := ci.Attributes["k8s_uid"]; ok && uid == newResource.UID {
			existingCI = ci
			break
		}
	}

	if existingCI == nil {
		// Resource doesn't exist, treat as add
		r.handleAdd(newResource)
		return
	}

	attributes := map[string]string{
		"k8s_uid":        newResource.UID,
		"k8s_kind":       newResource.Kind,
		"k8s_namespace":  newResource.Namespace,
		"k8s_api_version": newResource.APIVersion,
		"k8s_status":     newResource.Status,
	}

	tags := make([]string, 0)
	for k, v := range newResource.Labels {
		tags = append(tags, fmt.Sprintf("%s=%s", k, v))
	}

	input := &cmdb.UpdateCIInput{
		Attributes: attributes,
		Tags:       tags,
	}

	_, err = r.cmdbService.UpdateCI(existingCI.ID, input)
	if err != nil {
		fmt.Printf("Failed to update CI for K8s resource %s/%s: %v\n", newResource.Namespace, newResource.Name, err)
	}
}

// handleDelete handles K8s resource delete events
func (r *Reconciler) handleDelete(resource K8sResource) {
	// Find existing CI by K8s UID
	existingCIs, _, err := r.cmdbService.ListCIs("", "", "", 1, 10000, r.tenantID)
	if err != nil {
		return
	}

	for i := range existingCIs {
		ci := &existingCIs[i]
		if uid, ok := ci.Attributes["k8s_uid"]; ok && uid == resource.UID {
			err := r.cmdbService.DeleteCI(ci.ID)
			if err != nil {
				fmt.Printf("Failed to delete CI for K8s resource %s/%s: %v\n", resource.Namespace, resource.Name, err)
			}
			return
		}
	}
}