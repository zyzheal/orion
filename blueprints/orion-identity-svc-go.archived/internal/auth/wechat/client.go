package wechat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ErrNotEnabled is returned when WeChat Work SSO is not configured.
var ErrNotEnabled = errors.New("wechat work SSO is not enabled or misconfigured")

const (
	wechatAPIBase    = "https://qyapi.weixin.qq.com/cgi-bin"
	authorizationURL = "https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
)

// Client handles all HTTP calls to the WeChat Work API.
type Client struct {
	cfg     *Config
	http    *http.Client

	mu          sync.RWMutex
	cachedToken string
	cachedAt    time.Time
}

// NewClient creates a WeChat Work API client.
func NewClient(cfg *Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 10 * time.Second},
	}
}

// IsEnabled returns true if the configuration is complete.
func (c *Client) IsEnabled() bool {
	return c.cfg.Enabled && c.cfg.CorpID != "" && c.cfg.CorpSecret != ""
}

// GetAuthorizationURL builds the OAuth authorization URL.
func (c *Client) GetAuthorizationURL(redirectURI, state string) string {
	return fmt.Sprintf(
		"%s?appid=%s&agentid=%s&redirect_uri=%s&state=%s",
		authorizationURL,
		c.cfg.CorpID,
		c.cfg.AgentID,
		redirectURI,
		state,
	)
}

// GetToken retrieves (and caches) the corp access token.
func (c *Client) GetToken(ctx context.Context) (string, error) {
	c.mu.RLock()
	if c.cachedToken != "" && time.Since(c.cachedAt) < (time.Duration(c.cfg.TokenExpirySec-defaultTokenBufferSec) * time.Second) {
		token := c.cachedToken
		c.mu.RUnlock()
		return token, nil
	}
	c.mu.RUnlock()

	url := fmt.Sprintf("%s/gettoken?corpid=%s&corpsecret=%s", wechatAPIBase, c.cfg.CorpID, c.cfg.CorpSecret)

	resp, err := c.http.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch wechat token: %w", err)
	}
	defer resp.Body.Close()

	var result TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode wechat token response: %w", err)
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("wechat token error (code=%d): %s", result.ErrCode, result.ErrMsg)
	}

	// Cache the token
	c.mu.Lock()
	c.cachedToken = result.AccessToken
	c.cachedAt = time.Now()
	c.mu.Unlock()

	return result.AccessToken, nil
}

// GetUserInfo exchanges an authorization code for a WeChat Work user profile.
// Step 1: /user/getuserinfo -> UserID
// Step 2: /user/get -> full profile
func (c *Client) GetUserInfo(ctx context.Context, code string) (*UserProfile, error) {
	accessToken, err := c.GetToken(ctx)
	if err != nil {
		return nil, err
	}

	// Step 1: exchange code for userid
	userInfoURL := fmt.Sprintf("%s/user/getuserinfo?access_token=%s&code=%s", wechatAPIBase, accessToken, code)

	resp, err := c.http.Get(userInfoURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch wechat user info: %w", err)
	}
	defer resp.Body.Close()

	var userInfoResp UserInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&userInfoResp); err != nil {
		return nil, fmt.Errorf("failed to decode wechat userinfo response: %w", err)
	}
	if userInfoResp.ErrCode != 0 {
		return nil, fmt.Errorf("wechat userinfo error (code=%d): %s", userInfoResp.ErrCode, userInfoResp.ErrMsg)
	}

	userID := userInfoResp.UserID
	if userID == "" {
		userID = userInfoResp.OpenID // fallback to OpenId for external contacts
	}
	if userID == "" {
		return nil, fmt.Errorf("wechat userinfo response missing UserId and OpenId")
	}

	// Step 2: get detailed user profile
	userDetailURL := fmt.Sprintf("%s/user/get?access_token=%s&userid=%s", wechatAPIBase, accessToken, userID)

	resp, err = c.http.Get(userDetailURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch wechat user details: %w", err)
	}
	defer resp.Body.Close()

	var detailResp UserDetailsResponse
	if err := json.NewDecoder(resp.Body).Decode(&detailResp); err != nil {
		return nil, fmt.Errorf("failed to decode wechat user details response: %w", err)
	}
	if detailResp.ErrCode != 0 {
		return nil, fmt.Errorf("wechat user details error (code=%d): %s", detailResp.ErrCode, detailResp.ErrMsg)
	}

	departments := make([]int64, 0, len(detailResp.Departments))
	for _, d := range detailResp.Departments {
		departments = append(departments, d.ID)
	}

	return &UserProfile{
		UserID:      detailResp.UserID,
		Name:        detailResp.Name,
		Email:       detailResp.Email,
		Mobile:      detailResp.Mobile,
		Departments: departments,
		Position:    detailResp.Position,
		Avatar:      detailResp.Avatar,
	}, nil
}

// TestConnection verifies the WeChat Work API connectivity.
func (c *Client) TestConnection(ctx context.Context) (bool, string) {
	if !c.IsEnabled() {
		return false, "企业微信 SSO 未启用"
	}
	_, err := c.GetToken(ctx)
	if err != nil {
		return false, err.Error()
	}
	return true, "企业微信 API 连接成功"
}

// syncTokenBufferSec is the safety margin before token expiry.
const defaultTokenBufferSec int64 = 300

// ---- Department sync helpers ----

// ListDepartments calls WeChat Work department list API.
// If id is 0, lists all departments.
func (c *Client) ListDepartments(ctx context.Context, parentID int64) ([]DepartmentItem, error) {
	accessToken, err := c.GetToken(ctx)
	if err != nil {
		return nil, err
	}

	// WeChat department/list expects parentid as JSON body (0 for root).
	jsonBody, _ := json.Marshal(map[string]any{"parentid": parentID})
	resp, err := c.http.Post(
		fmt.Sprintf("%s/department/list?access_token=%s", wechatAPIBase, accessToken),
		"application/json",
		io.NopCloser(strings.NewReader(string(jsonBody))),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch wechat departments: %w", err)
	}
	defer resp.Body.Close()

	var result DepartmentListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode department list: %w", err)
	}
	if result.ErrCode != 0 {
		return nil, fmt.Errorf("wechat department list error (code=%d): %s", result.ErrCode, result.ErrMsg)
	}

	return result.Departments, nil
}
