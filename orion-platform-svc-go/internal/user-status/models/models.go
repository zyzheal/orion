package models

import "time"

type UserStatus struct {
	ID      string    `json:"id" db:"id"`
	UserID  string    `json:"userId" db:"user_id"`
	Status  string    `json:"status" db:"status"` // online, offline, busy, away, dnd
	Message string    `json:"message" db:"message"`
	SetAt   time.Time `json:"setAt" db:"set_at"`
}

type SetStatusRequest struct {
	Status  string `json:"status" binding:"required"`
	Message string `json:"message"`
}
