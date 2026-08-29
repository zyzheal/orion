package aesgcm

import (
	"bytes"
	"encoding/hex"
	"strings"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := Key("test-secret-key")
	for _, plain := range []string{
		"hunter2",
		"",
		"p@ss with spaces & unicode: 数据库",
		strings.Repeat("x", 10_000),
	} {
		ct, err := Encrypt(key, plain)
		if err != nil {
			t.Fatalf("encrypt(%q): %v", plain, err)
		}
		if ct == "" {
			t.Fatalf("encrypt(%q) returned an empty ciphertext", plain)
		}
		if ct == plain {
			t.Fatalf("ciphertext is the plaintext: %q", plain)
		}
		got, err := Decrypt(key, ct)
		if err != nil {
			t.Fatalf("decrypt(%q): %v", plain, err)
		}
		if got != plain {
			t.Fatalf("round trip %q -> %q", plain, got)
		}
	}
}

func TestDecryptRejectsWrongKey(t *testing.T) {
	ct, err := Encrypt(Key("key-one"), "secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Decrypt(Key("key-two"), ct); err == nil {
		t.Fatal("decrypted a ciphertext with the wrong key")
	}
}

func TestDecryptRejectsTamperedCiphertext(t *testing.T) {
	key := Key("key-one")
	ct, err := Encrypt(key, "secret")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := hex.DecodeString(ct)
	if err != nil {
		t.Fatal(err)
	}
	// Flip one bit in the payload area, after the nonce: GCM's authentication
	// tag must catch it instead of returning mangled plaintext.
	raw[len(raw)-1] ^= 0x01
	if _, err := Decrypt(key, hex.EncodeToString(raw)); err == nil {
		t.Fatal("accepted a tampered ciphertext")
	}
}

func TestDecryptRejectsMalformedInput(t *testing.T) {
	key := Key("key-one")
	for _, bad := range []string{
		"",                           // nothing at all
		"zz",                         // not hex
		"abcd",                       // hex, but shorter than a nonce
		"abcdabcdabcdabcdabcdabcdab", // hex, longer than a nonce but shorter than nonce+tag
	} {
		if _, err := Decrypt(key, bad); err == nil {
			t.Errorf("Decrypt(%q) should have failed", bad)
		}
	}
}

func TestKeyDerivation(t *testing.T) {
	hexKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	if k := Key(hexKey); len(k) != 32 {
		t.Fatalf("hex key length = %d, want 32", len(k))
	}
	// A 64-char hex secret is used verbatim, so an operator who already holds a
	// proper 256-bit key does not get it transformed twice.
	want, _ := hex.DecodeString(hexKey)
	if !bytes.Equal(Key(hexKey), want) {
		t.Fatal("64-char hex secret was not used verbatim")
	}
	// Any other secret is SHA-256'd to 32 bytes, so an ordinary passphrase works.
	if k := Key("arbitrary passphrase"); len(k) != 32 {
		t.Fatalf("passphrase key length = %d, want 32", len(k))
	}
	if bytes.Equal(Key("alpha"), Key("beta")) {
		t.Fatal("different secrets derived the same key")
	}
	// An empty secret still yields a key. Key() cannot tell a misconfiguration
	// apart from a deliberate blank, so refusing the dev fallback is the
	// caller's job (see datasourceKey in cmd/server).
	if k := Key(""); len(k) != 32 {
		t.Fatalf("empty secret key length = %d, want 32", len(k))
	}
}

func TestEncryptIsNonDeterministic(t *testing.T) {
	key := Key("key-one")
	a, err := Encrypt(key, "same plaintext")
	if err != nil {
		t.Fatal(err)
	}
	b, err := Encrypt(key, "same plaintext")
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two encryptions of the same plaintext produced identical ciphertexts (nonce reuse)")
	}
}
