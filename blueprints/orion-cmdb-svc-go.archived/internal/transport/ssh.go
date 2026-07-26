// ============================================================
// SSH Transport — 网络设备 SSH 采集底层
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集 (SSH 模式)
//   - Netmiko / Paramiko 等 Python 库的 Go 实现
//
// 职责:
//   - 封装 SSH 连接/命令执行/会话管理
//   - 支持 Cisco IOS / Huawei VRP / H3C Comware 等 CLI 协议
//   - 处理 SSH 认证 (密码 / 密钥)
//   - 实现命令超时和退出码检测
//
// 厂商 CLI 模式:
//   - Cisco IOS: enable -> show commands
//   - Huawei VRP: system-view -> display commands
//   - H3C Comware: display commands (无需 system-view)
package transport

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"golang.org/x/crypto/ssh"
)

// ============================================================
// SSH 配置
// ============================================================

// SSHConfig SSH 连接配置
type SSHConfig struct {
	Target    string `yaml:"target"`
	Port      int    `yaml:"port"`       // 默认 22
	Username  string `yaml:"username"`
	Password  string `yaml:"password"`
	KeyPath   string `yaml:"key_path"`   // SSH 私钥路径 (二选一)
	KeyPass   string `yaml:"key_pass"`   // 私钥密码

	// 厂商特定配置
	CliMode  string `yaml:"cli_mode"` // cisco_ios / huawei_vrp / h3c_comware
	Timeout  int    `yaml:"timeout"`  // 命令超时秒数，默认 30

	// 厂商特定命令前缀
	EnableCmd  string `yaml:"enable_cmd"`  // enable 命令 (Cisco)
	EnablePass string `yaml:"enable_pass"` // enable 密码
}

// DefaultSSHConfig 默认 SSH 配置
func DefaultSSHConfig() *SSHConfig {
	return &SSHConfig{
		Port:     22,
		Timeout:  30,
		CliMode:  "generic",
		EnableCmd: "enable",
	}
}

// Validate 校验 SSH 配置
func (c *SSHConfig) Validate() error {
	if c.Target == "" {
		return fmt.Errorf("ssh target is required")
	}
	if c.Username == "" {
		return fmt.Errorf("ssh username is required")
	}
	if c.Password == "" && c.KeyPath == "" {
		return fmt.Errorf("ssh password or key_path is required")
	}
	if c.Port <= 0 {
		c.Port = 22
	}
	if c.Timeout <= 0 {
		c.Timeout = 30
	}
	return nil
}

// NetAddr 返回网络地址
func (c *SSHConfig) NetAddr() string {
	if c.Port == 0 {
		c.Port = 22
	}
	return fmt.Sprintf("%s:%d", c.Target, c.Port)
}

// ============================================================
// SSHClient 客户端封装
// ============================================================

// SSHClient SSH 客户端
type SSHClient struct {
	config *SSHConfig
	client *ssh.Client
	session *ssh.Session
}

// NewSSHClient 创建 SSH 客户端
func NewSSHClient(config *SSHConfig) (*SSHClient, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid ssh config: %w", err)
	}
	return &SSHClient{config: config}, nil
}

// connect 建立 SSH 连接
func (c *SSHClient) connect(ctx context.Context) error {
	// TODO: 实现完整 SSH 认证逻辑
	// 支持密码认证和密钥认证
	//
	// authMethods := []ssh.AuthMethod{}
	// if c.config.Password != "" {
	//     authMethods = append(authMethods, ssh.Password(c.config.Password))
	// }
	// if c.config.KeyPath != "" {
	//     signer, err := loadSSHKey(c.config.KeyPath, c.config.KeyPass)
	//     if err != nil { return err }
	//     authMethods = append(authMethods, ssh.PublicKeys(signer))
	// }
	//
	// sshConfig := &ssh.ClientConfig{
	//     User: c.config.Username,
	//     Auth: authMethods,
	//     HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	//     Timeout: time.Duration(c.config.Timeout) * time.Second,
	// }
	//
	// client, err := ssh.Dial("tcp", c.config.NetAddr(), sshConfig)
	// if err != nil { return err }
	// c.client = client

	return fmt.Errorf("ssh connect not implemented yet")
}

// Close 关闭 SSH 连接
func (c *SSHClient) Close() {
	if c.session != nil {
		c.session.Close()
	}
	if c.client != nil {
		c.client.Close()
	}
}

// Execute 执行远程命令
func (c *SSHClient) Execute(ctx context.Context, cmd string) (string, error) {
	slog.Debug("ssh execute", "target", c.config.NetAddr(), "cmd", cmd)

	// TODO: 实现命令执行
	// session, err := c.client.NewSession()
	// if err != nil { return "", err }
	// defer session.Close()
	//
	// buf, err := session.CombinedOutput(cmd)
	// if err != nil { return "", err }
	// return string(buf), nil

	return "", fmt.Errorf("ssh execute not implemented yet")
}

// ExecuteWithPrompt 执行命令并检测提示符 (用于交互式命令)
func (c *SSHClient) ExecuteWithPrompt(ctx context.Context, cmd string) (string, error) {
	slog.Debug("ssh execute with prompt", "target", c.config.NetAddr(), "cmd", cmd)

	// TODO: 实现交互式命令执行
	// 检测厂商特定的提示符:
	//   - Cisco: > / #
	//   - Huawei: > / # / [ ]
	//   - H3C: > / #

	return "", fmt.Errorf("ssh execute with prompt not implemented yet")
}

// Ping 探测 SSH 可达性
func (c *SSHClient) Ping(ctx context.Context) (bool, error) {
	slog.Debug("ssh ping", "target", c.config.NetAddr())

	// 简化实现: 尝试建立 SSH 连接
	if err := c.connect(ctx); err != nil {
		return false, fmt.Errorf("ssh ping failed: %w", err)
	}
	c.Close()
	return true, nil
}

// ============================================================
// 厂商 CLI 模式封装
// ============================================================

// CLIMode 厂商 CLI 模式
type CLIMode string

const (
	CLIModeCiscoIOS   CLIMode = "cisco_ios"
	CLIModeHuaweiVRP  CLIMode = "huawei_vrp"
	CLIModeH3CComware CLIMode = "h3c_comware"
	CLIModeJuniper    CLIMode = "juniper_junos"
)

// CLICommands 厂商 CLI 命令集
type CLICommands struct {
	Name        string
	Mode        CLIMode
	ShowVersion string // 版本信息命令
	ShowConfig  string // 配置信息命令
	ShowInterface string // 接口信息命令
	ShowNeighbors string // 邻居信息命令
	ExitCmd     string // 退出命令
}

// DefaultCLICommands 默认厂商 CLI 命令
var DefaultCLICommands = map[CLIMode]*CLICommands{
	CLIModeCiscoIOS: {
		Name:        "Cisco IOS",
		Mode:        CLIModeCiscoIOS,
		ShowVersion: "show version",
		ShowConfig:  "show running-config",
		ShowInterface: "show interfaces description",
		ShowNeighbors: "show cdp neighbors detail",
		ExitCmd:    "exit",
	},
	CLIModeHuaweiVRP: {
		Name:        "Huawei VRP",
		Mode:        CLIModeHuaweiVRP,
		ShowVersion: "display version",
		ShowConfig:  "display current-configuration",
		ShowInterface: "display interface brief",
		ShowNeighbors: "display lldp neighbor",
		ExitCmd:    "quit",
	},
	CLIModeH3CComware: {
		Name:        "H3C Comware",
		Mode:        CLIModeH3CComware,
		ShowVersion: "display version",
		ShowConfig:  "display current-configuration",
		ShowInterface: "display interface brief",
		ShowNeighbors: "display lldp neighbor-information",
		ExitCmd:    "quit",
	},
}

// GetCLICommands 获取厂商 CLI 命令
func GetCLICommands(mode CLIMode) *CLICommands {
	return DefaultCLICommands[mode]
}
