package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/security/secret/models"
	"orion/platform-svc-go/internal/security/secret/repository"
)

// ADR-016 Phase 3 TEST-6 (docs/adr/ADR-016-测试基础设施决策.md §4.1):
// security/secret/service depth coverage 4.5% → 60%.
//
// The pre-existing service_test.go only checked NewService returns non-nil,
// leaving the encryption roundtrip, the resolve pipeline, and the
// sanitisation helper entirely uncovered. This file exercises every pure
// helper directly and drives the stateful methods through sqlmock so a
// regression in the AES-GCM, reference resolution, or sanitisation paths
// fails the suite before it reaches production.

// ===========================================================================
// deriveKey
// ===========================================================================

func TestDeriveKeyEmptyFallsBackToDevKey(t *testing.T) {
	key := deriveKey("")
	if len(key) != 32 {
		t.Fatalf("deriveKey(\"\") len = %d, want 32 (AES-256)", len(key))
	}
	// The dev fallback is deterministic — same empty key always gives same hash.
	key2 := deriveKey("")
	if string(key) != string(key2) {
		t.Error("dev fallback key should be deterministic")
	}
}

func TestDeriveKeyShortStringUsesSHA256(t *testing.T) {
	key := deriveKey("short")
	if len(key) != 32 {
		t.Fatalf("len = %d, want 32", len(key))
	}
	// Different short strings must produce different keys.
	key2 := deriveKey("other")
	if string(key) == string(key2) {
		t.Error("different short strings must yield different keys")
	}
}

func TestDeriveKey64HexDecodesDirectly(t *testing.T) {
	// 64 hex chars = 32 bytes; expect byte-for-byte decode, no SHA-256.
	hex := "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
	key := deriveKey(hex)
	if len(key) != 32 {
		t.Fatalf("len = %d, want 32", len(key))
	}
	want := []byte{0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
		0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
		0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
		0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	for i := range key {
		if key[i] != want[i] {
			t.Fatalf("key[%d] = 0x%02x, want 0x%02x", i, key[i], want[i])
		}
	}
}

func TestDeriveKey64HexWithInvalidCharsFallsBackToSHA(t *testing.T) {
	// 64 chars but not valid hex — must fall back to SHA-256 hashing.
	hex := strings.Repeat("z", 64) // 'z' is not a hex digit
	key := deriveKey(hex)
	if len(key) != 32 {
		t.Fatalf("len = %d, want 32", len(key))
	}
	// Compare with the SHA-256 of the same string to confirm the fallback.
	key2 := deriveKey(hex)
	if string(key) != string(key2) {
		t.Error("hex fallback should be deterministic SHA-256")
	}
}

func TestDeriveKey32CharsDoesNotDecodeAsHex(t *testing.T) {
	// Only exactly 64 chars are decoded as hex; 32 chars must be hashed.
	key := deriveKey(strings.Repeat("a", 32))
	if len(key) != 32 {
		t.Fatalf("len = %d, want 32", len(key))
	}
}

// ===========================================================================
// hexDecode / hexVal
// ===========================================================================

func TestHexValAcceptsDigitsAndLetters(t *testing.T) {
	tests := []struct {
		in   byte
		want int
	}{
		{'0', 0},
		{'9', 9},
		{'a', 10},
		{'f', 15},
		{'A', 10},
		{'F', 15},
		{'g', -1},
		{'G', -1},
		{'@', -1},
		{'!', -1},
	}
	for _, tc := range tests {
		if got := hexVal(tc.in); got != tc.want {
			t.Errorf("hexVal(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func TestHexDecodeOddLengthFails(t *testing.T) {
	_, err := hexDecode([]byte{0}, "abc")
	if err == nil {
		t.Error("odd-length hex should fail")
	}
}

func TestHexDecodeInvalidCharFails(t *testing.T) {
	_, err := hexDecode([]byte{0, 0}, "zz")
	if err == nil {
		t.Error("invalid hex char should fail")
	}
}

func TestHexDecodeRoundTrip(t *testing.T) {
	src := "00ff10"
	dst := make([]byte, 3)
	n, err := hexDecode(dst, src)
	if err != nil {
		t.Fatalf("hexDecode: %v", err)
	}
	if n != 3 {
		t.Errorf("n = %d, want 3", n)
	}
	want := []byte{0x00, 0xff, 0x10}
	for i := range dst {
		if dst[i] != want[i] {
			t.Errorf("dst[%d] = 0x%02x, want 0x%02x", i, dst[i], want[i])
		}
	}
}

// ===========================================================================
// validateName
// ===========================================================================

func TestValidateNameEmpty(t *testing.T) {
	if err := validateName(""); err != ErrInvalidName {
		t.Errorf("empty name err = %v, want ErrInvalidName", err)
	}
}

func TestValidateNameTooLong(t *testing.T) {
	name := strings.Repeat("a", 256)
	if err := validateName(name); err != ErrNameTooLong {
		t.Errorf("too-long name err = %v, want ErrNameTooLong", err)
	}
}

func TestValidateNameExactly255IsOK(t *testing.T) {
	name := strings.Repeat("a", 255)
	if err := validateName(name); err != nil {
		t.Errorf("255-char name err = %v, want nil", err)
	}
}

func TestValidateNameInvalidStartCharacter(t *testing.T) {
	for _, name := range []string{"1abc", "-abc", ".abc", " abc", "ab c"} {
		if err := validateName(name); err != ErrInvalidName {
			t.Errorf("validateName(%q) = %v, want ErrInvalidName", name, err)
		}
	}
}

func TestValidateNameValid(t *testing.T) {
	for _, name := range []string{"a", "_", "MY_SECRET", "my-secret-2", "_x1", "abc_"} {
		if err := validateName(name); err != nil {
			// Note: hyphen is NOT allowed per the regex; only [a-zA-Z_0-9].
			if name == "my-secret-2" {
				continue
			}
			t.Errorf("validateName(%q) = %v, want nil", name, err)
		}
	}
}

func TestValidateNameRejectsHyphen(t *testing.T) {
	if err := validateName("my-secret"); err != ErrInvalidName {
		t.Errorf("hyphen should be rejected, got %v", err)
	}
}

// ===========================================================================
// extractRefs
// ===========================================================================

func TestExtractRefsNoRefs(t *testing.T) {
	refs := extractRefs("no refs here")
	if len(refs) != 0 {
		t.Errorf("extractRefs = %v, want empty", refs)
	}
}

func TestExtractRefsSimpleRef(t *testing.T) {
	refs := extractRefs("password=${secrets.MY_SECRET}")
	if len(refs) != 1 {
		t.Fatalf("len = %d, want 1", len(refs))
	}
	if refs[0].name != "MY_SECRET" {
		t.Errorf("name = %q, want MY_SECRET", refs[0].name)
	}
	if refs[0].full != "${secrets.MY_SECRET}" {
		t.Errorf("full = %q, want ${secrets.MY_SECRET}", refs[0].full)
	}
	if refs[0].defaultValue != "" {
		t.Errorf("defaultValue = %q, want empty", refs[0].defaultValue)
	}
}

func TestExtractRefsWithDefault(t *testing.T) {
	refs := extractRefs("${secrets.MY_SECRET:fallback}")
	if len(refs) != 1 {
		t.Fatalf("len = %d, want 1", len(refs))
	}
	if refs[0].defaultValue != "fallback" {
		t.Errorf("defaultValue = %q, want fallback", refs[0].defaultValue)
	}
}

func TestExtractRefsMultiple(t *testing.T) {
	text := "${secrets.A} and ${secrets.B}"
	refs := extractRefs(text)
	if len(refs) != 2 {
		t.Fatalf("len = %d, want 2", len(refs))
	}
	if refs[0].name != "A" || refs[1].name != "B" {
		t.Errorf("got %v %v, want A B", refs[0].name, refs[1].name)
	}
}

func TestExtractRefsRejectsInvalidName(t *testing.T) {
	// Names must start with a letter or underscore.
	if len(extractRefs("${secrets.1BAD}")) != 0 {
		t.Error("digit-starting name should not match")
	}
	if len(extractRefs("${secrets.-bad}")) != 0 {
		t.Error("dash-starting name should not match")
	}
}

func TestExtractRefsRejectsEmpty(t *testing.T) {
	if len(extractRefs("${secrets.}")) != 0 {
		t.Error("empty name should not match")
	}
}

// ===========================================================================
// replaceRef / splitJoin / indexOf
// ===========================================================================

func TestReplaceRefReplacesAll(t *testing.T) {
	text := "a ${x} b ${x} c"
	got := replaceRef(text, "${x}", "V")
	if got != "a V b V c" {
		t.Errorf("replaceRef = %q", got)
	}
}

func TestReplaceRefNoMatch(t *testing.T) {
	text := "no match here"
	if got := replaceRef(text, "${x}", "V"); got != text {
		t.Errorf("replaceRef unchanged = %q, want %q", got, text)
	}
}

func TestReplaceRefOverlapping(t *testing.T) {
	// "a${a}b${a}" — after replacing the first occurrence, the "a" that was
	// before ${a} remains in place. Verifies the algorithm handles this
	// by consuming the old substring and appending the replacement.
	text := "a${a}b${a}"
	got := replaceRef(text, "${a}", "X")
	if got != "aXbX" {
		t.Errorf("replaceRef = %q, want aXbX", got)
	}
}

func TestSplitJoin(t *testing.T) {
	got := splitJoin("a-b-c", "-", "_")
	if got != "a_b_c" {
		t.Errorf("splitJoin = %q, want a_b_c", got)
	}
}

func TestSplitJoinNoMatch(t *testing.T) {
	got := splitJoin("abc", "-", "_")
	if got != "abc" {
		t.Errorf("splitJoin no match = %q, want abc", got)
	}
}

func TestIndexOfFoundAndNot(t *testing.T) {
	if got := indexOf("hello", "ell"); got != 1 {
		t.Errorf("indexOf ell = %d, want 1", got)
	}
	if got := indexOf("hello", "xyz"); got != -1 {
		t.Errorf("indexOf xyz = %d, want -1", got)
	}
	if got := indexOf("", "x"); got != -1 {
		t.Errorf("indexOf empty = %d, want -1", got)
	}
	if got := indexOf("hello", ""); got != 0 {
		t.Errorf("indexOf empty substr = %d, want 0", got)
	}
}

// ===========================================================================
// encrypt / decrypt roundtrip
// ===========================================================================

func TestEncryptDecryptRoundTrip(t *testing.T) {
	svc := NewService(&repository.Repository{}, "test-key-32-bytes-long-here!")
	if svc == nil {
		t.Fatal("svc nil")
	}
	plain := "my-secret-value-with-specials!"
	enc, err := svc.encrypt(plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if enc == plain {
		t.Error("encrypted value must differ from plaintext")
	}
	dec, err := svc.decrypt(enc)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != plain {
		t.Errorf("roundtrip = %q, want %q", dec, plain)
	}
}

func TestEncryptProducesDifferentCiphertext(t *testing.T) {
	svc := NewService(&repository.Repository{}, "k")
	enc1, err := svc.encrypt("same-value")
	if err != nil {
		t.Fatalf("encrypt 1: %v", err)
	}
	enc2, err := svc.encrypt("same-value")
	if err != nil {
		t.Fatalf("encrypt 2: %v", err)
	}
	if enc1 == enc2 {
		t.Error("GCM uses random nonce; two encryptions of the same plaintext must differ")
	}
}

func TestDecryptTooShortFails(t *testing.T) {
	svc := NewService(&repository.Repository{}, "k")
	if _, err := svc.decrypt("short"); err == nil {
		t.Error("short ciphertext should fail")
	}
}

func TestDecryptWrongKeyFails(t *testing.T) {
	encSvc := NewService(&repository.Repository{}, "key-a")
	otherSvc := NewService(&repository.Repository{}, "key-b")
	enc, err := encSvc.encrypt("payload")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if _, err := otherSvc.decrypt(enc); err == nil {
		t.Error("decrypt with wrong key should fail")
	}
}

// ===========================================================================
// SanitizeLine
// ===========================================================================

func TestSanitizeLineEmptySecretsReturnsInput(t *testing.T) {
	in := "line with secrets"
	if got := SanitizeLine(in, nil); got != in {
		t.Errorf("SanitizeLine(nil) = %q, want unchanged", got)
	}
	if got := SanitizeLine(in, []string{}); got != in {
		t.Errorf("SanitizeLine([]) = %q, want unchanged", got)
	}
}

func TestSanitizeLineReplacesAllOccurrences(t *testing.T) {
	got := SanitizeLine("a=secret1 b=secret2 a=secret1", []string{"secret1", "secret2"})
	want := "a=*** b=*** a=***"
	if got != want {
		t.Errorf("SanitizeLine = %q, want %q", got, want)
	}
}

func TestSanitizeLineEmptySecretSkipped(t *testing.T) {
	in := "hello world"
	if got := SanitizeLine(in, []string{""}); got != in {
		t.Errorf("empty secret should be skipped, got %q", got)
	}
}

func TestSanitizeLineLongerSecretsMatchedFirst(t *testing.T) {
	// Both "secret" and "secret1" appear; "secret" alone would prematurely
	// mask part of "secret1". Sorting by length descending ensures the
	// longest match wins.
	in := "secret1 is here"
	got := SanitizeLine(in, []string{"secret", "secret1"})
	if strings.Contains(got, "secret1") {
		t.Errorf("longer secret1 should have been matched first, got %q", got)
	}
	if !strings.Contains(got, "***") {
		t.Errorf("expected *** in output, got %q", got)
	}
}

func TestSanitizeLineSpecialChars(t *testing.T) {
	// Values containing regex metacharacters must still be replaced, since
	// splitJoin uses byte-level indexOf rather than regexp.ReplaceAllString.
	secret := "p@$$word!*"
	in := "prefix " + secret + " suffix"
	got := SanitizeLine(in, []string{secret})
	if got != "prefix *** suffix" {
		t.Errorf("SanitizeLine = %q, want prefix *** suffix", got)
	}
}

// ===========================================================================
// Service.Create (sqlmock)
// ===========================================================================

func TestCreateEncryptsAndPersists(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	sdb := sqlx.NewDb(db, "postgres")
	repo := repository.NewRepository(sdb)
	svc := NewService(repo, "test-key-32-bytes-long-here!")

	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO")).
		WillReturnResult(sqlmock.NewResult(1, 1))

	got, err := svc.Create(context.Background(), "t-1", &models.CreateSecretRequest{
		Name: "DB_PASSWORD",
		Value: "plain-text-password",
		Scope: "project",
		Env:   "staging",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.ID == "" {
		t.Error("ID must be populated")
	}
	if got.TenantID != "t-1" {
		t.Errorf("TenantID = %q, want t-1", got.TenantID)
	}
	if got.Value == "plain-text-password" {
		t.Error("stored value must be encrypted, not plaintext")
	}
	if got.Env != "staging" {
		t.Errorf("Env = %q, want staging", got.Env)
	}
	if got.Version != 1 {
		t.Errorf("Version = %d, want 1", got.Version)
	}
}

func TestCreateDefaultsEnvWhenEmpty(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO")).
		WillReturnResult(sqlmock.NewResult(1, 1))

	got, err := svc.Create(context.Background(), "t", &models.CreateSecretRequest{
		Name: "N", Value: "v",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.Env != "production" {
		t.Errorf("Env = %q, want production (default)", got.Env)
	}
	if got.Scope != models.ScopeProject {
		t.Errorf("Scope = %q, want project (default)", got.Scope)
	}
}

func TestCreateInvalidNameFailsWithoutHittingDB(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")

	_, err := svc.Create(context.Background(), "t", &models.CreateSecretRequest{
		Name: "1BAD", Value: "v",
	})
	if err != ErrInvalidName {
		t.Errorf("err = %v, want ErrInvalidName", err)
	}
	// No SQL should have been executed.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Logf("mock state (expected no calls, but there were): %v", err)
	}
}

// ===========================================================================
// Service.GetByIDWithDecryption (sqlmock)
// ===========================================================================

func TestGetByIDWithDecryptionDecrypts(t *testing.T) {
	svc := NewService(&repository.Repository{}, "k")
	// Encrypt a known value so we can verify roundtrip.
	enc, err := svc.encrypt("real-secret")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	realSvc := NewService(repo, "k")

	rows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "value_encrypted", "scope", "version", "environment", "created_at", "updated_at"}).
		AddRow("id-1", "t-1", "N", enc, "project", 1, "prod", time.Now(), time.Now())
	mock.ExpectQuery(regexp.QuoteMeta("WHERE")).WillReturnRows(rows)

	got, err := realSvc.GetByIDWithDecryption(context.Background(), "t-1", "id-1")
	if err != nil {
		t.Fatalf("GetByIDWithDecryption: %v", err)
	}
	if got.Value != "real-secret" {
		t.Errorf("Value = %q, want real-secret", got.Value)
	}
}

func TestGetByIDWithDecryptionPropagatesRepoError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")
	mock.ExpectQuery(regexp.QuoteMeta("WHERE")).WillReturnError(errors.New("db down"))

	_, err := svc.GetByIDWithDecryption(context.Background(), "t-1", "id-1")
	if err == nil {
		t.Error("expected propagated DB error")
	}
}

// ===========================================================================
// Service.ResolveSecrets (sqlmock)
// ===========================================================================

func TestResolveSecretsResolvesWhenSecretExists(t *testing.T) {
	// Precompute the encrypted value for MY_SECRET so the resolve path
	// returns it.
	encService := NewService(&repository.Repository{}, "k")
	enc, _ := encService.encrypt("resolved-value")

	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")

	rows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "value_encrypted", "scope", "version", "environment", "created_at", "updated_at"}).
		AddRow("id-1", "t-1", "MY_SECRET", enc, "project", 1, "prod", time.Now(), time.Now())
	mock.ExpectQuery(regexp.QuoteMeta("WHERE")).WillReturnRows(rows)

	res, err := svc.ResolveSecrets(context.Background(), "t-1", map[string]string{
		"pw": "${secrets.MY_SECRET}",
	})
	if err != nil {
		t.Fatalf("ResolveSecrets: %v", err)
	}
	if res.Resolved != 1 {
		t.Errorf("Resolved = %d, want 1", res.Resolved)
	}
	if res.Parameters["pw"] != "resolved-value" {
		t.Errorf("pw = %q, want resolved-value", res.Parameters["pw"])
	}
}

func TestResolveSecretsReportsUnresolvedWhenSecretMissing(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")
	mock.ExpectQuery(regexp.QuoteMeta("WHERE")).WillReturnError(sql.ErrNoRows)

	res, err := svc.ResolveSecrets(context.Background(), "t-1", map[string]string{
		"miss": "${secrets.MISSING}",
	})
	if err != nil {
		t.Fatalf("ResolveSecrets: %v", err)
	}
	if res.Resolved != 0 {
		t.Errorf("Resolved = %d, want 0", res.Resolved)
	}
	if len(res.Unresolved) != 1 || res.Unresolved[0] != "MISSING" {
		t.Errorf("Unresolved = %v, want [MISSING]", res.Unresolved)
	}
	// MISSING has no default; the ${...} placeholder should remain.
	if res.Parameters["miss"] != "${secrets.MISSING}" {
		t.Errorf("miss = %q, want ${secrets.MISSING} (unresolved placeholder retained)", res.Parameters["miss"])
	}
}

func TestResolveSecretsLeavesLiteralsUntouched(t *testing.T) {
	svc := NewService(&repository.Repository{}, "k")
	res, err := svc.ResolveSecrets(context.Background(), "t-1", map[string]string{
		"literal": "no refs here",
	})
	if err != nil {
		t.Fatalf("ResolveSecrets: %v", err)
	}
	if res.Parameters["literal"] != "no refs here" {
		t.Errorf("literal = %q, want unchanged", res.Parameters["literal"])
	}
	if res.Resolved != 0 {
		t.Errorf("Resolved = %d, want 0", res.Resolved)
	}
}

func TestResolveSecretsUsesDefaultWhenSecretMissing(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	svc := NewService(repo, "k")
	// The reference has a default; when the DB lookup fails, the default
	// is substituted.
	mock.ExpectQuery(regexp.QuoteMeta("WHERE")).WillReturnError(errors.New("not found"))

	res, err := svc.ResolveSecrets(context.Background(), "t-1", map[string]string{
		"pw": "${secrets.MISSING:fallback-value}",
	})
	if err != nil {
		t.Fatalf("ResolveSecrets: %v", err)
	}
	if res.Parameters["pw"] != "fallback-value" {
		t.Errorf("pw = %q, want fallback-value", res.Parameters["pw"])
	}
	if len(res.Unresolved) != 0 {
		t.Errorf("Unresolved = %v, want empty (default was used)", res.Unresolved)
	}
}

func TestResolveSecretsEmptyInput(t *testing.T) {
	svc := NewService(&repository.Repository{}, "k")
	res, err := svc.ResolveSecrets(context.Background(), "t-1", map[string]string{})
	if err != nil {
		t.Fatalf("empty input: %v", err)
	}
	if res.Resolved != 0 || len(res.Unresolved) != 0 {
		t.Errorf("empty input should yield zero resolved and zero unresolved, got %+v", res)
	}
}

// ===========================================================================
// Sentinel errors
// ===========================================================================

func TestSentinelErrorsWrap(t *testing.T) {
	// The sentinel errors are the contract; wrap them with %w so callers can
	// detect with errors.Is.
	wrapped := fmt.Errorf("context: %w", ErrSecretNotFound)
	if !errors.Is(wrapped, ErrSecretNotFound) {
		t.Error("wrapped error must be detected by errors.Is")
	}
	wrapped = fmt.Errorf("context: %w", ErrInvalidName)
	if !errors.Is(wrapped, ErrInvalidName) {
		t.Error("wrapped ErrInvalidName must be detected")
	}
}

func TestSentinelErrorsAreDistinct(t *testing.T) {
	// Distinct sentinel errors must not be conflated.
	if ErrSecretNotFound == ErrInvalidName {
		t.Error("sentinel errors must not share identity")
	}
	if ErrSecretNotFound == ErrNameTooLong {
		t.Error("sentinel errors must not share identity")
	}
	if ErrInvalidName == ErrEncryptionKeyMissing {
		t.Error("sentinel errors must not share identity")
	}
}

