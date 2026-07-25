package handlers

import "fmt"

// versionValueHandler handles semantic version attribute values (e.g. "1.2.3").
type versionValueHandler struct{}

func (h versionValueHandler) Type() string { return "version" }

func (h versionValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, _, _, err := parseSemanticVersion(value)
	return err
}

func (h versionValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return "0.0.0", nil
	}
	major, minor, patch, err := parseSemanticVersion(value)
	if err != nil {
		return nil, err
	}
	return fmt.Sprintf("%d.%d.%d", major, minor, patch), nil
}

func (h versionValueHandler) Serialize(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func (h versionValueHandler) Compare(a, b string) int {
	va, ea := h.Parse(a)
	vb, eb := h.Parse(b)
	if ea != nil && eb != nil {
		return 0
	}
	if ea != nil {
		return -1
	}
	if eb != nil {
		return 1
	}
	majorA, minorA, patchA, _ := parseSemanticVersion(va.(string))
	majorB, minorB, patchB, _ := parseSemanticVersion(vb.(string))
	if majorA != majorB {
		return majorA - majorB
	}
	if minorA != minorB {
		return minorA - minorB
	}
	return patchA - patchB
}
