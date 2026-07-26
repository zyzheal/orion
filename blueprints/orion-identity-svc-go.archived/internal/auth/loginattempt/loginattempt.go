package loginattempt

import (
	"errors"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

// ErrLockout is returned when a username has exceeded the allowed failure count.
var ErrLockout = errors.New("account temporarily locked due to too many failed login attempts")

// Config holds thresholds for the LoginAttemptTracker.
type Config struct {
	// MaxFailures is the number of failures before lockout kicks in.
	MaxFailures int
	// LockoutDuration is how long the lockout lasts after max failures.
	LockoutDuration time.Duration
}

// DefaultConfig returns a sensible default.
func DefaultConfig() Config {
	return Config{
		MaxFailures:     5,
		LockoutDuration: 15 * time.Minute,
	}
}

// ---------------------------------------------------------------------------
// LoginAttemptTracker
// ---------------------------------------------------------------------------

// Tracker tracks per-username login failures and lockout state.
type Tracker struct {
	mu    sync.RWMutex
	data  map[string]*state
	cfg   Config
}

type state struct {
	failures     int
	lockoutUntil time.Time
	lastFailAt   time.Time
}

// NewTracker creates a new Tracker with the given config.
func NewTracker(cfg Config) *Tracker {
	return &Tracker{
		data: make(map[string]*state),
		cfg:  cfg,
	}
}

// IsLocked returns true if the username is currently under lockout.
// remaining is the time until lockout expires (zero when not locked).
func (t *Tracker) IsLocked(username string) (bool, time.Duration) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	s := t.data[username]
	if s == nil {
		return false, 0
	}
	if s.lockoutUntil.IsZero() || time.Now().After(s.lockoutUntil) {
		return false, 0
	}
	return true, time.Until(s.lockoutUntil)
}

// RecordFailure logs a single failed login attempt for the given username.
// Returns (isLocked, remainingAttempts, lockoutRemaining).
//
//   - isLocked: true once the failure count reaches MaxFailures
//   - remainingAttempts: how many more failures are allowed before lockout (0 when locked)
//   - lockoutRemaining: time until the lockout clears (0 when not locked)
func (t *Tracker) RecordFailure(username string) (bool, int, time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()

	s, ok := t.data[username]
	if !ok {
		s = &state{}
		t.data[username] = s
	}

	s.lastFailAt = time.Now()

	// Already locked? do not increment further.
	if !s.lockoutUntil.IsZero() && time.Now().Before(s.lockoutUntil) {
		return true, 0, time.Until(s.lockoutUntil)
	}

	s.failures++
	remaining := t.cfg.MaxFailures - s.failures

	if s.failures >= t.cfg.MaxFailures {
		s.lockoutUntil = time.Now().Add(t.cfg.LockoutDuration)
		return true, 0, t.cfg.LockoutDuration
	}

	return false, remaining, 0
}

// RecordSuccess resets failure state for the given username (a successful login).
func (t *Tracker) RecordSuccess(username string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	s, ok := t.data[username]
	if !ok {
		return
	}
	s.failures = 0
	s.lockoutUntil = time.Time{}
	s.lastFailAt = time.Time{}
}

// Unlock manually clears the lockout state for the given username (admin use).
func (t *Tracker) Unlock(username string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.data, username)
}

// Failures returns the current failure count for the given username.
func (t *Tracker) Failures(username string) int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	s := t.data[username]
	if s == nil {
		return 0
	}
	return s.failures
}

// Cleanup removes entries whose lockout has expired.
// Intended to be called by a background goroutine or timer.
// Returns the number of removed entries.
func (t *Tracker) Cleanup() int {
	t.mu.Lock()
	defer t.mu.Unlock()

	removed := 0
	now := time.Now()
	for name, s := range t.data {
		if s.lockoutUntil.IsZero() || now.Before(s.lockoutUntil) {
			continue
		}
		delete(t.data, name)
		removed++
	}
	return removed
}

// StartCleanupTicker starts a background goroutine that calls Cleanup every interval.
// It returns a stop function. Caller should call stop() during shutdown.
func (t *Tracker) StartCleanupTicker(interval time.Duration) func() {
	ticker := time.NewTicker(interval)
	stop := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				_ = t.Cleanup()
			case <-stop:
				ticker.Stop()
				return
			}
		}
	}()
	return func() { close(stop) }
}
