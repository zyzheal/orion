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

// Page and OffsetFromPage cover the second pagination shape used across the
// platform: a 1-based `page` plus a `page_size`, with the offset derived as
// (page-1)*page_size. Both inputs were previously unparsed and unchecked —
// `?page=-1` and `?page=0` each produced a negative OFFSET, and
// `?page_size=-5` produced a negative LIMIT, all of which Postgres rejects with
// an error instead of data.

func TestPage(t *testing.T) {
	cases := []struct {
		in   string
		def  int
		want int
	}{
		{"", 1, 1},    // absent
		{"abc", 1, 1}, // unparsable
		{"-", 1, 1},
		{"-1", 1, 1}, // the whole point: a negative page would give a negative OFFSET
		{"-40", 1, 1},
		{"0", 1, 1}, // page numbering is 1-based, so 0 is not a page
		{"1", 1, 1}, // the interval that was never pinned in the handler copies
		{"2", 1, 2},
		{"4", 1, 4},
		{"14", 1, 14},
		{"60", 1, 60},
		{"999999", 1, 999999},
		{"", 5, 5}, // a non-default fallback
		{"-3", 5, 5},
		{"7", 5, 7},
	}
	for _, tc := range cases {
		if got := Page(tc.in, tc.def); got != tc.want {
			t.Errorf("Page(%q, %d) = %d, want %d", tc.in, tc.def, got, tc.want)
		}
	}
}

func TestOffsetFromPage(t *testing.T) {
	cases := []struct {
		page int
		size int
		want int
	}{
		{1, 20, 0}, // page 1 is offset 0
		{2, 20, 20},
		{3, 20, 40},
		{14, 25, 325},
		{2, 1, 1},
		{1, 1, 0},
		{0, 20, 0},   // page 0 folds to page 1
		{-1, 20, 0},  // was -40 before the clamp
		{-40, 20, 0}, // was -820
		{5, 0, 4},    // a size of 0 is stepped at 1, not at 0
		{5, -5, 4},
		{1, 0, 0},
		{1, -3, 0},
	}
	for _, tc := range cases {
		if got := OffsetFromPage(tc.page, tc.size); got != tc.want {
			t.Errorf("OffsetFromPage(%d, %d) = %d, want %d", tc.page, tc.size, got, tc.want)
		}
	}
}
