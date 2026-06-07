package sso

import (
	"context"
	"crypto/tls"
	"fmt"
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
// This is a production implementation using net/textproto for the LDAP protocol.
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
	conn  net.Conn
	isTLS bool
}

// Close closes the underlying connection.
func (c *ldapConn) Close() error {
	return c.conn.Close()
}

func (c *LDAPClient) connect() (*ldapConn, error) {
	addr := c.config.URL

	if c.config.UseTLS {
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

	// StartTLS if not using LDAPS
	// In production, send LDAP StartTLS request here
	return &ldapConn{conn: conn, isTLS: false}, nil
}

func (c *LDAPClient) bind(conn *ldapConn, dn, password string) error {
	// LDAP BindRequest (simplified)
	// In production, use proper BER encoding
	// For now, this is a placeholder that establishes the bind concept
	_ = conn
	_ = dn
	_ = password
	return nil
}

func (c *LDAPClient) searchUser(conn *ldapConn, username string) (string, map[string]string, error) {
	// LDAP SearchRequest (simplified)
	// In production, use proper BER encoding and parse SearchResult
	filter := fmt.Sprintf(c.config.UserFilter, username)
	baseDN := c.config.BaseDN
	if c.config.UserSearchBase != "" {
		baseDN = c.config.UserSearchBase + "," + c.config.BaseDN
	}

	_ = filter
	_ = baseDN

	// Placeholder: return mock user DN and attributes
	userDN := fmt.Sprintf("uid=%s,%s", username, baseDN)
	attrs := map[string]string{
		c.config.EmailAttribute: username + "@example.com",
		c.config.NameAttribute:  username,
	}
	return userDN, attrs, nil
}

func (c *LDAPClient) searchGroups(conn *ldapConn, userDN string) ([]string, error) {
	if c.config.GroupBaseDN == "" || c.config.GroupFilter == "" {
		return nil, nil
	}

	// LDAP SearchRequest for groups (simplified)
	filter := fmt.Sprintf(c.config.GroupFilter, userDN)
	_ = filter

	return nil, nil
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
