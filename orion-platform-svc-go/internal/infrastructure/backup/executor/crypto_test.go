package executor

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestEncryptFileDecryptFile_Roundtrip(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.bin")
	dst := filepath.Join(dir, "enc.bin")
	back := filepath.Join(dir, "dec.bin")
	key := bytes.Repeat([]byte("a"), 32)

	payload := []byte("chunked AEAD roundtrip payload — G5")
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if err := DecryptFile(dst, back, key); err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	got, err := os.ReadFile(back)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("roundtrip mismatch: got %q want %q", got, payload)
	}
}

func TestEncryptFile_StreamsLargePayload_MultiChunk(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "big.bin")
	dst := filepath.Join(dir, "big.enc")
	back := filepath.Join(dir, "big.dec")
	key := bytes.Repeat([]byte("b"), 32)

	// ~8 MiB of structured content spans >1 MiB chunk boundary (8 chunks).
	size := aeadChunkSize*8 + 12345
	payload := make([]byte, size)
	for i := range payload {
		payload[i] = byte(i % 251)
	}
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if err := DecryptFile(dst, back, key); err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	got, err := os.ReadFile(back)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatal("large payload roundtrip mismatch")
	}
	// Sanity: ciphertext is framed, not plaintext.
	if bytes.Contains(got, []byte("ORCH")) {
		t.Fatal("plaintext leaked into output")
	}
}

func TestDecryptFile_TamperedChunkFails(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.bin")
	dst := filepath.Join(dir, "enc.bin")
	back := filepath.Join(dir, "dec.bin")
	key := bytes.Repeat([]byte("c"), 32)

	// Multiple chunks so tamper lands inside a data frame, not the header.
	payload := bytes.Repeat([]byte("payload-data-for-tamper-test-"), 4*aeadChunkSize/int(len("payload-data-for-tamper-test-"))+1)
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(dst)
	if err != nil {
		t.Fatal(err)
	}
	// Flip a bit in the ciphertext of the second frame (skip header + first frame).
	flipAt := aeadHeaderLen + aeadFrameHdrLen + aeadNonce + (aeadChunkSize + aeadTagOverhead) + 10
	if flipAt >= len(data) {
		t.Fatalf("frame offset %d out of range (len %d)", flipAt, len(data))
	}
	data[flipAt] ^= 0x01
	if err := os.WriteFile(dst, data, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := DecryptFile(dst, back, key); err == nil {
		t.Fatal("expected decrypt to fail after tampering with a chunk")
	}
}

func TestDecryptFile_TruncatedFrameFails(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.bin")
	dst := filepath.Join(dir, "enc.bin")
	back := filepath.Join(dir, "dec.bin")
	key := bytes.Repeat([]byte("d"), 32)

	payload := bytes.Repeat([]byte("truncate-me"), 2*aeadChunkSize/int(len("truncate-me"))+1)
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(dst)
	if err != nil {
		t.Fatal(err)
	}
	// Chop off the tail mid-frame.
	cut := info.Size() - aeadChunkSize/2
	data, err := os.ReadFile(dst)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dst, data[:cut], 0o600); err != nil {
		t.Fatal(err)
	}
	if err := DecryptFile(dst, back, key); err == nil {
		t.Fatal("expected decrypt to fail on truncated artifact")
	}
}

func TestDecryptFile_ReorderedFramesFail(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.bin")
	dst := filepath.Join(dir, "enc.bin")
	back := filepath.Join(dir, "dec.bin")
	key := bytes.Repeat([]byte("e"), 32)

	// 2+ frames: chunkSize + a small remainder.
	payload := bytes.Repeat([]byte("abcd"), aeadChunkSize/int(len("abcd"))+1)
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatal(err)
	}
	block, err := os.ReadFile(dst)
	if err != nil {
		t.Fatal(err)
	}
	// Walk the frame boundaries by reading each frame length, then swap
	// frame 0 and frame 1 while keeping the header first.
	boundaries := []int{aeadHeaderLen}
	pos := aeadHeaderLen
	for pos < len(block) {
		if pos+aeadFrameHdrLen > len(block) {
			break
		}
		clen := int(uint32(block[pos])<<24 | uint32(block[pos+1])<<16 | uint32(block[pos+2])<<8 | uint32(block[pos+3]))
		pos += aeadFrameHdrLen + aeadNonce + clen
		boundaries = append(boundaries, pos)
	}
	if len(boundaries) < 3 {
		t.Fatalf("expected at least 2 frames, got %d", len(boundaries)-1)
	}
	f0 := block[boundaries[0]:boundaries[1]]
	f1 := block[boundaries[1]:boundaries[2]]
	reordered := make([]byte, 0, len(block))
	reordered = append(reordered, block[:aeadHeaderLen]...)
	reordered = append(reordered, f1...)
	reordered = append(reordered, f0...)
	reordered = append(reordered, block[boundaries[2]:]...)
	if err := os.WriteFile(dst, reordered, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := DecryptFile(dst, back, key); err == nil {
		t.Fatal("expected decrypt to fail with reordered frames")
	}
}

func TestCrypto_LegacyV0Compatible(t *testing.T) {
	// "legacy" here means the pre-G5 single-seal format: nonce || GCM(data).
	dir := t.TempDir()
	back := filepath.Join(dir, "v0.dec")
	key := bytes.Repeat([]byte("f"), 32)

	// Reconstruct a v0 file with the in-memory helper (which still emits v0).
	payload := []byte("legacy v0 artifact must stay decryptable")
	ciphered, err := EncryptBytes(key, payload)
	if err != nil {
		t.Fatal(err)
	}
	v0Path := filepath.Join(dir, "legacy.dat")
	if err := os.WriteFile(v0Path, ciphered, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := DecryptFile(v0Path, back, key); err != nil {
		t.Fatalf("v0 decode failed: %v", err)
	}
	got, err := os.ReadFile(back)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("v0 roundtrip mismatch: %q", got)
	}
}

func TestEncryptFile_EmptyKeyRejected(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.bin")
	if err := os.WriteFile(src, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, filepath.Join(dir, "e.bin"), nil); err == nil {
		t.Fatal("expected key-size error")
	}
	if err := DecryptFile(src, filepath.Join(dir, "d.bin"), []byte("short")); err == nil {
		t.Fatal("expected key-size error")
	}
}

func TestChunkedFormat_HeaderAndFrames(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "p.bin")
	dst := filepath.Join(dir, "e.bin")
	key := bytes.Repeat([]byte("g"), 32)
	if err := os.WriteFile(src, []byte("small"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := EncryptFile(src, dst, key); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(dst)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) < aeadHeaderLen {
		t.Fatal("output shorter than header")
	}
	if string(b[:4]) != aeadMagic {
		t.Fatalf("missing magic: %q", b[:4])
	}
	if b[4] != aeadVersion {
		t.Fatalf("bad version: %d", b[4])
	}
	// One frame for a single-chunk file.
	if len(b) < aeadHeaderLen+aeadFrameHdrLen+aeadNonce {
		t.Fatal("no frame present")
	}
}

// TestKeyProvider_RotationOpensOldVersions verifies G6 key versioning: an
// artifact sealed under an old key stays decryptable after the store rotates
// to a new key, because the file header records the exact keyID used.
func TestKeyProvider_RotationOpensOldVersions(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "secret.txt")
	dst := filepath.Join(dir, "secret.enc")
	back := filepath.Join(dir, "secret.dec")
	payload := []byte("rotation-sensitive-secret")

	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	oldKey := bytes.Repeat([]byte("1"), 32)
	newKey := bytes.Repeat([]byte("2"), 32)

	// v1: raw-key path writes a v1 artifact (no keyID in header).
	if err := EncryptFile(src, dst, oldKey); err != nil {
		t.Fatal(err)
	}

	// Rotate: store now only knows "v2" (new key) plus keeps "default" for
	// legacy v1 files. Simulates a key store that retained the old default.
	store := &StaticMapKeyProvider{Keys: map[string][]byte{
		"default": oldKey, // retained old key for pre-rotation artifacts
		"v2":      newKey,
	}}
	if err := DecryptFileWithProvider(context.Background(), dst, back, store); err != nil {
		t.Fatalf("old file not decryptable after rotation: %v", err)
	}
	got, _ := os.ReadFile(back)
	if !bytes.Equal(got, payload) {
		t.Fatalf("roundtrip mismatch after rotation: %q", got)
	}
}

// TestKeyProvider_NewArtifactsUseCurrentKey verifies that after rotation
// EncryptFileWithProvider writes with the current key version and that the
// artifact header records it.
func TestKeyProvider_NewArtifactsUseCurrentKey(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.txt")
	dst := filepath.Join(dir, "cur.enc")
	back := filepath.Join(dir, "cur.dec")
	payload := []byte("sealed under current key")
	if err := os.WriteFile(src, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	oldKey := bytes.Repeat([]byte("3"), 32)
	newKey := bytes.Repeat([]byte("4"), 32)
	store := &StaticMapKeyProvider{Keys: map[string][]byte{
		"default": oldKey,
		"v2":      newKey,
	}}
	if err := EncryptFileWithProvider(context.Background(), src, dst, store, "v2"); err != nil {
		t.Fatal(err)
	}
	head, err := os.ReadFile(dst)
	if err != nil {
		t.Fatal(err)
	}
	if len(head) < aeadHeaderLen || string(head[:4]) != aeadMagic {
		t.Fatal("v2 artifact missing ORCH magic")
	}
	if head[4] != aeadVersionKeyed {
		t.Fatalf("v2 artifact has version %d, want %d", head[4], aeadVersionKeyed)
	}
	if int(head[5]) != len("v2") || string(head[6:6+len("v2")]) != "v2" {
		t.Fatalf("key ID not recorded in header: len=%d name=%q", head[5], head[6:6+head[5]])
	}
	// The file decrypts with the store after the old key has been dropped.
	if err := DecryptFileWithProvider(context.Background(), dst, back, store); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(back)
	if !bytes.Equal(got, payload) {
		t.Fatalf("current-key roundtrip mismatch: %q", got)
	}
}

// TestKeyProvider_UnknownKeyFailsClosed verifies fail-closed on provider
// lookup: an unknown keyID must abort decryption, not degrade to a wildcard
// key.
func TestKeyProvider_UnknownKeyFailsClosed(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.txt")
	dst := filepath.Join(dir, "enc.enc")
	back := filepath.Join(dir, "out.dec")
	if err := os.WriteFile(src, []byte("rotate me"), 0o600); err != nil {
		t.Fatal(err)
	}
	store := &StaticMapKeyProvider{Keys: map[string][]byte{"v1": bytes.Repeat([]byte("5"), 32)}}
	if err := EncryptFileWithProvider(context.Background(), src, dst, store, "v1"); err != nil {
		t.Fatal(err)
	}
	// Key rotated away entirely: store no longer serves "v1".
	rotated := &StaticMapKeyProvider{Keys: map[string][]byte{"v2": bytes.Repeat([]byte("6"), 32)}}
	if err := DecryptFileWithProvider(context.Background(), dst, back, rotated); err == nil {
		t.Fatal("expected fail-closed when key version is unavailable")
	}
	if _, err := os.Stat(back); !os.IsNotExist(err) {
		t.Fatal("decrypt output should not exist after fail-closed")
	}
}

// TestKeyProvider_ProviderEncryptionFailureFailsClosed verifies that when
// the provider itself errors (KMS unreachable / unprovisioned), encryption
// aborts rather than writing an unusable artifact.
func TestKeyProvider_ProviderEncryptionFailureFailsClosed(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "plain.txt")
	dst := filepath.Join(dir, "out.enc")
	if err := os.WriteFile(src, []byte("payload"), 0o600); err != nil {
		t.Fatal(err)
	}
	store := &KMSKeyProvider{Provisioned: map[string][]byte{}} // nothing provisioned
	if err := EncryptFileWithProvider(context.Background(), src, dst, store, "missing-id"); err == nil {
		t.Fatal("expected encryption to fail closed on provider miss")
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		t.Fatal("no artifact should be written on provider failure")
	}
}

// TestKeyProvider_V0ThroughProvider verifies the provider path still decodes
// the legacy v0 single-seal format via its default-key fallback.
func TestKeyProvider_V0ThroughProvider(t *testing.T) {
	dir := t.TempDir()
	back := filepath.Join(dir, "back.out")
	key := bytes.Repeat([]byte("7"), 32)
	payload := []byte("legacy-through-provider")
	ciphered, err := EncryptBytes(key, payload)
	if err != nil {
		t.Fatal(err)
	}
	v0Path := filepath.Join(dir, "legacy-v0.dat")
	if err := os.WriteFile(v0Path, ciphered, 0o600); err != nil {
		t.Fatal(err)
	}
	store := &StaticMapKeyProvider{Keys: map[string][]byte{"default": key}}
	if err := DecryptFileWithProvider(context.Background(), v0Path, back, store); err != nil {
		t.Fatalf("v0 via provider: %v", err)
	}
	got, _ := os.ReadFile(back)
	if !bytes.Equal(got, payload) {
		t.Fatalf("v0 roundtrip mismatch: %q", got)
	}
}