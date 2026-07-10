package mfa

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// TOTP Configuration (matches Node.js MfaService)
// ---------------------------------------------------------------------------

const (
	TotpSecretLength = 20       // 20 bytes = 160 bits (RFC 4226 recommendation)
	TotpDigits       = 6        // 6-digit OTP (standard)
	TotpPeriod       = 30       // 30-second time step (RFC 6238)
	TotpWindow       = 1        // Allow ±1 time step for clock drift
	BackupCodeCount  = 10
	BackupCodeLength = 10       // 10-character alphanumeric codes
)

var (
	// ErrInvalidCredentials indicates an invalid TOTP or backup code.
	ErrInvalidCredentials = errors.New("invalid MFA code")
	// ErrMfaNotEnabled indicates MFA is not set up for this user.
	ErrMfaNotEnabled = errors.New("MFA is not set up for this user")
	// ErrMfaAlreadyEnabled indicates MFA is already enabled.
	ErrMfaAlreadyEnabled = errors.New("MFA is already enabled for this user")
)

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

// SetupResult is returned by SetupMFA.
type SetupResult struct {
	Secret       string   `json:"secret"`       // Base32-encoded TOTP secret (plaintext, for QR)
	QRCodeUri    string   `json:"qr_code_uri"`  // otpauth:// URI for authenticator app
	BackupCodes  []string `json:"backup_codes"` // Plaintext backup codes (shown once)
}

// VerifyResult is returned by VerifyTOTP / VerifyMFA.
type VerifyResult struct {
	Success        bool   `json:"success"`
	UsedBackupCode bool   `json:"used_backup_code"`
	RemainingCodes int    `json:"remaining_backup_codes"`
}

// ---------------------------------------------------------------------------
// TOTP Implementation (RFC 6238, pure stdlib)
// ---------------------------------------------------------------------------

// EncodeBase32 encodes raw bytes to a Base32 string (RFC 4648, no padding).
func EncodeBase32(b []byte) string {
	enc := base32.StdEncoding.WithPadding(base32.NoPadding)
	return enc.EncodeToString(b)
}

// DecodeBase32 decodes a Base32 string to raw bytes.
func DecodeBase32(s string) ([]byte, error) {
	cleaned := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	enc := base32.StdEncoding.WithPadding(base32.NoPadding)
	return enc.DecodeString(cleaned)
}

// GenerateTotpSecret returns a random Base32-encoded TOTP secret.
func GenerateTotpSecret() (string, error) {
	raw := make([]byte, TotpSecretLength)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return EncodeBase32(raw), nil
}

// GenerateTOTP computes the 6-digit TOTP for a given Base32 secret and time step counter.
// Implements RFC 6238 / RFC 4226 using HMAC-SHA1.
func GenerateTOTP(secretBase32 string, counter uint64) string {
	secret, _ := DecodeBase32(secretBase32)
	if len(secret) == 0 {
		return "000000"
	}

	counterBuf := make([]byte, 8)
	binary.BigEndian.PutUint64(counterBuf, counter)

	mac := hmac.New(sha1.New, secret)
	mac.Write(counterBuf)
	digest := mac.Sum(nil)

	code := dynamicTruncation(digest)
	return padDigits(code, TotpDigits)
}

// dynamicTruncation extracts a 4-byte code from HMAC-SHA1 per RFC 4226 §5.3.
func dynamicTruncation(digest []byte) int {
	offset := int(digest[len(digest)-1] & 0x0f)
	binary := (
		(int(digest[offset]) & 0x7f) << 24 |
			(int(digest[offset+1]) & 0xff) << 16 |
			(int(digest[offset+2]) & 0xff) << 8 |
			(int(digest[offset+3]) & 0xff))
	return binary % int(math.Pow(10, float64(TotpDigits)))
}

// padDigits zero-pads a number to the specified digit count.
func padDigits(n, digits int) string {
	s := fmt.Sprintf("%d", n)
	if len(s) >= digits {
		return s
	}
	for len(s) < digits {
		s = "0" + s
	}
	return s
}

// CurrentCounter returns the current TOTP time-step counter.
func CurrentCounter() uint64 {
	return uint64(time.Now().Unix() / TotpPeriod)
}

// VerifyTOTPCode checks a 6-digit code against the secret with ±window drift.
// Returns (true, consumedBackupCode) — backupCode is always false here.
func VerifyTOTPCode(secretBase32 string, code string, window int) bool {
	cleaned := strings.ReplaceAll(code, " ", "")
	if len(cleaned) != TotpDigits || !isNumeric(cleaned) {
		return false
	}

	current := CurrentCounter()
	for i := 0; i <= window; i++ {
		// Check current + forward
		if GenerateTOTP(secretBase32, current+uint64(i)) == cleaned {
			return true
		}
		// Check current - backward
		if i > 0 && GenerateTOTP(secretBase32, current-uint64(i)) == cleaned {
			return true
		}
	}
	return false
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------
// Backup Codes
// ---------------------------------------------------------------------------

// GenerateBackupCodes returns N one-time use codes (unambiguous chars).
func GenerateBackupCodes(count int) []string {
	if count <= 0 {
		count = BackupCodeCount
	}
	codes := make([]string, 0, count)
	// Unambiguous alphabet: remove 0, O, I, l, 1
	alphabet := []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

	for i := 0; i < count; i++ {
		b := make([]byte, BackupCodeLength)
		_, _ = rand.Read(b)
		code := make([]byte, BackupCodeLength)
		for j := range b {
			code[j] = alphabet[b[j]%byte(len(alphabet))]
		}
		// Format as group-5: ABCDE-FGHIJ
		s := string(code)
		grouped := s[:5] + "-" + s[5:]
		codes = append(codes, grouped)
	}
	return codes
}

// HashBackupCode returns the SHA-256 hex digest of a backup code (normalized).
func HashBackupCode(code string) string {
	normalized := strings.ReplaceAll(code, "-", "")
	normalized = strings.ToUpper(normalized)
	h := sha256.Sum256([]byte(normalized))
	return fmt.Sprintf("%x", h[:])
}

// VerifyBackupCode checks a code against a list of stored hashes.
// On success it removes the consumed code and returns the remaining list.
func VerifyBackupCode(code string, storedHashes []string) (bool, []string) {
	normalized := strings.ReplaceAll(code, "-", "")
	normalized = strings.ToUpper(normalized)
	inputHash := HashBackupCode(normalized)

	for i, h := range storedHashes {
		if hmac.Equal([]byte(h), []byte(inputHash)) {
			// Remove consumed code
			remaining := make([]string, 0, len(storedHashes)-1)
			remaining = append(remaining, storedHashes[:i]...)
			remaining = append(remaining, storedHashes[i+1:]...)
			return true, remaining
		}
	}
	return false, storedHashes
}

// ---------------------------------------------------------------------------
// QR Code URI
// ---------------------------------------------------------------------------

// BuildQRCodeUri builds an otpauth://totp URI for an authenticator app.
func BuildQRCodeUri(secret, issuer, account string) string {
	params := url.Values{}
	params.Set("secret", secret)
	params.Set("issuer", issuer)
	params.Set("period", fmt.Sprintf("%d", TotpPeriod))
	params.Set("digits", fmt.Sprintf("%d", TotpDigits))
	params.Set("algorithm", "SHA1")

	label := url.QueryEscape(issuer) + ":" + url.QueryEscape(account)
	return "otpauth://totp/" + label + "?" + params.Encode()
}

// ---------------------------------------------------------------------------
// Mutex-protected in-memory login attempt tracker
// ---------------------------------------------------------------------------

// LoginAttemptTracker tracks per-username login failures and lockout state.
type LoginAttemptTracker struct {
	mu    sync.RWMutex
	data  map[string]*attemptState
	maxFails int
	lockoutDuration time.Duration
}

type attemptState struct {
	failures    int
	lastFailAt  time.Time
	lockoutUntil time.Time
}

// NewLoginAttemptTracker creates a tracker with the given thresholds.
func NewLoginAttemptTracker(maxFails int, lockoutDuration time.Duration) *LoginAttemptTracker {
	return &LoginAttemptTracker{
		data:            make(map[string]*attemptState),
		maxFails:        maxFails,
		lockoutDuration: lockoutDuration,
	}
}

// IsLocked returns true if the username is currently lockout-bound.
func (t *LoginAttemptTracker) IsLocked(username string) (bool, time.Duration) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	s := t.data[username]
	if s == nil {
		return false, 0
	}
	if s.lockoutUntil.IsZero() {
		return false, 0
	}
	if time.Now().After(s.lockoutUntil) {
		return false, 0
	}
	return true, time.Until(s.lockoutUntil)
}

// RecordFailure logs a failed login attempt for the given username.
// Returns (isLocked, remainingAttempts, lockoutRemaining).
func (t *LoginAttemptTracker) RecordFailure(username string) (bool, int, time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()

	s, ok := t.data[username]
	if !ok {
		s = &attemptState{}
		t.data[username] = s
	}

	s.lastFailAt = time.Now()

	if !s.lockoutUntil.IsZero() && time.Now().Before(s.lockoutUntil) {
		return true, 0, time.Until(s.lockoutUntil)
	}

	s.failures++
	remaining := t.maxFails - s.failures
	if s.failures >= t.maxFails {
		s.lockoutUntil = time.Now().Add(t.lockoutDuration)
		return true, 0, t.lockoutDuration
	}
	return false, remaining, 0
}

// RecordSuccess resets the failure count for the given username.
func (t *LoginAttemptTracker) RecordSuccess(username string) {
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

// Unlock manually clears lockout and failures for the given username.
func (t *LoginAttemptTracker) Unlock(username string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.data, username)
}

// Failures returns the current failure count for a username.
func (t *LoginAttemptTracker) Failures(username string) int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	s := t.data[username]
	if s == nil {
		return 0
	}
	return s.failures
}

// Cleanup removes expired lockout entries. Call periodically.
func (t *LoginAttemptTracker) Cleanup() int {
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
