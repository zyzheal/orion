package versionchart

import (
	"testing"
)

func TestParseSemVer(t *testing.T) {
	tests := []struct {
		input    string
		major    int
		minor    int
		patch    int
		pre      string
		build    string
		wantErr  bool
	}{
		{"1.2.3", 1, 2, 3, "", "", false},
		{"0.0.0", 0, 0, 0, "", "", false},
		{"10.20.30", 10, 20, 30, "", "", false},
		{"1.2.3-alpha", 1, 2, 3, "alpha", "", false},
		{"1.2.3-beta.1", 1, 2, 3, "beta.1", "", false},
		{"1.2.3-rc.1+build.42", 1, 2, 3, "rc.1", "build.42", false},
		{"2.0.0", 2, 0, 0, "", "", false},
		{"  1.2.3  ", 1, 2, 3, "", "", false},
		{"", 0, 0, 0, "", "", true},
		{"1.2", 0, 0, 0, "", "", true},
		{"1.2.3.4", 0, 0, 0, "", "", true},
		{"1.a.3", 0, 0, 0, "", "", true},
		{"-1.2.3", 0, 0, 0, "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			v, err := ParseSemVer(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseSemVer(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if v.Major != tt.major || v.Minor != tt.minor || v.Patch != tt.patch {
				t.Errorf("SemVer = %+v, want major=%d minor=%d patch=%d", v, tt.major, tt.minor, tt.patch)
			}
			if v.PreRelease != tt.pre {
				t.Errorf("PreRelease = %q, want %q", v.PreRelease, tt.pre)
			}
			if v.Build != tt.build {
				t.Errorf("Build = %q, want %q", v.Build, tt.build)
			}
		})
	}
}

func TestSemVer_Compare(t *testing.T) {
	tests := []struct {
		name     string
		a, b     string
		expected int
	}{
		{"equal", "1.2.3", "1.2.3", 0},
		{"major diff", "2.0.0", "1.0.0", 1},
		{"major less", "1.0.0", "2.0.0", -1},
		{"minor diff", "1.3.0", "1.2.0", 1},
		{"patch diff", "1.2.4", "1.2.3", 1},
		{"prerelease less", "1.2.3-alpha", "1.2.3", -1},
		{"prerelease greater", "1.2.3", "1.2.3-alpha", 1},
		{"both prerelease", "1.2.3-alpha", "1.2.3-beta", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			va, _ := ParseSemVer(tt.a)
			vb, _ := ParseSemVer(tt.b)
			result := va.Compare(vb)
			if result != tt.expected {
				t.Errorf("Compare(%q, %q) = %d, want %d", tt.a, tt.b, result, tt.expected)
			}
		})
	}
}

func TestSemVer_IsPreRelease(t *testing.T) {
	v1, _ := ParseSemVer("1.2.3-alpha")
	v2, _ := ParseSemVer("1.2.3")
	if !v1.IsPreRelease() {
		t.Error("IsPreRelease should be true for 1.2.3-alpha")
	}
	if v2.IsPreRelease() {
		t.Error("IsPreRelease should be false for 1.2.3")
	}
}

func TestSemVer_Increment(t *testing.T) {
	v, _ := ParseSemVer("1.2.3")

	v1 := v.IncrementMajor()
	if v1.Major != 2 || v1.Minor != 0 || v1.Patch != 0 {
		t.Errorf("IncrementMajor = %+v, want 2.0.0", v1)
	}

	v2 := v.IncrementMinor()
	if v2.Major != 1 || v2.Minor != 3 || v2.Patch != 0 {
		t.Errorf("IncrementMinor = %+v, want 1.3.0", v2)
	}

	v3 := v.IncrementPatch()
	if v3.Major != 1 || v3.Minor != 2 || v3.Patch != 4 {
		t.Errorf("IncrementPatch = %+v, want 1.2.4", v3)
	}
}

func TestSemVer_String(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"1.2.3", "1.2.3"},
		{"1.2.3-alpha", "1.2.3-alpha"},
		{"1.2.3+build", "1.2.3+build"},
		{"1.2.3-rc.1+build.42", "1.2.3-rc.1+build.42"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			v, err := ParseSemVer(tt.input)
			if err != nil {
				t.Fatal(err)
			}
			if v.String() != tt.expected {
				t.Errorf("String() = %q, want %q", v.String(), tt.expected)
			}
		})
	}
}
