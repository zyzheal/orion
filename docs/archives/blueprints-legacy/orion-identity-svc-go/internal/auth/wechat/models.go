package wechat

import (
	"database/sql"
	"time"
)

// WeChatWorkAccount links a WeChat Work identity to an Orion user.
type WeChatWorkAccount struct {
	ID             string        `db:"id" json:"id"`
	TenantID       string        `db:"tenant_id" json:"tenant_id"`
	UserID         string        `db:"user_id" json:"user_id"`
	WechatUserID   string        `db:"wechat_userid" json:"wechat_userid"`
	WechatOpenID   sql.NullString `db:"wechat_openid" json:"wechat_openid,omitempty"`
	Name           sql.NullString `db:"name" json:"name,omitempty"`
	Email          sql.NullString `db:"email" json:"email,omitempty"`
	Mobile         sql.NullString `db:"mobile" json:"mobile,omitempty"`
	DepartmentIDs  []int64       `db:"department_ids" json:"department_ids"`
	Position       sql.NullString `db:"position" json:"position,omitempty"`
	Avatar         sql.NullString `db:"avatar" json:"avatar,omitempty"`
	Linked         bool          `db:"linked" json:"linked"`
	LastSyncedAt   *time.Time    `db:"last_synced_at" json:"last_synced_at,omitempty"`
	CreatedAt      time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time     `db:"updated_at" json:"updated_at"`
}

// WeChatWorkDepartment maps a WeChat Work department to an Orion group.
type WeChatWorkDepartment struct {
	ID              string     `db:"id" json:"id"`
	TenantID        string     `db:"tenant_id" json:"tenant_id"`
	WechatDeptID    int64      `db:"wechat_dept_id" json:"wechat_dept_id"`
	WechatDeptName  sql.NullString `db:"wechat_dept_name" json:"wechat_dept_name"`
	WechatParentID  int64      `db:"wechat_parent_id" json:"wechat_parent_id"`
	OrionGroupID    sql.NullString `db:"orion_group_id" json:"orion_group_id"`
	OrionGroupName  sql.NullString `db:"orion_group_name" json:"orion_group_name"`
	Enabled         bool       `db:"enabled" json:"enabled"`
	LastSyncedAt    *time.Time `db:"last_synced_at" json:"last_synced_at"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

// TokenResponse is the response from WeChat Work /gettoken API.
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int64  `json:"expires_in"`
	ErrCode     int64  `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

// UserInfoResponse is the response from WeChat Work /user/getuserinfo API.
type UserInfoResponse struct {
	ErrCode int64  `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
	UserID  string `json:"UserId"`
	OpenID  string `json:"OpenId"`
}

// UserDetailsResponse is the response from WeChat Work /user/get API.
type UserDetailsResponse struct {
	ErrCode     int64   `json:"errcode"`
	ErrMsg      string  `json:"errmsg"`
	UserID      string  `json:"userid"`
	Name        string  `json:"name"`
	Email       string  `json:"email"`
	Mobile      string  `json:"mobile"`
	Departments []struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	} `json:"departments"`
	Position string `json:"position"`
	Avatar   string `json:"avatar"`
}

// DepartmentListResponse is the response from WeChat Work /department/list API.
type DepartmentListResponse struct {
	ErrCode int64 `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
	Departments []DepartmentItem `json:"department"`
}

// DepartmentItem represents a single department in the list response.
type DepartmentItem struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	ParentID  int64  `json:"parentid"`
	Order     int64  `json:"order"`
	UserName  string `json:"userlist"`
}

// UserProfile is the normalized user profile returned after OAuth callback.
type UserProfile struct {
	UserID      string  `json:"userid"`
	Name        string  `json:"name"`
	Email       string  `json:"email"`
	Mobile      string  `json:"mobile"`
	Departments []int64 `json:"departments"`
	Position    string  `json:"position"`
	Avatar      string  `json:"avatar"`
}

// LocalUserMapping maps a WeChat Work user to a local Orion user.
type LocalUserMapping struct {
	UserID string   `json:"user_id"`
	Username string  `json:"username"`
	Email    string   `json:"email"`
	Name     string   `json:"name"`
	Roles    []string `json:"roles"`
}
