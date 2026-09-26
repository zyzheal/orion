package pagination

import "testing"

// These two functions used to live as ten byte-identical copies inside handler
// packages, where the only values ever exercised by a test were -40 and 60. The
// 1..4 interval was never pinned, which let `i > 0` silently rot to `i > 1` —
// folding `?offset=1` to 0 — in every copy for five rounds. Testing the
// boundary values here closes that gap in one place.

func TestOffset(t *testing.T) {
	cases := []struct {
		in   string
		want int
	}{
		{"", 0},    // absent
		{"abc", 0}, // unparsable
		{"-", 0},
		{"-1", 0}, // the whole point of the clamp
		{"-40", 0},
		{"0", 0},
		{"1", 1}, // the interval that was never pinned in the handler copies
		{"2", 2},
		{"4", 4},
		{"14", 14},
		{"60", 60},
		{"999999", 999999},
	}
	for _, tc := range cases {
		if got := Offset(tc.in); got != tc.want {
			t.Errorf("Offset(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func TestLimit(t *testing.T) {
	cases := []struct {
		in   string
		def  int
		want int
	}{
		{"", 20, 20},
		{"abc", 20, 20},
		{"-1", 20, 20},
		{"0", 20, 20}, // a zero page size would divide by zero downstream
		{"1", 20, 1},
		{"2", 20, 2},
		{"7", 20, 7},
		{"25", 20, 25},
		{"", 50, 50},
		{"0", 50, 50},
	}
	for _, tc := range cases {
		if got := Limit(tc.in, tc.def); got != tc.want {
			t.Errorf("Limit(%q, %d) = %d, want %d", tc.in, tc.def, got, tc.want)
		}
	}
}
