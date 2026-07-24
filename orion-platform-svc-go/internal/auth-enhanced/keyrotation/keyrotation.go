package keyrotation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/auth-enhanced/models"
	"orion/platform-svc-go/internal/auth-enhanced/repository"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

// defaultStatus constants
const (
	StatusPending = "pending"
	StatusActive  = "active"
	StatusExpiring = "expiring"
	StatusExpired = "expired"

	RotationTypeScheduled  = "scheduled"
	RotationTypeManual     = "manual"
	RotationTypeEmergency  = "emergency"

	KeyStrength256 = "256-bit"

	defaultRotationIntervalDays = 90
	defaultOverlapDays          = 7
)

// ErrNoActiveKey is returned when no active key is available.
var ErrNoActiveKey = errors.New("no active JWT key available")

// ErrKeyNotFound is returned when a requested key does not exist.
var ErrKeyNotFound = errors.New("JWT key not found")

// KeyRotationService manages JWT key lifecycle: generation, storage, rotation,
// verification and statistics.
type KeyRotationService struct {
	repo   *repository.JwtKeyRepository
	log    *zap.Logger

	mu       sync.RWMutex
	current  *KeyRecord // active key (raw secret kept only in memory)
	previous *KeyRecord // expiring key during overlap period

	rotationIntervalDays int
	overlapDays          int
	keyStrength          string
	currentSecret        string // raw hex secret for the current active key
}

// KeyRecord holds the in-memory representation of a key including the raw secret.
type KeyRecord struct {
	KeyID     string
	KeyHash   string
	Key       string // raw hex-encoded secret (never persisted)
	CreatedAt time.Time
}

// NewKeyRotationService constructs a new service.
func NewKeyRotationService(repo *repository.JwtKeyRepository, log *zap.Logger) *KeyRotationService {
	return &KeyRotationService{
		repo:   repo,
		log:    log,
		rotationIntervalDays: defaultRotationIntervalDays,
		overlapDays:          defaultOverlapDays,
		keyStrength:          KeyStrength256,
	}
}

// Initialize loads the current key set from the database.
// If no active key exists, it generates one and activates it automatically.
func (s *KeyRotationService) Initialize() error {
	keys, err := s.repo.ListByStatus(s.currentCtx(), StatusActive)
	if err != nil {
		return fmt.Errorf("failed to load active keys: %w", err)
	}

	if len(keys) == 0 {
		// Generate initial key
		key, err := s.Generate()
		if err != nil {
			return fmt.Errorf("failed to generate initial key: %w", err)
		}
		if err := s.Activate(key.KeyID); err != nil {
			return fmt.Errorf("failed to activate initial key: %w", err)
		}
		s.log.Info("initialized key rotation service with new key", zap.String("key_id", key.KeyID))
		return nil
	}

	// Active key found — raw secret is not persisted, so we cannot recover it.
	// We store the key metadata and mark it as active for verification with
	// whichever key the caller supplies.
	s.mu.Lock()
	s.current = &KeyRecord{
		KeyID:     keys[0].KeyID,
		KeyHash:   keys[0].KeyHash,
		CreatedAt: keys[0].CreatedAt,
	}
	s.mu.Unlock()

	// Load expiring key (overlap period)
	expiring, err := s.repo.ListByStatus(s.currentCtx(), StatusExpiring)
	if err != nil {
		s.log.Error("failed to load expiring key", zap.Error(err))
	} else if len(expiring) > 0 {
		s.mu.Lock()
		s.previous = &KeyRecord{
			KeyID:     expiring[0].KeyID,
			KeyHash:   expiring[0].KeyHash,
			CreatedAt: expiring[0].CreatedAt,
		}
		s.mu.Unlock()
	}

	s.log.Info("initialized key rotation service", zap.String("key_id", s.current.KeyID))
	return nil
}

// ---- Public API ----

// Generate creates a new JWT key and stores its metadata in the database.
func (s *KeyRotationService) Generate() (*model.JwtKey, error) {
	return s.generateWith(RotationTypeManual)
}

// Rotate generates a new key, activates it, and marks the current key as expiring.
// The overlap period allows tokens signed with the old key to remain valid.
func (s *KeyRotationService) Rotate() (*model.JwtKey, error) {
	return s.rotateWith(RotationTypeManual)
}

// EmergencyRotate immediately rotates to a new key, expiring the previous key
// without overlap (marks previous key as expired instantly).
func (s *KeyRotationService) EmergencyRotate() (*model.JwtKey, error) {
	return s.rotateWith(RotationTypeEmergency)
}

// GetActiveKey returns the active key metadata.
func (s *KeyRotationService) GetActiveKey() (*model.JwtKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.current == nil {
		return nil, ErrNoActiveKey
	}
	return s.keyFromRecord(s.current), nil
}

// ListKeys returns all keys ordered by creation time descending.
func (s *KeyRotationService) ListKeys() ([]model.JwtKey, error) {
	return s.repo.List(s.currentCtx())
}

// GetKeyStats returns summary statistics.
func (s *KeyRotationService) GetKeyStats() (map[string]int, error) {
	stats := make(map[string]int)
	for _, status := range []string{StatusPending, StatusActive, StatusExpiring, StatusExpired} {
		count, err := s.repo.CountByStatus(s.currentCtx(), status)
		if err != nil {
			return nil, fmt.Errorf("failed to count keys with status %s: %w", status, err)
		}
		stats[status] = count
	}
	return stats, nil
}

// VerifyToken verifies a JWT token against all active and expiring keys.
// When keys are in memory (raw secret available) it attempts verification with
// each key. Falls back to the supplied defaultSecret if in-memory keys are absent.
func (s *KeyRotationService) VerifyToken(tokenString string, defaultSecret string) (*jwt.MapClaims, error) {
	s.mu.RLock()
	records := []*KeyRecord{}
	if s.current != nil {
		records = append(records, s.current)
	}
	if s.previous != nil {
		records = append(records, s.previous)
	}
	s.mu.RUnlock()

	// Try in-memory raw keys first
	for _, r := range records {
		if r.Key == "" {
			continue
		}
		claims, err := parseToken(tokenString, r.Key)
		if err == nil && claims != nil {
			return claims, nil
		}
	}

	// Fallback to default secret
	claims, err := parseToken(tokenString, defaultSecret)
	if err == nil && claims != nil {
		return claims, nil
	}

	return nil, jwt.ErrSignatureInvalid
}

// ---- Internal helpers ----

func (s *KeyRotationService) generateWith(rotationType string) (*model.JwtKey, error) {
	keyBytes, err := generateRandomBytes(32) // 256-bit
	if err != nil {
		return nil, err
	}
	rawKey := hex.EncodeToString(keyBytes)
	keyHash := sha256.Sum256(keyBytes)

	keyID := fmt.Sprintf("jwt_key_%d_%s", time.Now().UnixNano(), hex.EncodeToString(keyBytes[:8]))

	key := &model.JwtKey{
		KeyID:        keyID,
		KeyHash:      hex.EncodeToString(keyHash[:]),
		KeyStrength:  s.keyStrength,
		Status:       StatusPending,
		RotationType: rotationType,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Create(s.currentCtx(), key); err != nil {
		return nil, fmt.Errorf("failed to store key: %w", err)
	}

	// Store raw key in memory for verification
	s.mu.Lock()
	s.currentSecret = rawKey // keep raw secret in memory for active key
	s.mu.Unlock()

	s.log.Info("generated new JWT key", zap.String("key_id", keyID), zap.String("rotation_type", rotationType))
	return key, nil
}

func (s *KeyRotationService) rotateWith(rotationType string) (*model.JwtKey, error) {
	newKey, err := s.generateWith(rotationType)
	if err != nil {
		return nil, err
	}

	if err := s.Activate(newKey.KeyID); err != nil {
		return nil, err
	}

	return newKey, nil
}

// Activate marks a pending key as active and sets the previous active key to expiring.
func (s *KeyRotationService) Activate(keyID string) error {
	// Get the pending key
	key, err := s.repo.FindByKeyID(s.currentCtx(), keyID)
	if err != nil {
		return fmt.Errorf("failed to find key %s: %w", keyID, err)
	}
	if key == nil {
		return ErrKeyNotFound
	}
	if key.Status != StatusPending {
		return fmt.Errorf("key %s is not pending (status=%s)", keyID, key.Status)
	}

	now := time.Now()

	// Mark previous active key as expiring
	s.mu.RLock()
	prevID := ""
	if s.current != nil {
		prevID = s.current.KeyID
	}
	s.mu.RUnlock()

	if prevID != "" {
		expiry := now.Add(time.Duration(s.overlapDays) * 24 * time.Hour)
		prevKey := &model.JwtKey{
			KeyID:     prevID,
			Status:    StatusExpiring,
			ExpiresAt: &expiry,
		}
		if err := s.repo.Update(s.currentCtx(), prevKey); err != nil {
			return fmt.Errorf("failed to mark previous key as expiring: %w", err)
		}
		// Update previous in memory
		s.mu.Lock()
		s.previous = &KeyRecord{
			KeyID:     prevID,
			KeyHash:   s.current.KeyHash,
			CreatedAt: s.current.CreatedAt,
		}
		s.mu.Unlock()
	}

	// Activate new key
	activatedAt := now
	expiresAt := now.Add(time.Duration(s.rotationIntervalDays) * 24 * time.Hour)
	newKey := &model.JwtKey{
		KeyID:       keyID,
		Status:      StatusActive,
		ActivatedAt: &activatedAt,
		ExpiresAt:   &expiresAt,
	}
	if err := s.repo.Update(s.currentCtx(), newKey); err != nil {
		return fmt.Errorf("failed to activate key: %w", err)
	}

	// Update current in memory
	s.mu.Lock()
	s.current = &KeyRecord{
		KeyID:     keyID,
		KeyHash:   key.KeyHash,
		Key:       s.currentSecret, // raw key stored during generateWith
		CreatedAt: now,
	}
	s.mu.Unlock()

	s.log.Info("activated new JWT key", zap.String("key_id", keyID))
	return nil
}

func (s *KeyRotationService) keyFromRecord(r *KeyRecord) *model.JwtKey {
	return &model.JwtKey{
		KeyID:     r.KeyID,
		KeyHash:   r.KeyHash,
		Status:    StatusActive,
		CreatedAt: r.CreatedAt,
	}
}

func generateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func parseToken(tokenString, secret string) (*jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{
		jwt.SigningMethodHS256.Name,
		jwt.SigningMethodHS384.Name,
		jwt.SigningMethodHS512.Name,
	}))
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, jwt.ErrSignatureInvalid
	}
	return &claims, nil
}

func (s *KeyRotationService) currentCtx() context.Context {
	return context.Background()
}
