package models

import "testing"

func TestNotificationFields(t *testing.T) {
	n := Notification{ID: "n1", TenantID: "t1", Channel: ChannelEmail, Recipient: "a@b.com", Subject: "Hi", Status: StatusPending}
	if n.Channel != ChannelEmail { t.Errorf("expected email, got %s", n.Channel) }
	if n.Status != StatusPending { t.Errorf("expected pending, got %s", n.Status) }
}

func TestTemplateFields(t *testing.T) {
	t2 := NotificationTemplate{ID: "t1", TenantID: "t1", Name: "welcome", Channel: ChannelSlack}
	if t2.Name != "welcome" { t.Errorf("expected welcome, got %s", t2.Name) }
}

func TestChannelFields(t *testing.T) {
	c := NotificationChannel{ID: "c1", TenantID: "t1", Name: "ops-slack", Type: ChannelSlack, Enabled: true}
	if !c.Enabled { t.Error("expected enabled") }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Offset() != 0 { t.Errorf("expected 0, got %d", p.Offset()) }
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
