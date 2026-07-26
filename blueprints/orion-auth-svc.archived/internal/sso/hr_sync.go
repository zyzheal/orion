package sso

import (
	"context"
	"fmt"
	"time"
)

// HRSyncEngine synchronizes user data from HR systems.
// Handles new employees, transfers, and terminations.
type HRSyncEngine struct {
	store    HRSyncStore
	notifier HREventNotifier
	config   HRSyncConfig
}

// HRSyncConfig holds HR sync configuration.
type HRSyncConfig struct {
	// SyncInterval is how often to poll the HR system. Default: 1 hour.
	SyncInterval time.Duration `json:"sync_interval"`
	// DefaultRole is the role assigned to new employees. Default: "viewer".
	DefaultRole string `json:"default_role"`
	// DefaultStatus is the status for new employees. Default: "active".
	DefaultStatus string `json:"default_status"`
	// DisableOnTermination disables user accounts on termination. Default: true.
	DisableOnTermination bool `json:"disable_on_termination"`
}

// HRSyncStore provides persistence for HR sync operations.
type HRSyncStore interface {
	// UpsertUser creates or updates a user from HR data.
	UpsertUser(ctx context.Context, user *HRUser) error
	// DisableUser disables a user account.
	DisableUser(ctx context.Context, tenantID, userID string) error
	// GetUserByEmployeeID finds a user by their HR employee ID.
	GetUserByEmployeeID(ctx context.Context, tenantID, employeeID string) (*HRUser, error)
	// ListActiveUsers returns all active users for a tenant.
	ListActiveUsers(ctx context.Context, tenantID string) ([]*HRUser, error)
}

// HREventNotifier sends notifications about HR events.
type HREventNotifier interface {
	NotifyNewEmployee(ctx context.Context, user *HRUser) error
	NotifyTransfer(ctx context.Context, user *HRUser, oldDept, newDept string) error
	NotifyTermination(ctx context.Context, user *HRUser) error
}

// HRUser represents a user from the HR system.
type HRUser struct {
	EmployeeID   string    `json:"employee_id"`
	TenantID     string    `json:"tenant_id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Department   string    `json:"department"`
	Position     string    `json:"position"`
	ManagerID    string    `json:"manager_id"`
	HireDate     time.Time `json:"hire_date"`
	TerminationDate *time.Time `json:"termination_date,omitempty"`
	Status       string    `json:"status"` // "active", "terminated", "on_leave"
	Role         string    `json:"role"`
}

// SyncResult contains the result of an HR sync operation.
type SyncResult struct {
	Processed  int      `json:"processed"`
	Created    int      `json:"created"`
	Updated    int      `json:"updated"`
	Disabled   int      `json:"disabled"`
	Errors     []string `json:"errors,omitempty"`
	SyncedAt   time.Time `json:"synced_at"`
}

// NewHRSyncEngine creates a new HR sync engine.
func NewHRSyncEngine(store HRSyncStore, notifier HREventNotifier, config HRSyncConfig) *HRSyncEngine {
	if config.SyncInterval == 0 {
		config.SyncInterval = 1 * time.Hour
	}
	if config.DefaultRole == "" {
		config.DefaultRole = "viewer"
	}
	if config.DefaultStatus == "" {
		config.DefaultStatus = "active"
	}
	return &HRSyncEngine{
		store:    store,
		notifier: notifier,
		config:   config,
	}
}

// Sync processes a batch of HR user records.
func (e *HRSyncEngine) Sync(ctx context.Context, hrUsers []*HRUser) (*SyncResult, error) {
	result := &SyncResult{SyncedAt: time.Now().UTC()}

	for _, hrUser := range hrUsers {
		result.Processed++

		existing, err := e.store.GetUserByEmployeeID(ctx, hrUser.TenantID, hrUser.EmployeeID)
		if err != nil {
			// New employee
			if err := e.handleNewEmployee(ctx, hrUser); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("employee %s: %v", hrUser.EmployeeID, err))
				continue
			}
			result.Created++
			continue
		}

		// Check for termination
		if hrUser.Status == "terminated" && existing.Status != "terminated" {
			if err := e.handleTermination(ctx, hrUser); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("terminate %s: %v", hrUser.EmployeeID, err))
				continue
			}
			result.Disabled++
			continue
		}

		// Check for transfer
		if existing.Department != hrUser.Department {
			if err := e.handleTransfer(ctx, hrUser, existing.Department, hrUser.Department); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("transfer %s: %v", hrUser.EmployeeID, err))
				continue
			}
		}

		// Update existing user
		if err := e.store.UpsertUser(ctx, hrUser); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("update %s: %v", hrUser.EmployeeID, err))
			continue
		}
		result.Updated++
	}

	return result, nil
}

// handleNewEmployee creates a new user from HR data.
func (e *HRSyncEngine) handleNewEmployee(ctx context.Context, hrUser *HRUser) error {
	hrUser.Role = e.config.DefaultRole
	hrUser.Status = e.config.DefaultStatus

	if err := e.store.UpsertUser(ctx, hrUser); err != nil {
		return fmt.Errorf("create user: %w", err)
	}

	if e.notifier != nil {
		return e.notifier.NotifyNewEmployee(ctx, hrUser)
	}
	return nil
}

// handleTermination disables a user account.
func (e *HRSyncEngine) handleTermination(ctx context.Context, hrUser *HRUser) error {
	if e.config.DisableOnTermination {
		if err := e.store.DisableUser(ctx, hrUser.TenantID, hrUser.EmployeeID); err != nil {
			return fmt.Errorf("disable user: %w", err)
		}
	}

	if e.notifier != nil {
		return e.notifier.NotifyTermination(ctx, hrUser)
	}
	return nil
}

// handleTransfer handles department transfers.
func (e *HRSyncEngine) handleTransfer(ctx context.Context, hrUser *HRUser, oldDept, newDept string) error {
	if e.notifier != nil {
		return e.notifier.NotifyTransfer(ctx, hrUser, oldDept, newDept)
	}
	return nil
}

// StartPeriodicSync starts a periodic sync loop.
func (e *HRSyncEngine) StartPeriodicSync(ctx context.Context, fetchFn func(ctx context.Context) ([]*HRUser, error)) {
	ticker := time.NewTicker(e.config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			users, err := fetchFn(ctx)
			if err != nil {
				continue
			}
			_, _ = e.Sync(ctx, users)
		}
	}
}
