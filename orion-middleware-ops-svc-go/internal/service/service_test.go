package service

import "testing"

func TestErrorConstants(t *testing.T) {
	if ErrInstanceNotFound.Error() != "middleware instance not found" {
		t.Errorf("unexpected ErrInstanceNotFound: %s", ErrInstanceNotFound.Error())
	}
	if ErrBackupNotFound.Error() != "backup record not found" {
		t.Errorf("unexpected ErrBackupNotFound: %s", ErrBackupNotFound.Error())
	}
}
