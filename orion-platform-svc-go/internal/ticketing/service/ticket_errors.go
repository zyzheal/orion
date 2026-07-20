package service

import (
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"
)

// --- Errors ---

var (
	ErrTicketNotOpen = errors.New("ticket not open")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundTicket(id string) error {
	return fmt.Errorf("ticket %q not found: %w", id, sentinel.NotFound)
}

func ErrNotFoundRule(id string) error {
	return fmt.Errorf("automation rule %q not found: %w", id, sentinel.NotFound)
}
