package service

import "testing"

func Test_DefaultSourceSpace(t *testing.T) {
	cases := map[string]string{
		"alert":    "space-ops-alert",
		"ticket":   "space-ops-ticket",
		"incident": "space-ops-incident",
		"change":   "space-ops-change",
		"docs":     "space-ops",
		"":         "space-ops",
	}
	for source, want := range cases {
		if got := defaultSourceSpace(source); got != want {
			t.Errorf("defaultSourceSpace(%q) = %q, want %q", source, got, want)
		}
	}
}
