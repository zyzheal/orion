package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrCronJobNotFound.Error() != "cron job not found" { t.Errorf("unexpected: %s", ErrCronJobNotFound.Error()) }
}
