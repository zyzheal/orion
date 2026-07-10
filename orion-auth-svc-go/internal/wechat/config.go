package wechat

import (
	"os"
	"strconv"
)

// Config holds the WeChat Work SSO configuration.
type Config struct {
	CorpID       string // Enterprise WeChat Corp ID
	AgentID      string // Agent ID for the application
	CorpSecret   string // Corp Secret for API access
	Enabled      bool   // Whether WeChat Work SSO is enabled
	TokenExpirySec int64 // Expected token expiry in seconds (default 7200)
}

// LoadConfig reads WeChat Work configuration from environment variables.
func LoadConfig() *Config {
	enabled := os.Getenv("WECHAT_WORK_ENABLED") == "true"

	tokenExpiry := 7200
	if raw := os.Getenv("WECHAT_WORK_TOKEN_EXPIRY"); raw != "" {
		if v, err := strconv.ParseInt(raw, 10, 64); err == nil {
			tokenExpiry = v
		}
	}

	return &Config{
		CorpID:         os.Getenv("WECHAT_WORK_CORP_ID"),
		AgentID:        os.Getenv("WECHAT_WORK_AGENT_ID"),
		CorpSecret:     os.Getenv("WECHAT_WORK_CORP_SECRET"),
		Enabled:        enabled,
		TokenExpirySec: tokenExpiry,
	}
}
