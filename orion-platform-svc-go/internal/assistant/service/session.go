package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/assistant/models"
)

// SessionStore persists conversation sessions. In-memory implementation is
// the default; a PostgreSQL-backed store can be substituted.
type SessionStore interface {
	Get(ctx context.Context, sessionID, tenantID string) (*models.Session, error)
	Save(ctx context.Context, session *models.Session) error
	ListByUser(ctx context.Context, tenantID, userID string, limit int) ([]*models.Session, error)
	Delete(ctx context.Context, sessionID, tenantID string) error
}

// InMemorySessionStore is the default store, suitable for dev and testing.
type InMemorySessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*models.Session
}

func NewInMemorySessionStore() *InMemorySessionStore {
	return &InMemorySessionStore{sessions: make(map[string]*models.Session)}
}

func (s *InMemorySessionStore) Get(_ context.Context, sessionID, tenantID string) (*models.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[sessionID]
	if !ok || sess.TenantID != tenantID {
		return nil, fmt.Errorf("session %q not found", sessionID)
	}
	return sess, nil
}

func (s *InMemorySessionStore) Save(_ context.Context, session *models.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
	return nil
}

func (s *InMemorySessionStore) ListByUser(_ context.Context, tenantID, userID string, limit int) ([]*models.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 {
		limit = 20
	}
	var result []*models.Session
	for _, sess := range s.sessions {
		if sess.TenantID != tenantID || sess.UserID != userID {
			continue
		}
		result = append(result, sess)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}

func (s *InMemorySessionStore) Delete(_ context.Context, sessionID, tenantID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[sessionID]
	if !ok || sess.TenantID != tenantID {
		return fmt.Errorf("session %q not found", sessionID)
	}
	delete(s.sessions, sessionID)
	return nil
}

// SessionManager wraps the store and exposes session lifecycle operations
// that the assistant Service uses to maintain multi-turn context.
type SessionManager struct {
	store       SessionStore
	maxTurns    int
	maxAge      time.Duration
}

// NewSessionManager creates a manager with the given store.
// Default: maxTurns=50, maxAge=7*24h.
func NewSessionManager(store SessionStore, opts ...SessionManagerOpt) *SessionManager {
	m := &SessionManager{
		store:    store,
		maxTurns: 50,
		maxAge:   7 * 24 * time.Hour,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

type SessionManagerOpt func(*SessionManager)

func WithMaxTurns(n int) SessionManagerOpt {
	return func(m *SessionManager) { m.maxTurns = n }
}

func WithMaxAge(d time.Duration) SessionManagerOpt {
	return func(m *SessionManager) { m.maxAge = d }
}

// GetOrCreate retrieves an existing session or creates a new one.
func (m *SessionManager) GetOrCreate(ctx context.Context, sessionID, tenantID, userID string) (*models.Session, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("session_id is required")
	}
	sess, err := m.store.Get(ctx, sessionID, tenantID)
	if err == nil {
		return sess, nil
	}
	// Create new
	sess = &models.Session{
		ID:        sessionID,
		TenantID:  tenantID,
		UserID:    userID,
		Messages:  []models.Message{},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := m.store.Save(ctx, sess); err != nil {
		return nil, err
	}
	return sess, nil
}

// AppendTurn adds a user query + assistant answer to the session history,
// pruning old turns beyond maxTurns.
func (m *SessionManager) AppendTurn(ctx context.Context, sessionID, tenantID string, question, answer string) error {
	sess, err := m.store.Get(ctx, sessionID, tenantID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	sess.Messages = append(sess.Messages,
		models.Message{Role: "user", Content: question, Timestamp: now},
		models.Message{Role: "assistant", Content: answer, Timestamp: now},
	)
	// Prune oldest turns if over max
	if len(sess.Messages) > m.maxTurns {
		sess.Messages = sess.Messages[len(sess.Messages)-m.maxTurns:]
	}
	sess.UpdatedAt = now
	return m.store.Save(ctx, sess)
}

// GetContextWindow returns the last N messages from a session for context injection.
// If sessionID is empty or the session is not found, returns nil.
func (m *SessionManager) GetContextWindow(ctx context.Context, sessionID, tenantID string, windowSize int) []models.Message {
	if sessionID == "" {
		return nil
	}
	sess, err := m.store.Get(ctx, sessionID, tenantID)
	if err != nil {
		return nil
	}
	if windowSize <= 0 {
		windowSize = 6
	}
	n := len(sess.Messages)
	if n <= windowSize {
		return sess.Messages
	}
	return sess.Messages[n-windowSize:]
}

// DeleteSession removes a session.
func (m *SessionManager) DeleteSession(ctx context.Context, sessionID, tenantID string) error {
	return m.store.Delete(ctx, sessionID, tenantID)
}