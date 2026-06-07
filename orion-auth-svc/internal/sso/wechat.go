package sso

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// WeChatConfig holds WeChat OAuth configuration.
type WeChatConfig struct {
	// AppID is the WeChat application ID.
	AppID string `json:"app_id"`
	// AppSecret is the WeChat application secret.
	AppSecret string `json:"app_secret"`
	// RedirectURI is the callback URL registered with WeChat.
	RedirectURI string `json:"redirect_uri"`
	// AgentID is the WeChat Work agent ID (for enterprise WeChat). Optional.
	AgentID string `json:"agent_id,omitempty"`
}

// WeChatOAuthClient implements WeChat OAuth2 authentication.
// Supports both WeChat Open Platform and WeChat Work (企业微信).
type WeChatOAuthClient struct {
	config WeChatConfig
	client *http.Client

	// Work access token cache (WeChat rate-limits token requests to 2000/day)
	workTokenMu    sync.Mutex
	workToken      string
	workTokenExpiry time.Time
}

// NewWeChatOAuthClient creates a new WeChat OAuth client.
func NewWeChatOAuthClient(config WeChatConfig) *WeChatOAuthClient {
	return &WeChatOAuthClient{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// WeChatTokenResponse represents the WeChat token endpoint response.
type WeChatTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenID       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionID      string `json:"unionid,omitempty"`
	ErrCode      int    `json:"errcode,omitempty"`
	ErrMsg       string `json:"errmsg,omitempty"`
}

// WeChatUserInfo represents WeChat user information.
type WeChatUserInfo struct {
	OpenID     string   `json:"openid"`
	Nickname   string   `json:"nickname"`
	Sex        int      `json:"sex"`
	Province   string   `json:"province"`
	City       string   `json:"city"`
	Country    string   `json:"country"`
	HeadImgURL string   `json:"headimgurl"`
	UnionID    string   `json:"unionid,omitempty"`
	ErrCode    int      `json:"errcode,omitempty"`
	ErrMsg     string   `json:"errmsg,omitempty"`
}

// WeChatWorkUserInfo represents WeChat Work user information.
type WeChatWorkUserInfo struct {
	UserID     string `json:"userid"`
	Name       string `json:"name"`
	Department []int  `json:"department"`
	Position   string `json:"position"`
	Mobile     string `json:"mobile"`
	Email      string `json:"email"`
	Avatar     string `json:"avatar"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

// AuthCodeURL generates the WeChat OAuth authorization URL.
func (c *WeChatOAuthClient) AuthCodeURL(state string) string {
	v := url.Values{}
	v.Set("appid", c.config.AppID)
	v.Set("redirect_uri", c.config.RedirectURI)
	v.Set("response_type", "code")
	v.Set("scope", "snsapi_login")
	v.Set("state", state)
	return "https://open.weixin.qq.com/connect/qrconnect?" + v.Encode() + "#wechat_redirect"
}

// WorkAuthCodeURL generates the WeChat Work OAuth authorization URL.
func (c *WeChatOAuthClient) WorkAuthCodeURL(state string) string {
	v := url.Values{}
	v.Set("appid", c.config.AppID)
	v.Set("redirect_uri", c.config.RedirectURI)
	v.Set("response_type", "code")
	v.Set("scope", "snsapi_base")
	v.Set("state", state)
	if c.config.AgentID != "" {
		v.Set("agentid", c.config.AgentID)
	}
	return "https://open.work.weixin.qq.com/wwopen/sso/qrConnect?" + v.Encode()
}

// Exchange exchanges an authorization code for an access token.
func (c *WeChatOAuthClient) Exchange(ctx context.Context, code string) (*WeChatTokenResponse, error) {
	v := url.Values{}
	v.Set("appid", c.config.AppID)
	v.Set("secret", c.config.AppSecret)
	v.Set("code", code)
	v.Set("grant_type", "authorization_code")

	reqURL := "https://api.weixin.qq.com/sns/oauth2/access_token?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create token request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read token response: %w", err)
	}

	var tokenResp WeChatTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}

	if tokenResp.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", tokenResp.ErrCode, tokenResp.ErrMsg)
	}

	return &tokenResp, nil
}

// GetUserInfo fetches user info from WeChat using the access token.
func (c *WeChatOAuthClient) GetUserInfo(ctx context.Context, accessToken, openID string) (*WeChatUserInfo, error) {
	v := url.Values{}
	v.Set("access_token", accessToken)
	v.Set("openid", openID)
	v.Set("lang", "zh_CN")

	reqURL := "https://api.weixin.qq.com/sns/userinfo?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create userinfo request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch userinfo: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read userinfo response: %w", err)
	}

	var userInfo WeChatUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}

	if userInfo.ErrCode != 0 {
		return nil, fmt.Errorf("wechat error %d: %s", userInfo.ErrCode, userInfo.ErrMsg)
	}

	return &userInfo, nil
}

// GetWorkUserInfo fetches user info from WeChat Work.
func (c *WeChatOAuthClient) GetWorkUserInfo(ctx context.Context, code string) (*WeChatWorkUserInfo, error) {
	// 1. Get access token
	token, err := c.getWorkAccessToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("get work access token: %w", err)
	}

	// 2. Get user info
	v := url.Values{}
	v.Set("access_token", token)
	v.Set("code", code)

	reqURL := "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var userInfo WeChatWorkUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if userInfo.ErrCode != 0 {
		return nil, fmt.Errorf("wechat work error %d: %s", userInfo.ErrCode, userInfo.ErrMsg)
	}

	return &userInfo, nil
}

// getWorkAccessToken gets a WeChat Work access token with caching.
// WeChat rate-limits token requests to 2000/day, so we cache the token.
func (c *WeChatOAuthClient) getWorkAccessToken(ctx context.Context) (string, error) {
	c.workTokenMu.Lock()
	defer c.workTokenMu.Unlock()

	// Return cached token if still valid (with 5-minute buffer)
	if c.workToken != "" && time.Now().Before(c.workTokenExpiry.Add(-5*time.Minute)) {
		return c.workToken, nil
	}

	v := url.Values{}
	v.Set("corpid", c.config.AppID)
	v.Set("corpsecret", c.config.AppSecret)

	reqURL := "https://qyapi.weixin.qq.com/cgi-bin/gettoken?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("wechat work error %d: %s", result.ErrCode, result.ErrMsg)
	}

	// Cache the token
	c.workToken = result.AccessToken
	c.workTokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)

	return result.AccessToken, nil
}

// ValidateToken validates an Open Platform access token.
// Returns nil if the token is valid for the configured app.
func (c *WeChatOAuthClient) ValidateToken(ctx context.Context, accessToken, openID string) error {
	v := url.Values{}
	v.Set("access_token", accessToken)
	v.Set("openid", openID)

	reqURL := "https://api.weixin.qq.com/sns/auth?" + v.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return fmt.Errorf("create auth request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("validate token: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode auth response: %w", err)
	}
	if result.ErrCode != 0 {
		return fmt.Errorf("token validation failed (code %d): %s", result.ErrCode, result.ErrMsg)
	}

	return nil
}

// InvalidateWorkToken clears the cached work access token.
func (c *WeChatOAuthClient) InvalidateWorkToken() {
	c.workTokenMu.Lock()
	defer c.workTokenMu.Unlock()
	c.workToken = ""
	c.workTokenExpiry = time.Time{}
}
