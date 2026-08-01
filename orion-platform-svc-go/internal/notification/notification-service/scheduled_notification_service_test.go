package service

import (
	"testing"
	"time"
)

func TestValidateCronExpression_Valid(t *testing.T) {
	svc := NewScheduledNotificationService(nil, nil)

	tests := []struct {
		name       string
		cron       string
		wantValid  bool
		wantFields int
	}{
		{"standard 5-field cron", "*/5 * * * *", true, 5},
		{"every minute", "* * * * *", true, 5},
		{"daily at midnight", "0 0 * * *", true, 5},
		{"weekly sunday midnight", "0 0 * * 0", true, 5},
		{"monthly 1st midnight", "0 0 1 * *", true, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.ValidateCronExpression(tt.cron)
			if result.Valid != tt.wantValid {
				t.Errorf("ValidateCronExpression(%q).Valid = %v, want %v", tt.cron, result.Valid, tt.wantValid)
			}
			if result.Error != "" {
				t.Errorf("ValidateCronExpression(%q).Error = %q, want empty", tt.cron, result.Error)
			}
			if result.NextFireTime == nil {
				t.Errorf("ValidateCronExpression(%q).NextFireTime = nil, want non-nil", tt.cron)
			}
		})
	}
}

func TestValidateCronExpression_Invalid(t *testing.T) {
	svc := NewScheduledNotificationService(nil, nil)

	tests := []struct {
		name          string
		cron          string
		wantValid     bool
		wantErrorSub  string
	}{
		{"too few fields", "*/5 * *", false, "exactly 5 fields"},
		{"too many fields", "* * * * * *", false, "exactly 5 fields"},
		{"empty string", "", false, "exactly 5 fields"},
		{"single field", "*", false, "exactly 5 fields"},
		{"illegal character", "*/5 * * a *", false, "Invalid field"},
		{"special char", "*/5 * * * ?", false, "Invalid field"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.ValidateCronExpression(tt.cron)
			if result.Valid != tt.wantValid {
				t.Errorf("ValidateCronExpression(%q).Valid = %v, want %v", tt.cron, result.Valid, tt.wantValid)
			}
			if tt.wantErrorSub != "" && result.Error == "" {
				t.Errorf("ValidateCronExpression(%q).Error = empty, want contains %q", tt.cron, tt.wantErrorSub)
			}
		})
	}
}

func TestValidateCronExpression_EdgeCases(t *testing.T) {
	svc := NewScheduledNotificationService(nil, nil)

	tests := []struct {
		name     string
		cron     string
		wantValid bool
	}{
		{"single value minute", "0 * * * *", true},
		{"range hour", "0 9-17 * * *", true},
		{"step minute", "*/10 * * * *", true},
		{"comma list", "0,30 * * * *", true},
		{"combined range and step", "0-30/5 * * * *", true},
		{"wildcard all", "* * * * *", true},
		{"zero-padded", "05 08 * * *", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.ValidateCronExpression(tt.cron)
			if result.Valid != tt.wantValid {
				t.Errorf("ValidateCronExpression(%q).Valid = %v, want %v", tt.cron, result.Valid, tt.wantValid)
			}
			if result.Valid && result.Description == "" {
				t.Errorf("ValidateCronExpression(%q).Description = empty, want non-empty", tt.cron)
			}
		})
	}
}

func TestBuildCronDescription(t *testing.T) {
	tests := []struct {
		name     string
		fields   []string
		wantContain string
	}{
		{"every minute", []string{"*", "*", "*", "*", "*"}, "every minute"},
		{"specific time", []string{"0", "9", "*", "*", "*"}, "at 09:00"},
		{"every minute of hour", []string{"*", "10", "*", "*", "*"}, "every minute during hour 10"},
		{"at minute of every hour", []string{"30", "*", "*", "*", "*"}, "at minute 30 of every hour"},
		{"with day of month", []string{"0", "0", "1", "*", "*"}, "on day 1 of month"},
		{"with day of week", []string{"0", "0", "*", "*", "1"}, "on 1"},
		{"with month", []string{"0", "0", "*", "6", "*"}, "in month 6"},
		{"combined", []string{"0", "9", "1", "6", "1"}, "at 09:00"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			desc := buildCronDescription(tt.fields)
			if desc == "" {
				t.Errorf("buildCronDescription(%v) = empty, want contains %q", tt.fields, tt.wantContain)
			}
		})
	}
}

func TestMustGenerateID(t *testing.T) {
	t.Run("format check", func(t *testing.T) {
		id := mustGenerateID()
		if len(id) != 15 {
			t.Errorf("mustGenerateID() length = %d, want 15 (sn- + 12 chars)", len(id))
		}
		if id[:3] != "sn-" {
			t.Errorf("mustGenerateID() prefix = %q, want %q", id[:3], "sn-")
		}
	})

	t.Run("unique ids", func(t *testing.T) {
		id1 := mustGenerateID()
		id2 := mustGenerateID()
		if id1 == id2 {
			t.Errorf("mustGenerateID() produced duplicate IDs: %s", id1)
		}
	})
}

func TestCalculateNextRetry_Scheduled(t *testing.T) {
	now := time.Now()
	tests := []struct {
		attempt int
		minDiff int64
		maxDiff int64
	}{
		{1, 25_000, 35_000},
		{2, 290_000, 310_000},
		{3, 1_790_000, 1_810_000},
		{10, 1_790_000, 1_810_000},
		{0, 25_000, 35_000},
	}

	for _, tt := range tests {
		t.Run("attempt", func(t *testing.T) {
			got := CalculateNextRetry(tt.attempt)
			diff := got.Sub(now).Milliseconds()
			if diff < tt.minDiff || diff > tt.maxDiff {
				t.Errorf("CalculateNextRetry(%d) diff=%dms, want ~%dms", tt.attempt, diff, (tt.minDiff+tt.maxDiff)/2)
			}
		})
	}
}
