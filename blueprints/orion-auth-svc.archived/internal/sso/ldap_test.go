package sso

import (
	"testing"
)

// --- BER Encoding Tests ---

func TestBEREncodeOctetString(t *testing.T) {
	tests := []struct {
		input    string
		wantLen  int
	}{
		{"", 2},           // tag + length(0)
		{"hello", 7},      // tag + length(1) + 5 bytes
		{"testuser", 10},  // tag + length(1) + 8 bytes
	}

	for _, tt := range tests {
		result := berEncodeOctetString(tt.input)
		if len(result) != tt.wantLen {
			t.Errorf("berEncodeOctetString(%q): got len %d, want %d", tt.input, len(result), tt.wantLen)
		}
		if result[0] != berOctetString {
			t.Errorf("berEncodeOctetString(%q): first byte = 0x%02x, want 0x%02x", tt.input, result[0], berOctetString)
		}
	}
}

func TestBEREncodeInteger(t *testing.T) {
	tests := []struct {
		input    int32
		expected []byte
	}{
		{0, []byte{berInteger, 0x01, 0x00}},
		{3, []byte{berInteger, 0x01, 0x03}},
		{127, []byte{berInteger, 0x01, 0x7F}},
		{128, []byte{berInteger, 0x02, 0x00, 0x80}}, // needs padding for sign bit
	}

	for _, tt := range tests {
		result := berEncodeInteger(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("berEncodeInteger(%d): got len %d, want %d", tt.input, len(result), len(tt.expected))
		}
	}
}

func TestBEREncodeBoolean(t *testing.T) {
	trueResult := berEncodeBoolean(true)
	if len(trueResult) != 3 || trueResult[2] != 0xFF {
		t.Error("berEncodeBoolean(true) should produce [01, 01, FF]")
	}

	falseResult := berEncodeBoolean(false)
	if len(falseResult) != 3 || falseResult[2] != 0x00 {
		t.Error("berEncodeBoolean(false) should produce [01, 01, 00]")
	}
}

func TestBEREncodeSequence(t *testing.T) {
	content := []byte{0x01, 0x02, 0x03}
	result := berEncodeSequence(content)
	if result[0] != berSequence {
		t.Errorf("first byte should be 0x%02x, got 0x%02x", berSequence, result[0])
	}
	if int(result[1]) != len(content) {
		t.Errorf("length byte should be %d, got %d", len(content), result[1])
	}
}

func TestBEREncodeLength(t *testing.T) {
	tests := []struct {
		input    int
		expected []byte
	}{
		{0, []byte{0x00}},
		{1, []byte{0x01}},
		{127, []byte{0x7F}},
		{128, []byte{0x81, 0x80}},
		{255, []byte{0x81, 0xFF}},
		{256, []byte{0x82, 0x01, 0x00}},
	}

	for _, tt := range tests {
		result := berEncodeLength(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("berEncodeLength(%d): got len %d, want %d", tt.input, len(result), len(tt.expected))
			continue
		}
		for i := range result {
			if result[i] != tt.expected[i] {
				t.Errorf("berEncodeLength(%d)[%d]: got 0x%02x, want 0x%02x", tt.input, i, result[i], tt.expected[i])
			}
		}
	}
}

// --- BER Decoding Tests ---

func TestBERDecode(t *testing.T) {
	// Encode then decode an octet string
	encoded := berEncodeOctetString("hello")
	tlv, consumed, err := berDecode(encoded)
	if err != nil {
		t.Fatalf("berDecode error: %v", err)
	}
	if consumed != len(encoded) {
		t.Errorf("consumed %d, want %d", consumed, len(encoded))
	}
	if tlv.Tag != berOctetString {
		t.Errorf("tag = 0x%02x, want 0x%02x", tlv.Tag, berOctetString)
	}
	if string(tlv.Content) != "hello" {
		t.Errorf("content = %q, want %q", string(tlv.Content), "hello")
	}
}

func TestBERDecodeInteger(t *testing.T) {
	tests := []struct {
		input    int32
	}{
		{0},
		{1},
		{42},
		{127},
	}

	for _, tt := range tests {
		encoded := berEncodeInteger(tt.input)
		tlv, _, err := berDecode(encoded)
		if err != nil {
			t.Fatalf("berDecode error for %d: %v", tt.input, err)
		}
		val, err := berDecodeInteger(tlv.Content)
		if err != nil {
			t.Fatalf("berDecodeInteger error for %d: %v", tt.input, err)
		}
		if val != tt.input {
			t.Errorf("roundtrip integer: got %d, want %d", val, tt.input)
		}
	}
}

func TestBERDecodeString(t *testing.T) {
	tests := []string{"", "hello", "testuser", "cn=users,dc=example,dc=com"}
	for _, s := range tests {
		encoded := berEncodeOctetString(s)
		tlv, _, err := berDecode(encoded)
		if err != nil {
			t.Fatalf("berDecode error for %q: %v", s, err)
		}
		decoded := berDecodeString(tlv.Content)
		if decoded != s {
			t.Errorf("roundtrip string: got %q, want %q", decoded, s)
		}
	}
}

func TestBERDecodeSequence(t *testing.T) {
	var content []byte
	content = append(content, berEncodeOctetString("first")...)
	content = append(content, berEncodeOctetString("second")...)
	seq := berEncodeSequence(content)

	tlv, _, err := berDecode(seq)
	if err != nil {
		t.Fatalf("berDecode error: %v", err)
	}
	if tlv.Tag != berSequence {
		t.Errorf("tag = 0x%02x, want 0x%02x", tlv.Tag, berSequence)
	}

	children, err := berDecodeSequence(tlv.Content)
	if err != nil {
		t.Fatalf("berDecodeSequence error: %v", err)
	}
	if len(children) != 2 {
		t.Fatalf("got %d children, want 2", len(children))
	}
	if berDecodeString(children[0].Content) != "first" {
		t.Errorf("first child = %q, want %q", berDecodeString(children[0].Content), "first")
	}
	if berDecodeString(children[1].Content) != "second" {
		t.Errorf("second child = %q, want %q", berDecodeString(children[1].Content), "second")
	}
}

// --- LDAP Message Encoding Tests ---

func TestEncodeBindRequest(t *testing.T) {
	msg := encodeBindRequest(1, "cn=admin,dc=example,dc=com", "secret")

	// Should be a valid BER sequence
	tlv, _, err := berDecode(msg)
	if err != nil {
		t.Fatalf("failed to decode BindRequest: %v", err)
	}
	if tlv.Tag != berSequence {
		t.Errorf("expected sequence tag, got 0x%02x", tlv.Tag)
	}

	// Decode inner: messageID + BindRequest
	children, err := berDecodeSequence(tlv.Content)
	if err != nil {
		t.Fatalf("failed to decode message children: %v", err)
	}
	if len(children) < 2 {
		t.Fatalf("expected at least 2 children, got %d", len(children))
	}

	// Message ID should be 1
	msgID, err := berDecodeInteger(children[0].Content)
	if err != nil {
		t.Fatalf("failed to decode messageID: %v", err)
	}
	if msgID != 1 {
		t.Errorf("messageID = %d, want 1", msgID)
	}

	// Operation should be BindRequest
	if children[1].Tag != appBindRequest {
		t.Errorf("operation tag = 0x%02x, want 0x%02x", children[1].Tag, appBindRequest)
	}
}

func TestEncodeSearchRequest(t *testing.T) {
	msg := encodeSearchRequest(2, "dc=example,dc=com", scopeWholeSubtree, "(uid=testuser)", []string{"mail", "cn"})

	tlv, _, err := berDecode(msg)
	if err != nil {
		t.Fatalf("failed to decode SearchRequest: %v", err)
	}
	if tlv.Tag != berSequence {
		t.Errorf("expected sequence tag, got 0x%02x", tlv.Tag)
	}

	children, err := berDecodeSequence(tlv.Content)
	if err != nil {
		t.Fatalf("failed to decode message children: %v", err)
	}

	msgID, _ := berDecodeInteger(children[0].Content)
	if msgID != 2 {
		t.Errorf("messageID = %d, want 2", msgID)
	}
	if children[1].Tag != appSearchRequest {
		t.Errorf("operation tag = 0x%02x, want 0x%02x", children[1].Tag, appSearchRequest)
	}
}

// --- LDAP Search Filter Tests ---

func TestSearchFilterEquality(t *testing.T) {
	filter := encodeSearchFilter("(uid=testuser)")
	if filter[0] != 0xA3 {
		t.Errorf("equality filter tag = 0x%02x, want 0xA3", filter[0])
	}
}

func TestSearchFilterAnd(t *testing.T) {
	filter := encodeSearchFilter("(&(uid=testuser)(mail=test@example.com))")
	if filter[0] != 0xA0 {
		t.Errorf("AND filter tag = 0x%02x, want 0xA0", filter[0])
	}
}

func TestSearchFilterOr(t *testing.T) {
	filter := encodeSearchFilter("(|(uid=user1)(uid=user2))")
	if filter[0] != 0xA1 {
		t.Errorf("OR filter tag = 0x%02x, want 0xA1", filter[0])
	}
}

func TestSearchFilterNot(t *testing.T) {
	filter := encodeSearchFilter("(!(uid=admin))")
	if filter[0] != 0xA2 {
		t.Errorf("NOT filter tag = 0x%02x, want 0xA2", filter[0])
	}
}

func TestSearchFilterPresence(t *testing.T) {
	filter := encodeSearchFilter("(mail=*)")
	if filter[0] != 0x87 {
		t.Errorf("presence filter tag = 0x%02x, want 0x87", filter[0])
	}
}

func TestSearchFilterGreaterOrEqual(t *testing.T) {
	filter := encodeSearchFilter("(uidNumber>=1000)")
	if filter[0] != 0xA5 {
		t.Errorf(">= filter tag = 0x%02x, want 0xA5", filter[0])
	}
}

func TestSearchFilterLessOrEqual(t *testing.T) {
	filter := encodeSearchFilter("(uidNumber<=5000)")
	if filter[0] != 0xA6 {
		t.Errorf("<= filter tag = 0x%02x, want 0xA6", filter[0])
	}
}

func TestSearchFilterApproximate(t *testing.T) {
	filter := encodeSearchFilter("(cn~=John)")
	if filter[0] != 0xA8 {
		t.Errorf("~= filter tag = 0x%02x, want 0xA8", filter[0])
	}
}

func TestSearchFilterSubstring(t *testing.T) {
	filter := encodeSearchFilter("(cn=*John*)")
	if filter[0] != 0xA4 {
		t.Errorf("substring filter tag = 0x%02x, want 0xA4", filter[0])
	}
}

func TestSplitFilterComponents(t *testing.T) {
	components := splitFilterComponents("(uid=a)(uid=b)(uid=c)")
	if len(components) != 3 {
		t.Errorf("expected 3 components, got %d", len(components))
	}
}

// --- LDAP Config Tests ---

func TestNewLDAPClient_Defaults(t *testing.T) {
	c := NewLDAPClient(LDAPConfig{URL: "ldap://localhost:389"})

	if c.config.EmailAttribute != "mail" {
		t.Errorf("default EmailAttribute = %q, want %q", c.config.EmailAttribute, "mail")
	}
	if c.config.NameAttribute != "cn" {
		t.Errorf("default NameAttribute = %q, want %q", c.config.NameAttribute, "cn")
	}
	if c.config.GroupAttribute != "cn" {
		t.Errorf("default GroupAttribute = %q, want %q", c.config.GroupAttribute, "cn")
	}
	if c.config.UserFilter != "(uid=%s)" {
		t.Errorf("default UserFilter = %q, want %q", c.config.UserFilter, "(uid=%s)")
	}
	if c.config.Timeout != 10*1e9 {
		t.Errorf("default Timeout = %v, want 10s", c.config.Timeout)
	}
}

func TestParseLDAPURL(t *testing.T) {
	tests := []struct {
		url      string
		host     string
		port     string
		useTLS   bool
	}{
		{"ldap://localhost:389", "localhost", "389", false},
		{"ldaps://ldap.example.com", "ldap.example.com", "636", true},
		{"ldap://10.0.0.1:1389", "10.0.0.1", "1389", false},
		{"ldaps://ldap.corp.com:6360", "ldap.corp.com", "6360", true},
		{"ldap://myhost/", "myhost", "389", false},
	}

	for _, tt := range tests {
		host, port, useTLS := ParseLDAPURL(tt.url)
		if host != tt.host {
			t.Errorf("ParseLDAPURL(%q): host = %q, want %q", tt.url, host, tt.host)
		}
		if port != tt.port {
			t.Errorf("ParseLDAPURL(%q): port = %q, want %q", tt.url, port, tt.port)
		}
		if useTLS != tt.useTLS {
			t.Errorf("ParseLDAPURL(%q): useTLS = %v, want %v", tt.url, useTLS, tt.useTLS)
		}
	}
}

func TestMapLDAPGroupsToRoles(t *testing.T) {
	mapping := map[string]string{
		"admins":     "tenant_admin",
		"developers": "developer",
		"sre":        "sre",
	}

	tests := []struct {
		groups   []string
		expected string
	}{
		{[]string{"admins"}, "tenant_admin"},
		{[]string{"developers", "other"}, "developer"},
		{[]string{"sre"}, "sre"},
		{[]string{"unknown"}, "viewer"},     // default
		{[]string{}, "viewer"},              // empty
	}

	for _, tt := range tests {
		result := MapLDAPGroupsToRoles(tt.groups, mapping)
		if result != tt.expected {
			t.Errorf("MapLDAPGroupsToRoles(%v) = %q, want %q", tt.groups, result, tt.expected)
		}
	}
}

func TestDefaultLDAPGroupMapping(t *testing.T) {
	m := DefaultLDAPGroupMapping()
	if len(m) < 5 {
		t.Errorf("expected at least 5 default mappings, got %d", len(m))
	}
	if m["cn=admins,ou=groups,dc=example,dc=com"] != "tenant_admin" {
		t.Error("admins should map to tenant_admin")
	}
}

func TestLDAPClient_Authenticate_NoURL(t *testing.T) {
	c := NewLDAPClient(LDAPConfig{})
	_, err := c.Authenticate(nil, "user", "pass")
	if err == nil {
		t.Error("expected error when LDAP URL not configured")
	}
}

func TestSanitizeLDAPFilter(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"normaluser", "normaluser"},
		{"user*name", "user\\2aname"},
		{"user(name", "user\\28name"},
		{"user)name", "user\\29name"},
		{"user\\name", "user\\5cname"},
		{"admin)(uid=*", "admin\\29\\28uid=\\2a"},
		{"", ""},
	}

	for _, tt := range tests {
		result := sanitizeLDAPFilter(tt.input)
		if result != tt.expected {
			t.Errorf("sanitizeLDAPFilter(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}
