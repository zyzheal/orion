package terminal

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session status constants
const (
	StatusConnecting = "CONNECTING"
	StatusActive     = "ACTIVE"
	StatusClosed     = "CLOSED"
)

// CMDBClient interface for fetching host information
type CMDBClient interface {
	GetHostByID(hostID string) (*HostInfo, error)
	GetHostCredentials(hostID string) (*HostCredentials, error)
}

// HostInfo represents host information from CMDB
type HostInfo struct {
	ID       string
	Hostname string
	IP       string
	Port     int
}

// HostCredentials represents login credentials for a host
type HostCredentials struct {
	Username string
	Password string
	PrivateKey []byte
}

// Manager manages SSH terminal sessions
type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*ManagedSession
	db       *gorm.DB
	cmdb     CMDBClient
}

// NewManager creates a new terminal session manager
func NewManager(db *gorm.DB, cmdbClient CMDBClient) *Manager {
	return &Manager{
		sessions: make(map[string]*ManagedSession),
		db:       db,
		cmdb:     cmdbClient,
	}
}

// CreateSession creates a new terminal session
func (m *Manager) CreateSession(ctx context.Context, hostID, sessionType, userID string) (*Session, error) {
	if hostID == "" {
		return nil, errors.New("hostID is required")
	}
	if userID == "" {
		return nil, errors.New("userID is required")
	}

	// Default to SSH session type
	if sessionType == "" {
		sessionType = string(SessionTypeSSH)
	}

	// Get host credentials from CMDB
	creds, err := m.cmdb.GetHostCredentials(hostID)
	if err != nil {
		return nil, fmt.Errorf("failed to get host credentials: %w", err)
	}

	// Get host info
	hostInfo, err := m.cmdb.GetHostByID(hostID)
	if err != nil {
		return nil, fmt.Errorf("failed to get host info: %w", err)
	}

	// Create SSH client
	sshConfig := &SSHConfig{
		Host:     hostInfo.IP,
		Port:     hostInfo.Port,
		User:     creds.Username,
		Password: creds.Password,
		Key:      creds.PrivateKey,
	}

	sshClient, err := NewSSHClient(sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH client: %w", err)
	}

	// Connect to SSH server
	if err := sshClient.Connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to SSH server: %w", err)
	}

	// Create session record
	session := &Session{
		ID:          uuid.New().String(),
		TenantID:    1, // TODO: Get from context
		UserID:      userID,
		HostID:      hostID,
		SessionType: sessionType,
		Status:      StatusConnecting,
		StartedAt:   time.Now(),
	}

	// Save to database if db is available
	if m.db != nil {
		if err := m.db.WithContext(ctx).Create(session).Error; err != nil {
			sshClient.Close()
			return nil, fmt.Errorf("failed to save session: %w", err)
		}
	}

	// Update status to active
	session.Status = StatusActive
	if m.db != nil {
		m.db.WithContext(ctx).Model(session).Update("status", StatusActive)
	}

	// Store managed session
	managedSession := &ManagedSession{
		Session: session,
		Client:  sshClient,
	}

	m.mu.Lock()
	m.sessions[session.ID] = managedSession
	m.mu.Unlock()

	return session, nil
}

// GetSession retrieves a managed session by ID
func (m *Manager) GetSession(sessionID string) (*ManagedSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	session, ok := m.sessions[sessionID]
	return session, ok
}

// CloseSession closes a terminal session
func (m *Manager) CloseSession(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[sessionID]
	if !ok {
		return errors.New("session not found")
	}

	// Close SSH client
	if session.Client != nil {
		session.Client.Close()
	}

	// Update session status
	now := time.Now()
	session.Session.Status = StatusClosed
	session.Session.ClosedAt = &now

	// Update in database
	if m.db != nil {
		m.db.Model(session.Session).Updates(map[string]interface{}{
			"status":    StatusClosed,
			"closed_at": now,
		})
	}

	// Remove from memory
	delete(m.sessions, sessionID)

	return nil
}

// ExecuteCommand executes a command in an existing session
func (m *Manager) ExecuteCommand(sessionID, command string) (string, string, int, error) {
	m.mu.RLock()
	session, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return "", "", -1, errors.New("session not found")
	}

	if session.Client == nil {
		return "", "", -1, errors.New("SSH client not available")
	}

	if !session.Client.IsConnected() {
		return "", "", -1, errors.New("SSH client not connected")
	}

	return session.Client.Execute(command)
}

// GetActiveSessions returns all active sessions
func (m *Manager) GetActiveSessions() []*ManagedSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*ManagedSession, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	return sessions
}

// CloseAll closes all active sessions
func (m *Manager) CloseAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var errs []error
	for id, session := range m.sessions {
		if session.Client != nil {
			if err := session.Client.Close(); err != nil {
				errs = append(errs, fmt.Errorf("session %s: %w", id, err))
			}
		}

		// Update in database
		if m.db != nil {
			now := time.Now()
			m.db.Model(session.Session).Updates(map[string]interface{}{
				"status":    StatusClosed,
				"closed_at": now,
			})
		}

		delete(m.sessions, id)
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}
	return nil
}

// GetSessionByID retrieves a session by ID from database
func (m *Manager) GetSessionByID(ctx context.Context, sessionID string) (*Session, error) {
	if m.db == nil {
		return nil, errors.New("database not configured")
	}

	var session Session
	if err := m.db.WithContext(ctx).First(&session, "id = ?", sessionID).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// ListSessions returns all sessions from database
func (m *Manager) ListSessions(ctx context.Context, tenantID int64, limit, offset int) ([]*Session, int64, error) {
	if m.db == nil {
		return nil, 0, errors.New("database not configured")
	}

	var sessions []*Session
	var total int64

	query := m.db.WithContext(ctx).Model(&Session{})

	if tenantID > 0 {
		query = query.Where("tenant_id = ?", tenantID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	if err := query.Order("started_at DESC").Limit(limit).Offset(offset).Find(&sessions).Error; err != nil {
		return nil, 0, err
	}

	return sessions, total, nil
}

// AutoCleanup removes stale sessions
func (m *Manager) AutoCleanup(maxIdleTime time.Duration) {
	ticker := time.NewTicker(maxIdleTime)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		for id, session := range m.sessions {
			if session.Client != nil && !session.Client.IsConnected() {
				now := time.Now()
				session.Session.Status = StatusClosed
				session.Session.ClosedAt = &now

				if m.db != nil {
					m.db.Model(session.Session).Updates(map[string]interface{}{
						"status":    StatusClosed,
						"closed_at": now,
					})
				}

				delete(m.sessions, id)
			}
		}
		m.mu.Unlock()
	}
}