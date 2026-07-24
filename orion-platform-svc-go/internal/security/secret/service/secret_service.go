package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log"
	"regexp"
	"sort"

	"orion/platform-svc-go/internal/secret/models"
	"orion/platform-svc-go/internal/secret/repository"

	"github.com/google/uuid"
)

var (
	ErrSecretNotFound    = errors.New("secret not found")
	ErrInvalidName       = errors.New("invalid secret name format")
	ErrNameTooLong       = errors.New("secret name must be 255 characters or less")
	ErrEncryptionKeyMissing = errors.New("ORION_SECRET_ENCRYPTION_KEY is required in production")
)

// secretRefPattern matches ${secrets.XXX} or ${secrets.XXX:default_value}
var secretRefPattern = regexp.MustCompile(`\$\{secrets\.([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}`)

// namePattern validates secret names: alphanumeric + underscores, starting with letter or underscore.
var namePattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// Service provides business logic for secret management.
type Service struct {
	repo          *repository.Repository
	encryptionKey []byte
}

// NewService creates a new Service. The encryptionKey is used for AES-256-GCM.
// If empty, a development fallback key is derived (not for production use).
func NewService(repo *repository.Repository, encryptionKey string) *Service {
	return &Service{
		repo:          repo,
		encryptionKey: deriveKey(encryptionKey),
	}
}

// ==================== CRUD ====================

// Create creates or upserts a secret with encryption.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSecretRequest) (*models.Secret, error) {
	if err := validateName(req.Name); err != nil {
		return nil, err
	}

	encrypted, err := s.encrypt(req.Value)
	if err != nil {
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	scope := models.SecretScope(req.Scope)
	if scope == "" {
		scope = models.ScopeProject
	}

	sec := &models.Secret{
		ID:      uuid.New().String(),
		TenantID: tenantID,
		Name:    req.Name,
		Value:   encrypted,
		Scope:   scope,
		Version: 1,
		Env:     req.Env,
	}
	if sec.Env == "" {
		sec.Env = "production"
	}
	if req.Description != "" {
		sec.Description = &req.Description
	}

	if err := s.repo.Create(ctx, sec); err != nil {
		return nil, err
	}

	log.Printf("secret created: tenant=%s name=%s scope=%s", tenantID, req.Name, scope)
	return sec, nil
}

// List returns secrets for a tenant, optionally filtered by scope.
// Values are NOT included in the response.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int, scope models.SecretScope) ([]models.Secret, error) {
	if scope != "" {
		return s.repo.ListByScope(ctx, tenantID, scope)
	}
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetByID returns a secret by tenant and ID. The encrypted value is NOT decrypted.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Secret, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// GetByIDWithDecryption returns a secret with the decrypted value.
func (s *Service) GetByIDWithDecryption(ctx context.Context, tenantID, id string) (*models.Secret, error) {
	sec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	decrypted, err := s.decrypt(sec.Value)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}
	sec.Value = decrypted
	return sec, nil
}

// GetByName returns a decrypted secret by tenant and name.
func (s *Service) GetByName(ctx context.Context, tenantID, name string, scope models.SecretScope) (*models.Secret, error) {
	sec, err := s.repo.FindByTenantAndName(ctx, tenantID, name, scope)
	if err != nil {
		return nil, err
	}
	decrypted, err := s.decrypt(sec.Value)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}
	sec.Value = decrypted
	return sec, nil
}

// Update updates a secret's value and/or description.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSecretRequest) (*models.Secret, error) {
	// Verify the secret exists and belongs to the tenant
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSecretNotFound
	}

	if req.Value != nil {
		encrypted, err := s.encrypt(*req.Value)
		if err != nil {
			return nil, fmt.Errorf("encryption failed: %w", err)
		}
		if err := s.repo.UpdateValue(ctx, tenantID, id, encrypted); err != nil {
			return nil, err
		}
	}

	if req.Description != nil {
		if err := s.repo.UpdateDescription(ctx, tenantID, id, req.Description); err != nil {
			return nil, err
		}
	}

	log.Printf("secret updated: tenant=%s id=%s", tenantID, id)
	_ = existing // used for validation above
	return s.repo.GetByID(ctx, tenantID, id)
}

// Delete removes a secret by tenant and ID.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// DeleteByID removes a secret by ID only.
func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}

// Count returns the total number of secrets for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ==================== Secret Reference Resolution ====================

// ResolveSecrets resolves ${secrets.XXX} references in a parameter map.
func (s *Service) ResolveSecrets(ctx context.Context, tenantID string, parameters map[string]string) (*models.ResolvedResult, error) {
	resolved := make(map[string]string, len(parameters))
	var unresolved []string
	resolvedCount := 0

	for key, value := range parameters {
		refs := extractRefs(value)
		if len(refs) == 0 {
			resolved[key] = value
			continue
		}

		resolvedValue := value
		for _, ref := range refs {
			secret, err := s.GetByName(ctx, tenantID, ref.name, "")
			if err == nil && secret != nil {
				resolvedValue = replaceRef(resolvedValue, ref.full, secret.Value)
				resolvedCount++
			} else if ref.defaultValue != "" {
				resolvedValue = replaceRef(resolvedValue, ref.full, ref.defaultValue)
			} else {
				unresolved = append(unresolved, ref.name)
				log.Printf("secret reference not resolved: tenant=%s name=%s", tenantID, ref.name)
			}
		}
		resolved[key] = resolvedValue
	}

	return &models.ResolvedResult{
		Parameters: resolved,
		Resolved:   resolvedCount,
		Unresolved: unresolved,
	}, nil
}

// ==================== Log Sanitization ====================

// SanitizeLine replaces all occurrences of secret values in a log line with "***".
func SanitizeLine(line string, secretValues []string) string {
	if len(secretValues) == 0 {
		return line
	}
	// Sort by length descending to match longer secrets first
	sorted := make([]string, len(secretValues))
	copy(sorted, secretValues)
	sort.Slice(sorted, func(i, j int) bool {
		return len(sorted[i]) > len(sorted[j])
	})
	result := line
	for _, v := range sorted {
		if v == "" {
			continue
		}
		// Use split/join to handle special characters
		result = splitJoin(result, v, "***")
	}
	return result
}

// ==================== Encryption ====================

// encrypt encrypts plaintext using AES-256-GCM.
// Returns base64-encoded IV(16) + authTag(16) + ciphertext.
func (s *Service) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	// ciphertext is nonce + encrypted data + auth tag
	return string(ciphertext), nil
}

// decrypt decrypts ciphertext produced by encrypt.
func (s *Service) decrypt(ciphertext string) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	data := []byte(ciphertext)
	if len(data) < nonceSize {
		return "", fmt.Errorf("invalid encrypted data: too short")
	}

	nonce, encrypted := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// ==================== Validation ====================

func validateName(name string) error {
	if name == "" {
		return ErrInvalidName
	}
	if len(name) > 255 {
		return ErrNameTooLong
	}
	if !namePattern.MatchString(name) {
		return ErrInvalidName
	}
	return nil
}

// ==================== Helpers ====================

// secretRef holds a parsed secret reference.
type secretRef struct {
	full         string
	name         string
	defaultValue string
}

func extractRefs(text string) []secretRef {
	matches := secretRefPattern.FindAllStringSubmatch(text, -1)
	var refs []secretRef
	for _, m := range matches {
		r := secretRef{full: m[0], name: m[1]}
		if len(m) > 2 {
			r.defaultValue = m[2]
		}
		refs = append(refs, r)
	}
	return refs
}

func replaceRef(text, old, replacement string) string {
	result := ""
	remaining := text
	for {
		idx := indexOf(remaining, old)
		if idx < 0 {
			result += remaining
			break
		}
		result += remaining[:idx] + replacement
		remaining = remaining[idx+len(old):]
	}
	return result
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func splitJoin(s, old, new string) string {
	result := ""
	remaining := s
	for {
		idx := indexOf(remaining, old)
		if idx < 0 {
			result += remaining
			break
		}
		result += remaining[:idx] + new
		remaining = remaining[idx+len(old):]
	}
	return result
}

func deriveKey(key string) []byte {
	if key == "" {
		log.Println("WARNING: no encryption key provided, using development fallback")
		h := sha256.Sum256([]byte("orion-dev-fallback-key-do-not-use-in-production"))
		return h[:]
	}
	// If 64 hex chars, decode directly
	if len(key) == 64 {
		var b [32]byte
		n, err := hexDecode(b[:], key)
		if err == nil && n == 32 {
			return b[:]
		}
	}
	// Otherwise SHA-256 derive
	h := sha256.Sum256([]byte(key))
	return h[:]
}

func hexDecode(dst []byte, src string) (int, error) {
	if len(src)%2 != 0 {
		return 0, fmt.Errorf("odd length hex string")
	}
	for i := 0; i < len(src); i += 2 {
		hi := hexVal(src[i])
		lo := hexVal(src[i+1])
		if hi < 0 || lo < 0 {
			return 0, fmt.Errorf("invalid hex char")
		}
		dst[i/2] = byte(hi<<4 | lo)
	}
	return len(src) / 2, nil
}

func hexVal(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	default:
		return -1
	}
}
