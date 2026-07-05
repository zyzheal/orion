package models

import "testing"

func TestCronJobFields(t *testing.T) {
	c := CronJob{ID: "c1", TenantID: "t1", Name: "cleanup", Schedule: "0 2 * * *", Command: "/bin/cleanup", Enabled: true}
	if c.Schedule != "0 2 * * *" { t.Errorf("expected 0 2 * * *, got %s", c.Schedule) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
