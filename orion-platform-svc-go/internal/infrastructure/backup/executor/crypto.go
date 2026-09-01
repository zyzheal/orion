package executor

import (
	"bufio"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
)

// ErrEmptyKey is returned when an empty or mis-sized key is passed to the
// EncryptFile / DecryptFile helpers. AES-256 requires exactly 32 bytes.
var ErrEmptyKey = errors.New("encryption key must be 32 bytes (AES-256-GCM)")

// chunked AEAD (G5) format v1:
//
//	"ORCH" (4B) | 0x01 (1B) | frame...
//	  frame = chunkLen uint32 BE | nonce 12B | ciphertext chunkLen B
//
// chunkLen is the ciphertext length (plaintext + 16B GCM tag). Each frame is
// sealed with its own random 12-byte nonce and authenticates the running
// chunk index as AAD, so frames cannot be reordered or spliced. The plaintext
// is streamed in at most 1 MiB blocks, so artifact size is no longer bounded
// by memory.
//
// Legacy v0 files (nonce || GCM(whole file), produced by earlier builds) stay
// decryptable: DecryptFile sniffs the header — a v0 file starts with random
// nonce bytes, which cannot collide with the "ORCH" magic in practice.
const (
	aeadMagic        = "ORCH"
	aeadVersion      = byte(0x01) // v1: header + length-prefixed AEAD frames, no key id
	aeadVersionKeyed = byte(0x02) // v2: header + keyID + length-prefixed AEAD frames
	aeadChunkSize    = 1 << 20    // 1 MiB plaintext per chunk
	aeadNonce        = 12         // GCM standard nonce size
	aeadTagOverhead  = 16         // GCM tag
	aeadHeaderLen    = 5          // magic(4) + version(1)
	aeadFrameHdrLen  = 4          // uint32 BE chunk length preceding a frame
	aeadMaxCipherLen = aeadChunkSize + aeadTagOverhead
	aeadMaxKeyIDLen  = 255        // 1-byte length prefix => max 255-byte key ids

	// defaultKeyID is the id recorded by the raw-key EncryptFile path. It is
	// resolved through the provider on decrypt so old default-keyed artifacts
	// keep working after rotation.
	defaultKeyID = "default"
)

// EncryptFile streams plaintext from src into an AES-256-GCM chunked AEAD
// file at dst (G5). The plaintext is never fully loaded into memory; the
// function is context-aware so long artifacts can be cancelled between
// chunks. On success dst holds the "ORCH" v1 framed file (0o600) — the
// raw-key API keeps the original format, so v0/v1 artifacts and their tests
// stay untouched. Key-versioned callers use EncryptFileWithProvider (v2).
func EncryptFile(src, dst string, key []byte) error {
	return encryptFileChunked(context.Background(), src, dst, key, aeadChunkSize, aeadVersion, "")
}

// EncryptFileWithProvider streams plaintext from src into an AES-256-GCM
// chunked AEAD file at dst (G6, v2 format), resolving the current key via
// p.GetKey(keyID). The keyID is recorded in the artifact header so later
// decryption asks for the exact version that sealed the data — enabling key
// rotation without re-encrypting historical artifacts.
func EncryptFileWithProvider(ctx context.Context, src, dst string, p KeyProvider, keyID string) error {
	key, err := p.GetKey(ctx, keyID)
	if err != nil {
		return fmt.Errorf("encrypt: resolve key %q: %w", keyID, err)
	}
	return encryptFileChunked(ctx, src, dst, key, aeadChunkSize, aeadVersionKeyed, keyID)
}

func encryptFileChunked(ctx context.Context, src, dst string, key []byte, chunkSize uint32, version byte, keyID string) error {
	if len(key) != 32 {
		return ErrEmptyKey
	}
	if chunkSize == 0 {
		return errors.New("encryption: chunk size must be positive")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()

	header := make([]byte, aeadHeaderLen)
	copy(header, aeadMagic)
	header[4] = version
	if _, err := out.Write(header); err != nil {
		return err
	}
	if version == aeadVersionKeyed {
		// v2: record the keyID so decryption can select the right key
		// version during rotation.
		if len(keyID) == 0 || len(keyID) > aeadMaxKeyIDLen {
			return fmt.Errorf("chunked encrypt: invalid key id %q (must be 1-%d bytes)", keyID, aeadMaxKeyIDLen)
		}
		if err := binary.Write(out, binary.BigEndian, byte(len(keyID))); err != nil {
			return err
		}
		if _, err := out.Write([]byte(keyID)); err != nil {
			return err
		}
	}
	r := bufio.NewReaderSize(in, 64<<10)
	w := bufio.NewWriterSize(out, 64<<10)

	plain := make([]byte, int(chunkSize))
	var idx uint64
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("chunked encrypt: cancelled at frame %d: %w", idx, ctx.Err())
		default:
		}
		n, rerr := io.ReadFull(r, plain)
		switch rerr {
		case io.EOF:
			return finishChunkedWrite(w, out, dst)
		case io.ErrUnexpectedEOF:
			// Final partial chunk — seal the n bytes read.
		case nil:
			// Full chunk.
		default:
			return fmt.Errorf("chunked encrypt: frame %d read: %w", idx, rerr)
		}
		if err := writeChunkedFrame(gcm, w, idx, plain[:n]); err != nil {
			return err
		}
		idx++
		if rerr == io.ErrUnexpectedEOF {
			return finishChunkedWrite(w, out, dst)
		}
	}
}

func finishChunkedWrite(w *bufio.Writer, out *os.File, dst string) error {
	if err := w.Flush(); err != nil {
		return err
	}
	if err := out.Sync(); err != nil {
		return err
	}
	return os.Chmod(dst, 0o600)
}

// writeChunkedFrame seals plaintext with nonce + AAD(index) and writes the
// framed record: chunkLen | nonce | ciphertext.
func writeChunkedFrame(gcm cipher.AEAD, w *bufio.Writer, idx uint64, plaintext []byte) error {
	nonce := make([]byte, aeadNonce)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	var idxBytes [8]byte
	binary.BigEndian.PutUint64(idxBytes[:], idx)
	ct := gcm.Seal(nil, nonce, plaintext, idxBytes[:])
	if err := binary.Write(w, binary.BigEndian, uint32(len(ct))); err != nil {
		return err
	}
	if _, err := w.Write(nonce); err != nil {
		return err
	}
	if _, err := w.Write(ct); err != nil {
		return err
	}
	return nil
}

// DecryptFile reads an encrypted artifact from src and writes the plaintext
// to dst (0o600). Both the current "ORCH" v1 chunked format and the legacy v0
// single-seal format are supported. Returns an error when authentication
// fails — wrong key, corrupted bytes, truncated file, or a tampered/reordered
// frame.
// DecryptFile reads an encrypted artifact from src and writes the plaintext
// to dst (0o600), using the given raw key. It transparently handles all
// emitted formats: v2 (keyed, resolved through the default/'default' static
// provider), v1 (chunked, no key id), and the legacy v0 single-seal format.
// Returns an error when authentication fails — wrong key, corrupted bytes,
// truncated file, or a tampered/reordered frame.
func DecryptFile(src, dst string, key []byte) error {
	return DecryptFileWithProvider(context.Background(), src, dst, StaticKeyProviderFrom(key))
}

// DecryptFileWithProvider is the key-versioned variant of DecryptFile. It
// reads the keyID recorded in a v2 header and resolves the exact key version
// through p. Files that predate v2 (no key id) fall back to the provider's
// "default" key, and legacy v0 outputs keep the raw-key behaviour.
func DecryptFileWithProvider(ctx context.Context, src, dst string, p KeyProvider) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	var head [aeadHeaderLen]byte
	if _, err := io.ReadFull(in, head[:]); err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			// Too small for any ORCH header → legacy v0 (or corrupt).
			return decryptLegacyWithProvider(ctx, src, dst, p)
		}
		return err
	}
	if string(head[:4]) != aeadMagic {
		// Not an ORCH file → legacy v0 (random nonce prefix). Rewind and
		// decode with the raw-key path.
		if _, err := in.Seek(0, io.SeekStart); err != nil {
			return err
		}
		return decryptLegacyWithProvider(ctx, src, dst, p)
	}
	switch head[4] {
	case aeadVersionKeyed:
		// v2: read the keyID and resolve the key version.
		var lenID [1]byte
		if _, err := io.ReadFull(in, lenID[:]); err != nil {
			return fmt.Errorf("chunked decrypt: read key id length: %w", err)
		}
		if lenID[0] > aeadMaxKeyIDLen {
			return fmt.Errorf("chunked decrypt: key id length %d exceeds max", lenID[0])
		}
		idBytes := make([]byte, int(lenID[0]))
		if _, err := io.ReadFull(in, idBytes); err != nil {
			return fmt.Errorf("chunked decrypt: read key id: %w", err)
		}
		key, err := p.GetKey(ctx, string(idBytes))
		if err != nil {
			return fmt.Errorf("chunked decrypt: resolve key: %w", err)
		}
		return decryptChunked(in, dst, key)
	case aeadVersion:
		// v1: no key id — use the provider's default key.
		key, err := p.GetKey(ctx, defaultKeyID)
		if err != nil {
			return fmt.Errorf("chunked decrypt: resolve default key: %w", err)
		}
		return decryptChunked(in, dst, key)
	default:
		return fmt.Errorf("chunked decrypt: unsupported version %d", head[4])
	}
}

// decryptLegacyWithProvider decodes the pre-G5 single-seal format. Legacy
// artifacts were written before key versioning, so they resolve the default
// key.
func decryptLegacyWithProvider(ctx context.Context, src, dst string, p KeyProvider) error {
	key, err := p.GetKey(ctx, defaultKeyID)
	if err != nil {
		return fmt.Errorf("legacy decrypt: resolve default key: %w", err)
	}
	if len(key) != 32 {
		return ErrEmptyKey
	}
	return decryptLegacy(src, dst, key)
}

func decryptChunked(in *os.File, dst string, key []byte) error {
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()
	r := bufio.NewReaderSize(in, 64<<10)
	w := bufio.NewWriterSize(out, 64<<10)

	var idx uint64
	var lenBuf [aeadFrameHdrLen]byte
	for {
		_, err := io.ReadFull(r, lenBuf[:])
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("chunked decrypt: frame %d length: %w", idx, err)
		}
		clen := binary.BigEndian.Uint32(lenBuf[:])
		if clen > aeadMaxCipherLen {
			return fmt.Errorf("chunked decrypt: frame %d length %d exceeds max %d", idx, clen, aeadMaxCipherLen)
		}
		nonce := make([]byte, aeadNonce)
		if _, err := io.ReadFull(r, nonce); err != nil {
			return fmt.Errorf("chunked decrypt: frame %d nonce: %w", idx, err)
		}
		ct := make([]byte, clen)
		if _, err := io.ReadFull(r, ct); err != nil {
			return fmt.Errorf("chunked decrypt: frame %d ciphertext: %w", idx, err)
		}
		var idxBytes [8]byte
		binary.BigEndian.PutUint64(idxBytes[:], idx)
		plain, err := gcm.Open(nil, nonce, ct, idxBytes[:])
		if err != nil {
			return fmt.Errorf("chunked decrypt: frame %d authentication failed (corrupted or wrong key): %w", idx, err)
		}
		if _, err := w.Write(plain); err != nil {
			return err
		}
		idx++
	}
	if err := w.Flush(); err != nil {
		return err
	}
	return os.Chmod(dst, 0o600)
}

// decryptLegacy decodes the pre-G5 format: nonce || GCM(whole file). It keeps
// the original whole-file-in-memory behavior because legacy artifacts are by
// definition single-seal; this path exists only for backward compatibility.
func decryptLegacy(src, dst string, key []byte) error {
	ciphertext, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return errors.New("ciphertext too short for AES-256-GCM")
	}
	nonce, ct := ciphertext[:ns], ciphertext[ns:]
	plaintext, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return fmt.Errorf("decryption failed (wrong key or corrupted file): %w", err)
	}
	return os.WriteFile(dst, plaintext, 0o600)
}

// EncryptBytes and DecryptBytes are the in-memory variants used by executors
// that produce or consume byte slices directly rather than files. They
// preserve the legacy v0 single-seal scheme (nonce || ciphertext), which is
// byte-compatible with artifacts written before G5.
func EncryptBytes(key, plaintext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrEmptyKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func DecryptBytes(key, ciphertext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrEmptyKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return nil, errors.New("ciphertext too short for AES-256-GCM")
	}
	return gcm.Open(nil, ciphertext[:ns], ciphertext[ns:], nil)
}