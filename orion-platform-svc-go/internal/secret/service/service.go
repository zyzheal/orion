package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"

	"orion/platform-svc-go/internal/secret/models"

	"github.com/google/uuid"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, s *models.Secret) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*models.Secret, error)
	GetByTenantAndName(ctx context.Context, tenantID, name, scope string) (*models.Secret, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.Secret, error)
	UpdateDescription(ctx context.Context, id string, description string) error
	UpdateValue(ctx context.Context, id string, encryptedValue []byte) error
}

// maskedValue is shown in list/get responses instead of the real secret.
const maskedValue = "***"

// Service coordinates business logic for secret management, including AES-256-GCM encryption.
type Service struct {
	repo          RepositoryInterface
	encryptionKey []byte
	secretRefRe   *regexp.Regexp
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo: repo,
		encryptionKey: func() []byte {
			h := sha256.Sum256([]byte("orion-dev-fallback-key-do-not-use-in-production"))
			return h[:]
		}(),
		secretRefRe: regexp.MustCompile(`\$\{secrets\.([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}`),
	}
}

// NewServiceWithKey creates a Service with a custom encryption key.
func NewServiceWithKey(repo RepositoryInterface, key string) *Service {
	return &Service{
		repo:          repo,
		encryptionKey: deriveKey(key),
		secretRefRe:   regexp.MustCompile(`\$\{secrets\.([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}`),
	}
}

// sentinel.NotFound is returned when a secret cannot be located.

// IsNotFound checks if an error is a not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

// SecretListItem is the metadata-only view of a secret (value excluded).
type SecretListItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Scope       string `json:"scope"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	CreatedBy   string `json:"created_by"`
	Value       string `json:"value"` // always masked as "***"
}

// SecretValue is the full secret including the decrypted value (internal use).
type SecretValue struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Value string `json:"value"`
	Scope string `json:"scope"`
}

// Create persists a new secret, encrypting the value before storage.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateSecretRequest) (*SecretListItem, error) {
	if err := validateSecretName(req.Name); err != nil {
		return nil, err
	}
	if req.Value == "" {
		return nil, fmt.Errorf("value is required")
	}

	encrypted, err := s.encrypt(req.Value)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt secret value: %w", err)
	}

	scope := req.Scope
	if scope == "" {
		scope = "project"
	}

	secret := &models.Secret{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Name:           req.Name,
		EncryptedValue: encrypted,
		Scope:          scope,
		Description:    req.Description,
		CreatedBy:      userID,
	}

	if err := s.repo.Create(ctx, secret); err != nil {
		return nil, fmt.Errorf("failed to create secret: %w", err)
	}

	return toSecretListItem(secret, maskedValue), nil
}

// List retrieves all secrets for a tenant (values masked).
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]SecretListItem, error) {
	secrets, err := s.repo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}
	items := make([]SecretListItem, len(secrets))
	for i, sec := range secrets {
		items[i] = *toSecretListItem(&sec, maskedValue)
	}
	return items, nil
}

// Get retrieves a secret by id (value masked).
func (s *Service) Get(ctx context.Context, id string) (*SecretListItem, error) {
	sec, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return toSecretListItem(sec, maskedValue), nil
}

// GetByName retrieves a secret by tenant/name/scope (value masked).
func (s *Service) GetByName(ctx context.Context, tenantID, name, scope string) (*SecretListItem, error) {
	sec, err := s.repo.GetByTenantAndName(ctx, tenantID, name, scope)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return toSecretListItem(sec, maskedValue), nil
}

// Update updates optional fields of a secret (value, description).
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSecretRequest) (*SecretListItem, error) {
	sec, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if sec.TenantID != tenantID {
		return nil, sentinel.NotFound
	}

	if req.Value != nil {
		encrypted, err := s.encrypt(*req.Value)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt secret value: %w", err)
		}
		if err := s.repo.UpdateValue(ctx, id, encrypted); err != nil {
			return nil, fmt.Errorf("failed to update secret value: %w", err)
		}
	}

	if req.Description != nil {
		if err := s.repo.UpdateDescription(ctx, id, *req.Description); err != nil {
			return nil, fmt.Errorf("failed to update secret description: %w", err)
		}
	}

	updated, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return toSecretListItem(updated, maskedValue), nil
}

// Delete removes a secret by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	sec, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return sentinel.NotFound
	}
	if sec.TenantID != tenantID {
		return sentinel.NotFound
	}
	return s.repo.Delete(ctx, id)
}

// Resolve resolves secret references in a set of parameters.
// Supports ${secrets.XXX} and ${secrets.XXX:default} syntax.
func (s *Service) Resolve(ctx context.Context, tenantID string, req *models.ResolveSecretsRequest) (*models.ResolveSecretsResult, error) {
	params := make(map[string]string)
	var unresolved []string
	resolvedCount := 0

	for key, value := range req.Parameters {
		if !strings.Contains(value, "${secrets.") {
			params[key] = value
			continue
		}
		resolvedValue, ok := s.resolveRefsInString(ctx, tenantID, value, &unresolved, &resolvedCount)
		if !ok {
			return nil, fmt.Errorf("failed to resolve secrets for parameter %s", key)
		}
		params[key] = resolvedValue
	}

	return &models.ResolveSecretsResult{
		Parameters: params,
		Resolved:   resolvedCount,
		Unresolved: unresolved,
	}, nil
}

// GetReferences retrieves a secret by id (used to build a reference pattern).
func (s *Service) GetReferences(ctx context.Context, id string) (*models.Secret, error) {
	sec, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return sec, nil
}

// getSecretValue retrieves a decrypted secret value by tenant and name.
func (s *Service) getSecretValue(ctx context.Context, tenantID, name string) (*SecretValue, error) {
	sec, err := s.repo.GetByTenantAndName(ctx, tenantID, name, "")
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || IsNotFound(err) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	plaintext, err := s.decrypt(sec.EncryptedValue)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt secret: %w", err)
	}
	return &SecretValue{ID: sec.ID, Name: sec.Name, Value: plaintext, Scope: sec.Scope}, nil
}

// resolveRefsInString replaces all ${secrets.XXX} references in a string.
func (s *Service) resolveRefsInString(ctx context.Context, tenantID, text string, unresolved *[]string, resolvedCount *int) (string, bool) {
	return string(s.secretRefRe.ReplaceAllFunc([]byte(text), func(match []byte) []byte {
		matches := s.secretRefRe.FindSubmatch(match)
		if len(matches) < 2 {
			return match
		}
		name := string(matches[1])
		defaultVal := string(matches[2])
		if len(matches) > 2 && matches[2] != nil {
			defaultVal = string(matches[2])
		}

		sec, err := s.getSecretValue(ctx, tenantID, name)
		if err == nil && sec != nil {
			*resolvedCount++
			return []byte(sec.Value)
		}
		if defaultVal != "" {
			return []byte(defaultVal)
		}
		*unresolved = append(*unresolved, name)
		return match
	})), true
}

// encrypt encrypts plaintext using AES-256-GCM.
// Output format: IV(12) + ciphertext + authTag (GCM tag appended by Seal).
func (s *Service) encrypt(plaintext string) ([]byte, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return aesGCM.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

// decrypt decrypts data produced by encrypt.
func (s *Service) decrypt(encrypted []byte) (string, error) {
	if len(encrypted) < 33 {
		return "", fmt.Errorf("invalid encrypted data: too short")
	}
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := aesGCM.NonceSize()
	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// deriveKey derives a 32-byte AES key from a string.
// A 64-char hex string is interpreted directly; otherwise SHA-256 is used.
func deriveKey(key string) []byte {
	if len(key) == 64 {
		if _, err := hex.DecodeString(key); err == nil {
			b, _ := hex.DecodeString(key)
			return b
		}
	}
	return func() []byte { h := func() []byte { h := sha256.Sum256([]byte(key)); return h[:] }(); return h[:] }()
}

// validateSecretName ensures the name matches [a-zA-Z_][a-zA-Z0-9_]*.
func validateSecretName(name string) error {
	if name == "" {
		return fmt.Errorf("name is required")
	}
	if len(name) > 255 {
		return fmt.Errorf("name must be 255 characters or less")
	}
	matched, _ := regexp.MatchString(`^[a-zA-Z_][a-zA-Z0-9_]*$`, name)
	if !matched {
		return fmt.Errorf("name must be alphanumeric with underscores (e.g., MY_SECRET_KEY)")
	}
	return nil
}

func toSecretListItem(sec *models.Secret, value string) *SecretListItem {
	return &SecretListItem{
		ID:          sec.ID,
		Name:        sec.Name,
		Scope:       sec.Scope,
		Description: sec.Description,
		CreatedAt:   sec.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   sec.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		CreatedBy:   sec.CreatedBy,
		Value:       value,
	}
}
