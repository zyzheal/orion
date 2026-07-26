package sso

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"strings"
	"time"
)

// LDAPConfig holds LDAP server configuration.
type LDAPConfig struct {
	// URL is the LDAP server URL (e.g., "ldap://ldap.example.com:389" or "ldaps://ldap.example.com:636").
	URL string `json:"url"`
	// BaseDN is the base DN for user searches (e.g., "dc=example,dc=com").
	BaseDN string `json:"base_dn"`
	// BindDN is the DN for binding (service account). Empty = anonymous bind.
	BindDN string `json:"bind_dn"`
	// BindPassword is the password for the bind DN.
	BindPassword string `json:"bind_password"`
	// UserSearchBase is the OU for user searches (e.g., "ou=users").
	UserSearchBase string `json:"user_search_base"`
	// UserFilter is the search filter for users (e.g., "(uid=%s)" or "(sAMAccountName=%s)").
	UserFilter string `json:"user_filter"`
	// EmailAttribute is the LDAP attribute for email. Default: "mail".
	EmailAttribute string `json:"email_attribute"`
	// NameAttribute is the LDAP attribute for display name. Default: "cn".
	NameAttribute string `json:"name_attribute"`
	// GroupBaseDN is the base DN for group searches.
	GroupBaseDN string `json:"group_base_dn"`
	// GroupFilter is the search filter for groups (e.g., "(member=%s)").
	GroupFilter string `json:"group_filter"`
	// GroupAttribute is the attribute for group name. Default: "cn".
	GroupAttribute string `json:"group_attribute"`
	// UseTLS enables TLS (LDAPS). Default: false (use StartTLS on port 389).
	UseTLS bool `json:"use_tls"`
	// SkipTLSVerify skips TLS certificate verification. Default: false.
	SkipTLSVerify bool `json:"skip_tls_verify"`
	// Timeout is the connection timeout. Default: 10s.
	Timeout time.Duration `json:"timeout"`
}

// LDAPUser represents a user authenticated via LDAP.
type LDAPUser struct {
	DN       string   `json:"dn"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Name     string   `json:"name"`
	Groups   []string `json:"groups"`
}

// LDAPClient provides LDAP authentication and search.
// Uses BER (Basic Encoding Rules) for LDAP protocol encoding/decoding.
// For full-featured LDAP, consider using github.com/go-ldap/ldap/v3.
type LDAPClient struct {
	config LDAPConfig
}

// NewLDAPClient creates a new LDAP client.
func NewLDAPClient(config LDAPConfig) *LDAPClient {
	if config.EmailAttribute == "" {
		config.EmailAttribute = "mail"
	}
	if config.NameAttribute == "" {
		config.NameAttribute = "cn"
	}
	if config.GroupAttribute == "" {
		config.GroupAttribute = "cn"
	}
	if config.UserFilter == "" {
		config.UserFilter = "(uid=%s)"
	}
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	return &LDAPClient{config: config}
}

// Authenticate authenticates a user against the LDAP server.
// Returns the user's LDAP attributes on success.
func (c *LDAPClient) Authenticate(ctx context.Context, username, password string) (*LDAPUser, error) {
	if c.config.URL == "" {
		return nil, fmt.Errorf("LDAP URL not configured")
	}

	// 1. Connect to LDAP server
	conn, err := c.connect()
	if err != nil {
		return nil, fmt.Errorf("LDAP connect: %w", err)
	}
	defer conn.Close()

	// 2. Bind with service account (if configured)
	if c.config.BindDN != "" {
		if err := c.bind(conn, c.config.BindDN, c.config.BindPassword); err != nil {
			return nil, fmt.Errorf("LDAP service bind: %w", err)
		}
	}

	// 3. Search for user
	userDN, attrs, err := c.searchUser(conn, username)
	if err != nil {
		return nil, fmt.Errorf("LDAP user search: %w", err)
	}

	// 4. Bind as user to verify password
	if err := c.bind(conn, userDN, password); err != nil {
		return nil, fmt.Errorf("LDAP authentication failed: %w", err)
	}

	// 5. Re-bind as service account to fetch groups
	if c.config.BindDN != "" {
		_ = c.bind(conn, c.config.BindDN, c.config.BindPassword)
	}

	// 6. Fetch user groups
	groups, _ := c.searchGroups(conn, userDN)

	user := &LDAPUser{
		DN:       userDN,
		Username: username,
		Email:    attrs[c.config.EmailAttribute],
		Name:     attrs[c.config.NameAttribute],
		Groups:   groups,
	}

	// Fallback email
	if user.Email == "" {
		user.Email = username + "@ldap.orion.local"
	}

	return user, nil
}

// ldapConn is a minimal LDAP connection abstraction.
type ldapConn struct {
	conn    net.Conn
	isTLS   bool
	msgID   int32
}

// Close closes the underlying connection.
func (c *ldapConn) Close() error {
	return c.conn.Close()
}

func (c *LDAPClient) connect() (*ldapConn, error) {
	// Parse URL to strip scheme prefix (ldap:// or ldaps://)
	host, port, useTLS := ParseLDAPURL(c.config.URL)
	addr := net.JoinHostPort(host, port)

	if useTLS || c.config.UseTLS {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: c.config.SkipTLSVerify,
		}
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: c.config.Timeout}, "tcp", addr, tlsConfig)
		if err != nil {
			return nil, err
		}
		return &ldapConn{conn: conn, isTLS: true}, nil
	}

	conn, err := net.DialTimeout("tcp", addr, c.config.Timeout)
	if err != nil {
		return nil, err
	}

	// Set read/write deadlines
	_ = conn.SetDeadline(time.Now().Add(c.config.Timeout))

	return &ldapConn{conn: conn, isTLS: false}, nil
}

// nextMessageID returns the next LDAP message ID.
func (c *ldapConn) nextMessageID() int32 {
	c.msgID++
	return c.msgID
}

// --- BER Encoding/Decoding ---

// BER TLV (Tag-Length-Value) encoding for LDAP.

const (
	// Universal tags
	berBoolean      = 0x01
	berInteger      = 0x02
	berOctetString  = 0x04
	berNull         = 0x05
	berEnum         = 0x0A
	berSequence     = 0x30
	berSet          = 0x31

	// Application tags (LDAP operations)
	appBindRequest      = 0x60 // Application 0
	appBindResponse     = 0x61 // Application 1
	appUnbindRequest    = 0x62 // Application 2
	appSearchRequest    = 0x63 // Application 3
	appSearchResultEntry = 0x64 // Application 4
	appSearchResultDone = 0x65 // Application 5

	// Context tags
	ctxAuthSimple = 0x80 // Context 0 (simple auth)

	// Search scope values
	scopeBaseObject   = 0
	scopeSingleLevel  = 1
	scopeWholeSubtree = 2

	// Search deref aliases
	derefNever = 0

	// Result codes
	ldapSuccess              = 0
	ldapOperationsError      = 1
	ldapProtocolError        = 2
	ldapSizeLimitExceeded    = 4
	ldapAuthMethodNotSupported = 7
	ldapInvalidCredentials   = 49
)

// berEncodeLength encodes a length value in BER format.
func berEncodeLength(length int) []byte {
	if length < 0x80 {
		return []byte{byte(length)}
	}
	// Long form
	var buf []byte
	if length <= 0xFF {
		buf = []byte{0x81, byte(length)}
	} else if length <= 0xFFFF {
		buf = []byte{0x82, byte(length >> 8), byte(length)}
	} else {
		buf = []byte{0x83, byte(length >> 16), byte(length >> 8), byte(length)}
	}
	return buf
}

// berEncodeBoolean encodes a boolean as BER boolean.
func berEncodeBoolean(val bool) []byte {
	b := byte(0)
	if val {
		b = 0xFF
	}
	return []byte{berBoolean, 0x01, b}
}

// berEncodeOctetString encodes a string as BER octet string.
func berEncodeOctetString(s string) []byte {
	b := []byte(s)
	result := []byte{berOctetString}
	result = append(result, berEncodeLength(len(b))...)
	result = append(result, b...)
	return result
}

// berEncodeInteger encodes an integer as BER integer.
func berEncodeInteger(val int32) []byte {
	var b []byte
	if val == 0 {
		b = []byte{0}
	} else if val > 0 {
		for val > 0 {
			b = append([]byte{byte(val & 0xFF)}, b...)
			val >>= 8
		}
		if b[0]&0x80 != 0 {
			b = append([]byte{0}, b...)
		}
	} else {
		v := uint32(val)
		for i := 0; i < 4; i++ {
			b = append([]byte{byte(v & 0xFF)}, b...)
			v >>= 8
		}
	}
	result := []byte{berInteger}
	result = append(result, berEncodeLength(len(b))...)
	result = append(result, b...)
	return result
}

// berEncodeSequence encodes a BER sequence (tag 0x30) wrapping the given content.
func berEncodeSequence(content []byte) []byte {
	result := []byte{berSequence}
	result = append(result, berEncodeLength(len(content))...)
	result = append(result, content...)
	return result
}

// berEncodeEnumerated encodes a BER enumerated value.
func berEncodeEnumerated(val int) []byte {
	b := []byte{byte(val)}
	result := []byte{berEnum}
	result = append(result, berEncodeLength(len(b))...)
	result = append(result, b...)
	return result
}

// berTLV represents a decoded BER Tag-Length-Value element.
type berTLV struct {
	Tag     byte
	Content []byte
}

// berDecode decodes a single BER TLV from the given data.
func berDecode(data []byte) (*berTLV, int, error) {
	if len(data) < 2 {
		return nil, 0, fmt.Errorf("BER: data too short")
	}

	tag := data[0]
	pos := 1

	// Decode length
	var length int
	if data[pos] < 0x80 {
		length = int(data[pos])
		pos++
	} else {
		numBytes := int(data[pos] & 0x7F)
		pos++
		if pos+numBytes > len(data) {
			return nil, 0, fmt.Errorf("BER: length bytes overflow")
		}
		length = 0
		for i := 0; i < numBytes; i++ {
			length = (length << 8) | int(data[pos+i])
		}
		pos += numBytes
	}

	if pos+length > len(data) {
		return nil, 0, fmt.Errorf("BER: content overflow (need %d, have %d)", pos+length, len(data))
	}

	tlv := &berTLV{
		Tag:     tag,
		Content: data[pos : pos+length],
	}
	return tlv, pos + length, nil
}

// berDecodeInteger decodes a BER integer value.
func berDecodeInteger(content []byte) (int32, error) {
	if len(content) == 0 {
		return 0, fmt.Errorf("BER: empty integer")
	}
	var val int32
	if content[0]&0x80 != 0 {
		val = -1 // sign extend
	}
	for _, b := range content {
		val = (val << 8) | int32(b)
	}
	return val, nil
}

// berDecodeString decodes a BER octet string value.
func berDecodeString(content []byte) string {
	return string(content)
}

// berDecodeSequence decodes a BER sequence into its child TLVs.
func berDecodeSequence(content []byte) ([]*berTLV, error) {
	var result []*berTLV
	pos := 0
	for pos < len(content) {
		tlv, n, err := berDecode(content[pos:])
		if err != nil {
			return nil, err
		}
		result = append(result, tlv)
		pos += n
	}
	return result, nil
}

// --- LDAP Protocol Messages ---

// encodeLDAPMessage encodes a complete LDAP message (sequence of messageID + operation).
func encodeLDAPMessage(messageID int32, operation byte, operationContent []byte) []byte {
	var buf []byte
	buf = append(buf, berEncodeInteger(messageID)...)
	buf = append(buf, operationContent...)
	return berEncodeSequence(buf)
}

// decodeLDAPMessage decodes an LDAP message and returns (messageID, operationTag, operationContent).
func decodeLDAPMessage(data []byte) (int32, byte, []byte, error) {
	seq, _, err := berDecode(data)
	if err != nil {
		return 0, 0, nil, err
	}
	if seq.Tag != berSequence {
		return 0, 0, nil, fmt.Errorf("LDAP: expected sequence, got 0x%02x", seq.Tag)
	}

	children, err := berDecodeSequence(seq.Content)
	if err != nil {
		return 0, 0, nil, err
	}
	if len(children) < 2 {
		return 0, 0, nil, fmt.Errorf("LDAP: message too short")
	}

	msgID, err := berDecodeInteger(children[0].Content)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("LDAP: bad messageID: %w", err)
	}

	return msgID, children[1].Tag, children[1].Content, nil
}

// --- LDAP Bind ---

// encodeBindRequest encodes an LDAP BindRequest.
func encodeBindRequest(messageID int32, dn, password string) []byte {
	var content []byte
	content = append(content, berEncodeInteger(3)...) // LDAP version 3
	content = append(content, berEncodeOctetString(dn)...)
	content = append(content, ctxAuthSimple|0x00) // simple auth tag = 0x80
	authBytes := []byte(password)
	content = append(content, berEncodeLength(len(authBytes))...)
	content = append(content, authBytes...)

	// Wrap in application tag
	appContent := []byte{appBindRequest}
	appContent = append(appContent, berEncodeLength(len(content))...)
	appContent = append(appContent, content...)

	return encodeLDAPMessage(messageID, appBindRequest, appContent)
}

// bindResult represents an LDAP BindResponse.
type bindResult struct {
	ResultCode int
	MatchedDN  string
	ErrorMsg   string
}

// decodeBindResponse decodes an LDAP BindResponse.
func decodeBindResponse(content []byte) (*bindResult, error) {
	children, err := berDecodeSequence(content)
	if err != nil {
		return nil, fmt.Errorf("LDAP BindResponse: %w", err)
	}
	if len(children) < 3 {
		return nil, fmt.Errorf("LDAP BindResponse: too few fields")
	}

	code, err := berDecodeInteger(children[0].Content)
	if err != nil {
		return nil, fmt.Errorf("LDAP BindResponse resultCode: %w", err)
	}

	return &bindResult{
		ResultCode: int(code),
		MatchedDN:  berDecodeString(children[1].Content),
		ErrorMsg:   berDecodeString(children[2].Content),
	}, nil
}

// sendAndReceive sends an LDAP message and reads the response.
func (c *ldapConn) sendAndReceive(data []byte) (int32, byte, []byte, error) {
	if _, err := c.conn.Write(data); err != nil {
		return 0, 0, nil, fmt.Errorf("LDAP write: %w", err)
	}

	// Read response: BER sequence length first
	resp, err := c.readLDAPMessage()
	if err != nil {
		return 0, 0, nil, fmt.Errorf("LDAP read: %w", err)
	}

	return decodeLDAPMessage(resp)
}

// readLDAPMessage reads a complete BER-encoded LDAP message from the connection.
func (c *ldapConn) readLDAPMessage() ([]byte, error) {
	// Read tag
	tagBuf := make([]byte, 1)
	if _, err := io.ReadFull(c.conn, tagBuf); err != nil {
		return nil, err
	}

	// Read length
	lenBuf := make([]byte, 1)
	if _, err := io.ReadFull(c.conn, lenBuf); err != nil {
		return nil, err
	}

	var contentLen int
	if lenBuf[0] < 0x80 {
		contentLen = int(lenBuf[0])
	} else {
		numBytes := int(lenBuf[0] & 0x7F)
		extBuf := make([]byte, numBytes)
		if _, err := io.ReadFull(c.conn, extBuf); err != nil {
			return nil, err
		}
		contentLen = 0
		for _, b := range extBuf {
			contentLen = (contentLen << 8) | int(b)
		}
		lenBuf = append(lenBuf, extBuf...)
	}

	// Read content
	content := make([]byte, contentLen)
	if _, err := io.ReadFull(c.conn, content); err != nil {
		return nil, err
	}

	// Reassemble: tag + length + content
	result := append(tagBuf, lenBuf...)
	result = append(result, content...)
	return result, nil
}

func (c *LDAPClient) bind(conn *ldapConn, dn, password string) error {
	msg := encodeBindRequest(conn.nextMessageID(), dn, password)
	_, tag, respContent, err := conn.sendAndReceive(msg)
	if err != nil {
		return err
	}

	if tag != appBindResponse {
		return fmt.Errorf("LDAP: expected BindResponse, got 0x%02x", tag)
	}

	result, err := decodeBindResponse(respContent)
	if err != nil {
		return err
	}

	if result.ResultCode != ldapSuccess {
		return fmt.Errorf("LDAP bind failed (code %d): %s", result.ResultCode, result.ErrorMsg)
	}

	return nil
}

// --- LDAP Search ---

// encodeSearchRequest encodes an LDAP SearchRequest.
func encodeSearchRequest(messageID int32, baseDN string, scope int, filter string, attributes []string) []byte {
	var content []byte
	content = append(content, berEncodeOctetString(baseDN)...)
	content = append(content, berEncodeEnumerated(scope)...)
	content = append(content, berEncodeEnumerated(derefNever)...)
	content = append(content, berEncodeInteger(0)...) // sizeLimit = 0 (no limit)
	content = append(content, berEncodeInteger(0)...) // timeLimit = 0 (no limit)
	content = append(content, berEncodeBoolean(false)...)
	// Filter
	filterBytes := encodeSearchFilter(filter)
	content = append(content, filterBytes...)
	// Attributes
	var attrSeq []byte
	for _, attr := range attributes {
		attrSeq = append(attrSeq, berEncodeOctetString(attr)...)
	}
	content = append(content, berEncodeSequence(attrSeq)...)

	appContent := []byte{appSearchRequest}
	appContent = append(appContent, berEncodeLength(len(content))...)
	appContent = append(appContent, content...)

	return encodeLDAPMessage(messageID, appSearchRequest, appContent)
}

// encodeSearchFilter encodes an LDAP search filter.
// Supports: (attr=value), (&...), (|...), (!...), (attr=*), (attr>=val), (attr<=val), (attr~=val)
func encodeSearchFilter(filter string) []byte {
	filter = strings.TrimSpace(filter)
	if len(filter) == 0 {
		return []byte{0x87, 0x00} // present filter for objectClass
	}

	// Simple equality filter: (attr=value)
	if strings.HasPrefix(filter, "(") && strings.HasSuffix(filter, ")") {
		inner := filter[1 : len(filter)-1]

		// AND filter
		if strings.HasPrefix(inner, "&") {
			return encodeCompoundFilter(0xA0, inner[1:])
		}
		// OR filter
		if strings.HasPrefix(inner, "|") {
			return encodeCompoundFilter(0xA1, inner[1:])
		}
		// NOT filter
		if strings.HasPrefix(inner, "!") {
			sub := encodeSearchFilter("(" + inner[1:] + ")")
			result := []byte{0xA2}
			result = append(result, berEncodeLength(len(sub))...)
			result = append(result, sub...)
			return result
		}

		// Presence filter: attr=*
		if strings.HasSuffix(inner, "=*") && !strings.Contains(inner, ">=") && !strings.Contains(inner, "<=") && !strings.Contains(inner, "~=") {
			attr := strings.TrimSuffix(inner, "=*")
			result := []byte{0x87} // context 7 (present)
			result = append(result, berEncodeOctetString(attr)[1:]...) // skip the 0x04 tag
			return result
		}

		// Substring filter: attr=*value* or attr=*value
		if strings.Contains(inner, "=") && strings.Contains(strings.SplitN(inner, "=", 2)[1], "*") {
			parts := strings.SplitN(inner, "=", 2)
			attr := parts[0]
			pattern := parts[1]
			return encodeSubstringFilter(attr, pattern)
		}

		// Greater-or-equal: attr>=value
		if strings.Contains(inner, ">=") {
			parts := strings.SplitN(inner, ">=", 2)
			return encodeAttributeFilter(0xA5, parts[0], parts[1])
		}

		// Less-or-equal: attr<=value
		if strings.Contains(inner, "<=") {
			parts := strings.SplitN(inner, "<=", 2)
			return encodeAttributeFilter(0xA6, parts[0], parts[1])
		}

		// Approximate match: attr~=value
		if strings.Contains(inner, "~=") {
			parts := strings.SplitN(inner, "~=", 2)
			return encodeAttributeFilter(0xA8, parts[0], parts[1])
		}

		// Equality match: attr=value
		if strings.Contains(inner, "=") {
			parts := strings.SplitN(inner, "=", 2)
			return encodeAttributeFilter(0xA3, parts[0], parts[1])
		}
	}

	// Default: treat as present filter
	result := []byte{0x87}
	result = append(result, berEncodeOctetString(filter)...)
	return result
}

// encodeCompoundFilter encodes AND/OR compound filters.
func encodeCompoundFilter(tag byte, inner string) []byte {
	children := splitFilterComponents(inner)
	var childContent []byte
	for _, child := range children {
		childContent = append(childContent, encodeSearchFilter(child)...)
	}
	result := []byte{tag}
	result = append(result, berEncodeLength(len(childContent))...)
	result = append(result, childContent...)
	return result
}

// encodeAttributeFilter encodes equality/greater/less/approximate filters.
func encodeAttributeFilter(tag byte, attr, value string) []byte {
	var content []byte
	content = append(content, berEncodeOctetString(attr)...)
	content = append(content, berEncodeOctetString(value)...)
	result := []byte{tag}
	result = append(result, berEncodeLength(len(content))...)
	result = append(result, content...)
	return result
}

// encodeSubstringFilter encodes a substring filter (attr=*part1*part2*).
func encodeSubstringFilter(attr, pattern string) []byte {
	var content []byte
	content = append(content, berEncodeOctetString(attr)...)

	var subContent []byte
	parts := strings.Split(pattern, "*")
	for i, part := range parts {
		if part == "" {
			continue
		}
		var tag byte
		if i == 0 {
			tag = 0x80 // initial
		} else if i == len(parts)-1 {
			tag = 0x82 // final
		} else {
			tag = 0x81 // any
		}
		sub := []byte{tag}
		sub = append(sub, berEncodeLength(len(part))...)
		sub = append(sub, []byte(part)...)
		subContent = append(subContent, sub...)
	}
	content = append(content, berEncodeSequence(subContent)...)

	result := []byte{0xA4} // context 4 (substring)
	result = append(result, berEncodeLength(len(content))...)
	result = append(result, content...)
	return result
}

// splitFilterComponents splits compound filter components, respecting nested parentheses.
func splitFilterComponents(s string) []string {
	var result []string
	depth := 0
	start := 0
	for i, ch := range s {
		if ch == '(' {
			if depth == 0 {
				start = i
			}
			depth++
		} else if ch == ')' {
			depth--
			if depth == 0 {
				result = append(result, s[start:i+1])
			}
		}
	}
	return result
}

// searchEntry represents an LDAP SearchResultEntry.
type searchEntry struct {
	DN         string
	Attributes map[string][]string
}

// decodeSearchResultEntry decodes an LDAP SearchResultEntry.
func decodeSearchResultEntry(content []byte) (*searchEntry, error) {
	children, err := berDecodeSequence(content)
	if err != nil {
		return nil, err
	}
	if len(children) < 2 {
		return nil, fmt.Errorf("SearchResultEntry: too few fields")
	}

	entry := &searchEntry{
		DN:         berDecodeString(children[0].Content),
		Attributes: make(map[string][]string),
	}

	// Decode attribute list (sequence of sequences)
	attrList, err := berDecodeSequence(children[1].Content)
	if err != nil {
		return nil, err
	}

	for _, attrSeq := range attrList {
		if attrSeq.Tag != berSequence {
			continue
		}
		attrChildren, err := berDecodeSequence(attrSeq.Content)
		if err != nil || len(attrChildren) < 2 {
			continue
		}
		attrName := berDecodeString(attrChildren[0].Content)
		valSet, err := berDecodeSequence(attrChildren[1].Content)
		if err != nil {
			continue
		}
		var values []string
		for _, v := range valSet {
			values = append(values, berDecodeString(v.Content))
		}
		entry.Attributes[attrName] = values
	}

	return entry, nil
}

// searchResultDone represents an LDAP SearchResultDone.
type searchResultDone struct {
	ResultCode int
	MatchedDN  string
	ErrorMsg   string
}

// decodeSearchResultDone decodes an LDAP SearchResultDone.
func decodeSearchResultDone(content []byte) (*searchResultDone, error) {
	children, err := berDecodeSequence(content)
	if err != nil {
		return nil, err
	}
	if len(children) < 3 {
		return nil, fmt.Errorf("SearchResultDone: too few fields")
	}
	code, err := berDecodeInteger(children[0].Content)
	if err != nil {
		return nil, err
	}
	return &searchResultDone{
		ResultCode: int(code),
		MatchedDN:  berDecodeString(children[1].Content),
		ErrorMsg:   berDecodeString(children[2].Content),
	}, nil
}

// sanitizeLDAPFilter escapes special characters in LDAP filter values to prevent LDAP injection.
func sanitizeLDAPFilter(val string) string {
	var buf strings.Builder
	for i := 0; i < len(val); i++ {
		switch val[i] {
		case '\\':
			buf.WriteString("\\5c")
		case '*':
			buf.WriteString("\\2a")
		case '(':
			buf.WriteString("\\28")
		case ')':
			buf.WriteString("\\29")
		case '\x00':
			buf.WriteString("\\00")
		default:
			buf.WriteByte(val[i])
		}
	}
	return buf.String()
}

func (c *LDAPClient) searchUser(conn *ldapConn, username string) (string, map[string]string, error) {
	filter := fmt.Sprintf(c.config.UserFilter, sanitizeLDAPFilter(username))
	baseDN := c.config.BaseDN
	if c.config.UserSearchBase != "" {
		baseDN = c.config.UserSearchBase + "," + c.config.BaseDN
	}

	attrs := []string{"dn", c.config.EmailAttribute, c.config.NameAttribute}
	msg := encodeSearchRequest(conn.nextMessageID(), baseDN, scopeWholeSubtree, filter, attrs)

	if _, err := conn.conn.Write(msg); err != nil {
		return "", nil, fmt.Errorf("LDAP search write: %w", err)
	}

	// Read SearchResultEntry(s) followed by SearchResultDone
	var userDN string
	attrsMap := make(map[string]string)

	for {
		resp, err := conn.readLDAPMessage()
		if err != nil {
			return "", nil, fmt.Errorf("LDAP search read: %w", err)
		}

		_, tag, content, err := decodeLDAPMessage(resp)
		if err != nil {
			return "", nil, err
		}

		switch tag {
		case appSearchResultEntry:
			entry, err := decodeSearchResultEntry(content)
			if err != nil {
				return "", nil, err
			}
			if userDN == "" {
				userDN = entry.DN
			}
			for k, vals := range entry.Attributes {
				if len(vals) > 0 {
					attrsMap[k] = vals[0]
				}
			}
		case appSearchResultDone:
			done, err := decodeSearchResultDone(content)
			if err != nil {
				return "", nil, err
			}
			if done.ResultCode != ldapSuccess {
				return "", nil, fmt.Errorf("LDAP search failed (code %d): %s", done.ResultCode, done.ErrorMsg)
			}
			if userDN == "" {
				return "", nil, fmt.Errorf("LDAP user not found: %s", username)
			}
			return userDN, attrsMap, nil
		default:
			return "", nil, fmt.Errorf("LDAP: unexpected search response tag 0x%02x", tag)
		}
	}
}

func (c *LDAPClient) searchGroups(conn *ldapConn, userDN string) ([]string, error) {
	if c.config.GroupBaseDN == "" || c.config.GroupFilter == "" {
		return nil, nil
	}

	filter := fmt.Sprintf(c.config.GroupFilter, userDN)
	attrs := []string{c.config.GroupAttribute}
	msg := encodeSearchRequest(conn.nextMessageID(), c.config.GroupBaseDN, scopeWholeSubtree, filter, attrs)

	if _, err := conn.conn.Write(msg); err != nil {
		return nil, fmt.Errorf("LDAP group search write: %w", err)
	}

	var groups []string
	for {
		resp, err := conn.readLDAPMessage()
		if err != nil {
			return nil, fmt.Errorf("LDAP group search read: %w", err)
		}

		_, tag, content, err := decodeLDAPMessage(resp)
		if err != nil {
			return nil, err
		}

		switch tag {
		case appSearchResultEntry:
			entry, err := decodeSearchResultEntry(content)
			if err != nil {
				return nil, err
			}
			if vals, ok := entry.Attributes[c.config.GroupAttribute]; ok && len(vals) > 0 {
				groups = append(groups, vals[0])
			}
		case appSearchResultDone:
			done, err := decodeSearchResultDone(content)
			if err != nil {
				return nil, err
			}
			if done.ResultCode != ldapSuccess {
				return nil, fmt.Errorf("LDAP group search failed (code %d): %s", done.ResultCode, done.ErrorMsg)
			}
			return groups, nil
		default:
			return nil, fmt.Errorf("LDAP: unexpected group search response tag 0x%02x", tag)
		}
	}
}

// MapLDAPGroupsToRoles maps LDAP group names to Orion roles.
func MapLDAPGroupsToRoles(groups []string, mapping map[string]string) string {
	for _, group := range groups {
		if role, ok := mapping[group]; ok {
			return role
		}
	}
	return "viewer" // default role
}

// DefaultLDAPGroupMapping returns the default LDAP group → Orion role mapping.
func DefaultLDAPGroupMapping() map[string]string {
	return map[string]string{
		"cn=admins,ou=groups,dc=example,dc=com":      "tenant_admin",
		"cn=developers,ou=groups,dc=example,dc=com":   "developer",
		"cn=sre,ou=groups,dc=example,dc=com":           "sre",
		"cn=devops,ou=groups,dc=example,dc=com":         "developer",
		"cn=readonly,ou=groups,dc=example,dc=com":       "viewer",
		"cn=auditors,ou=groups,dc=example,dc=com":       "auditor",
	}
}

// ParseLDAPURL parses an LDAP URL into host and port.
func ParseLDAPURL(rawURL string) (host string, port string, useTLS bool) {
	if strings.HasPrefix(rawURL, "ldaps://") {
		host = strings.TrimPrefix(rawURL, "ldaps://")
		useTLS = true
		port = "636"
	} else {
		host = strings.TrimPrefix(rawURL, "ldap://")
		port = "389"
	}
	// Strip trailing slash
	host = strings.TrimSuffix(host, "/")
	// Extract port if specified
	if h, p, err := net.SplitHostPort(host); err == nil {
		host = h
		port = p
	}
	return host, port, useTLS
}
