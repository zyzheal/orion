package service

import "golang.org/x/crypto/bcrypt"

// PasswordService handles password hashing and verification.
type PasswordService struct{}

func NewPasswordService() *PasswordService {
	return &PasswordService{}
}

func (s *PasswordService) HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

func CompareHashAndPassword(hashedPassword []byte, password []byte) ([]byte, error) {
	err := bcrypt.CompareHashAndPassword(hashedPassword, password)
	if err != nil {
		return nil, err
	}
	return hashedPassword, nil
}
