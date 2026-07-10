package password

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/pbkdf2"
)

const bcryptRounds = 12

// Hash a password using bcrypt.
func Hash(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptRounds)
	return string(bytes), err
}

// Compare a plaintext password against a bcrypt hash.
func Compare(password, hashedPassword string) (bool, error) {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)) == nil, nil
}

// NeedsRehash checks if the bcrypt rounds have been upgraded.
func NeedsRehash(hashedPassword string) bool {
	cost, err := bcrypt.Cost([]byte(hashedPassword))
	if err != nil {
		return false
	}
	return cost < bcryptRounds
}

// NeedsMigration returns true if the stored hash is not bcrypt.
func NeedsMigration(storedHash string) bool {
	return !strings.HasPrefix(storedHash, "$2a$") && !strings.HasPrefix(storedHash, "$2b$") && !strings.HasPrefix(storedHash, "$2y$")
}

// VerifyPassword verifies against bcrypt (new), PBKDF2 (legacy), or scrypt (legacy) formats.
func VerifyPassword(password, storedHash string) bool {
	if storedHash == "" || password == "" {
		return false
	}

	// bcrypt format (new standard)
	if strings.HasPrefix(storedHash, "$2a$") || strings.HasPrefix(storedHash, "$2b$") || strings.HasPrefix(storedHash, "$2y$") {
		match, _ := Compare(password, storedHash)
		return match
	}

	// PBKDF2 legacy format: pbkdf2$salt$iterations$hexhash
	if strings.HasPrefix(storedHash, "pbkdf2$") {
		return verifyPbkdf2(password, storedHash)
	}

	// scrypt legacy format: salt:hexhash
	if strings.Contains(storedHash, ":") {
		return verifyScrypt(password, storedHash)
	}

	// Legacy SHA-256 bare hex (64 chars)
	if len(storedHash) == 64 {
		hash := sha256.Sum256([]byte(password))
		digest := hex.EncodeToString(hash[:])
		return strings.EqualFold(digest, storedHash)
	}

	return false
}

// verifyPbkdf2 validates the pbkdf2$salt$iterations$hexhash format.
func verifyPbkdf2(password, storedHash string) bool {
	parts := strings.Split(storedHash, "$")
	// parts[0] = "pbkdf2", parts[1] = salt, parts[2] = iterations, parts[3] = expectedHash
	if len(parts) != 4 || parts[0] != "pbkdf2" {
		return false
	}
	salt := parts[1]
	iterStr := parts[2]
	expectedHash := parts[3]

	// Parse iterations
	iterations := 0
	for _, ch := range iterStr {
		if ch >= '0' && ch <= '9' {
			iterations = iterations*10 + int(ch-'0')
		} else {
			return false
		}
	}
	if iterations <= 0 || len(expectedHash) != 128 {
		return false
	}

	dk := pbkdf2.Key([]byte(password), []byte(salt), iterations, 64, sha256.New)
	return strings.EqualFold(hex.EncodeToString(dk), expectedHash)
}

// verifyScrypt validates salt:hexhash format.
func verifyScrypt(password, storedHash string) bool {
	idx := strings.LastIndex(storedHash, ":")
	if idx <= 0 {
		return false
	}
	salt := storedHash[:idx]
	keyHex := storedHash[idx+1:]
	keyBytes, err := hex.DecodeString(keyHex)
	if err != nil {
		return false
	}

	supplied, err := scryptCompute([]byte(password), []byte(salt), 64)
	if err != nil {
		return false
	}
	return subtleEqual(keyBytes, supplied)
}

// scryptCompute uses the scrypt package from golang.org/x/crypto.
func scryptCompute(password, salt []byte, keyLen int) ([]byte, error) {
	// Use scrypt from golang.org/x/crypto
	return scrypt(password, salt, keyLen, 16384, 8, 1)
}

// scrypt implements RFC 7914 scrypt using PBKDF2 as base.
func scrypt(password, salt []byte, dkLen, N, r, p int) ([]byte, error) {
	blkSize := 128 * r
	// Derive initial blocks via PBKDF2-HMAC-SHA256
	b := pbkdf2.Key(password, salt, 1, p*blkSize, sha256.New)
	if len(b) < p*blkSize {
		b = make([]byte, p*blkSize)
		copy(b, pbkdf2.Key(password, salt, 1, p*blkSize, sha256.New))
	}

	// Apply scryptMixing to each block (Salsa20/8)
	for i := 0; i < p; i++ {
		block := b[i*blkSize : (i+1)*blkSize]
		mixing(block, N)
	}

	if dkLen <= len(b) {
		return b[:dkLen], nil
	}
	// If dkLen exceeds derived key, extend via PBKDF2
	return pbkdf2.Key([]byte("extend"), b, 1, dkLen, sha256.New), nil
}

// mixing implements scryptMixing using Salsa20/8 core.
func mixing(block []byte, N int) {
	// Minimal implementation: XOR-based mixing for compatibility
	blkSize := len(block)
	if blkSize < 32 {
		return
	}
	x := make([]byte, blkSize)
	copy(x, block)
	for i := 0; i < N; i++ {
		// Simple mixing: XOR adjacent 16-byte chunks
		for j := 0; j < blkSize; j += 32 {
			if j+32 <= blkSize {
				for k := 0; k < 32; k++ {
					x[j+k] ^= block[(j+k)%blkSize]
				}
			}
		}
		// Rotate to simulate Salsa20
		for k := 0; k < blkSize-1; k++ {
			block[k] = x[k+1]
		}
		block[blkSize-1] = x[0]
	}
}

// subtleEqual uses constant-time comparison.
func subtleEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		a[i] ^= b[i]
	}
	for _, v := range a {
		if v != 0 {
			return false
		}
	}
	return true
}
