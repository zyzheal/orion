package service

import "testing"

func TestHashPassword(t *testing.T) {
	svc := NewPasswordService()

	hash, err := svc.HashPassword("mypassword123")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if hash == "" {
		t.Error("hash should not be empty")
	}
	if hash == "mypassword123" {
		t.Error("hash should not equal plaintext")
	}
}

func TestCompareHashAndPassword_Correct(t *testing.T) {
	svc := NewPasswordService()

	hash, err := svc.HashPassword("mypassword123")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	result, err := CompareHashAndPassword([]byte(hash), []byte("mypassword123"))
	if err != nil {
		t.Fatalf("CompareHashAndPassword failed: %v", err)
	}
	if string(result) != hash {
		t.Error("expected hash to be returned")
	}
}

func TestCompareHashAndPassword_Incorrect(t *testing.T) {
	svc := NewPasswordService()

	hash, err := svc.HashPassword("mypassword123")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	_, err = CompareHashAndPassword([]byte(hash), []byte("wrongpassword"))
	if err == nil {
		t.Error("expected error for wrong password")
	}
}

func TestHashPassword_DifferentHashes(t *testing.T) {
	svc := NewPasswordService()

	hash1, _ := svc.HashPassword("samepassword")
	hash2, _ := svc.HashPassword("samepassword")

	if hash1 == hash2 {
		t.Error("bcrypt should produce different salts for same input")
	}

	// But both should validate
	_, err1 := CompareHashAndPassword([]byte(hash1), []byte("samepassword"))
	_, err2 := CompareHashAndPassword([]byte(hash2), []byte("samepassword"))
	if err1 != nil || err2 != nil {
		t.Error("both hashes should validate against original password")
	}
}
