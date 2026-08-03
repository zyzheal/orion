package repository

import (
	"strings"
	"testing"
)

func TestJoinStrings(t *testing.T) {
	cases := []struct {
		name     string
		input    []string
		sep      string
		expected string
	}{
		{
			name:     "empty slice",
			input:    []string{},
			sep:      " AND ",
			expected: "",
		},
		{
			name:     "single element",
			input:    []string{"tenant_id = $1"},
			sep:      " AND ",
			expected: "tenant_id = $1",
		},
		{
			name:     "two elements",
			input:    []string{"tenant_id = $1", "status = $2"},
			sep:      " AND ",
			expected: "tenant_id = $1 AND status = $2",
		},
		{
			name:     "three elements",
			input:    []string{"a", "b", "c"},
			sep:      ",",
			expected: "a,b,c",
		},
		{
			name:     "custom separator",
			input:    []string{"x", "y"},
			sep:      " || ",
			expected: "x || y",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := joinStrings(tc.input, tc.sep)
			if result != tc.expected {
				t.Errorf("joinStrings(%q, %q) = %q, want %q", tc.input, tc.sep, result, tc.expected)
			}
		})
	}
}

func TestJoinStrings_Seq(t *testing.T) {
	// Ensure separator does not appear at start.
	out := joinStrings([]string{"a", "b", "c"}, " AND ")
	if strings.HasPrefix(out, " AND ") {
		t.Error("separator should not prefix the result")
	}
	if strings.HasSuffix(out, " AND ") {
		t.Error("separator should not suffix the result")
	}
}
