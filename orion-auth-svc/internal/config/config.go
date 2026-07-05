package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName            string
	Environment            string
	HTTPAddr               string
	DatabaseURL            string
	RedisAddr              string
	RedisDB                int
	JWTSecret              string
	JWTExpiration          time.Duration
	JWTRefreshExpiration   time.Duration
	// RS256 key paths (empty = use HS256 for access tokens)
	RS256PrivateKeyPath    string
	RS256PublicKeyPath     string
	// Cookie security
	SecureCookie           bool
	OTelEndpoint           string
	// SSO / OIDC
	OIDCIssuer             string
	OIDCClientID           string
	OIDCClientSecret       string
	OIDCRedirectURI        string
	// LDAP
	LDAPURL                string
	LDAPBindDN             string
	LDAPBindPassword       string
	LDAPUserBaseDN         string
	LDAPUserFilter         string
	LDAPGroupBaseDN        string
	// WeChat
	WeChatCorpID           string
	WeChatCorpSecret       string
	WeChatAgentID          string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-auth-svc")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8082")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion_auth?sslmode=disable")
	v.SetDefault("redis_addr", "localhost:6379")
	v.SetDefault("redis_db", 0)
	v.SetDefault("jwt_secret", "")
	v.SetDefault("jwt_expiration", 5*time.Minute) // spec C-2: 5min access token
	v.SetDefault("jwt_refresh_expiration", 7*24*time.Hour)
	v.SetDefault("rs256_private_key_path", "")
	v.SetDefault("rs256_public_key_path", "")
	v.SetDefault("secure_cookie", true)
	v.SetDefault("otel_endpoint", "")
	// SSO / OIDC
	v.SetDefault("oidc_issuer", "")
	v.SetDefault("oidc_client_id", "")
	v.SetDefault("oidc_client_secret", "")
	v.SetDefault("oidc_redirect_uri", "")
	// LDAP
	v.SetDefault("ldap_url", "")
	v.SetDefault("ldap_bind_dn", "")
	v.SetDefault("ldap_bind_password", "")
	v.SetDefault("ldap_user_base_dn", "")
	v.SetDefault("ldap_user_filter", "(uid=%s)")
	v.SetDefault("ldap_group_base_dn", "")
	// WeChat
	v.SetDefault("wechat_corp_id", "")
	v.SetDefault("wechat_corp_secret", "")
	v.SetDefault("wechat_agent_id", "")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:          getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:          getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:             getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:          getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		RedisAddr:            getEnvOrConfig("REDIS_ADDR", v.GetString("redis_addr")),
		RedisDB:              v.GetInt("redis_db"),
		JWTSecret:            getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		JWTExpiration:        v.GetDuration("jwt_expiration"),
		JWTRefreshExpiration: v.GetDuration("jwt_refresh_expiration"),
		RS256PrivateKeyPath:  getEnvOrConfig("RS256_PRIVATE_KEY_PATH", v.GetString("rs256_private_key_path")),
		RS256PublicKeyPath:   getEnvOrConfig("RS256_PUBLIC_KEY_PATH", v.GetString("rs256_public_key_path")),
		SecureCookie:         v.GetBool("secure_cookie"),
		OTelEndpoint:         getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
		// SSO / OIDC
		OIDCIssuer:           getEnvOrConfig("OIDC_ISSUER", v.GetString("oidc_issuer")),
		OIDCClientID:         getEnvOrConfig("OIDC_CLIENT_ID", v.GetString("oidc_client_id")),
		OIDCClientSecret:     getEnvOrConfig("OIDC_CLIENT_SECRET", v.GetString("oidc_client_secret")),
		OIDCRedirectURI:      getEnvOrConfig("OIDC_REDIRECT_URI", v.GetString("oidc_redirect_uri")),
		// LDAP
		LDAPURL:              getEnvOrConfig("LDAP_URL", v.GetString("ldap_url")),
		LDAPBindDN:           getEnvOrConfig("LDAP_BIND_DN", v.GetString("ldap_bind_dn")),
		LDAPBindPassword:     getEnvOrConfig("LDAP_BIND_PASSWORD", v.GetString("ldap_bind_password")),
		LDAPUserBaseDN:       getEnvOrConfig("LDAP_USER_BASE_DN", v.GetString("ldap_user_base_dn")),
		LDAPUserFilter:       getEnvOrConfig("LDAP_USER_FILTER", v.GetString("ldap_user_filter")),
		LDAPGroupBaseDN:      getEnvOrConfig("LDAP_GROUP_BASE_DN", v.GetString("ldap_group_base_dn")),
		// WeChat
		WeChatCorpID:         getEnvOrConfig("WECHAT_CORP_ID", v.GetString("wechat_corp_id")),
		WeChatCorpSecret:     getEnvOrConfig("WECHAT_CORP_SECRET", v.GetString("wechat_corp_secret")),
		WeChatAgentID:        getEnvOrConfig("WECHAT_AGENT_ID", v.GetString("wechat_agent_id")),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnvOrConfig(envKey string, fallback string) string {
	if val := os.Getenv(envKey); val != "" {
		return val
	}
	return fallback
}
