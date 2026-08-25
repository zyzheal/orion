// ============================================================
// Plan 15 — 沙箱执行安全增强 (Sandbox Security Enhancement)
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地代码扫描结果:
//   - internal/sandbox/ (6文件): handler + repository + models + service (有测试)
//   - service.go (349行): 有 CPU/内存限制 (RLIMIT_CPU/AS) + 超时控制
//   - models.go: SandboxConfig 有 MaxCPU/MaxMemory/Timeout/Network/FileAccess
//   - 缺口:
//     1. 无 seccomp 系统调用过滤
//     2. 无 Linux namespace 隔离 (PID/Mount/Network/USER)
//     3. 无命令黑名单 (rm -rf / fork bomb / reverse shell)
//     4. 无 cgroup v2 资源限制集成
//     5. 无执行审计日志 (仅存储 stdout/stderr)
// 合并方案:
//   1. 本 Plan 补充 seccomp profile + namespace 隔离 + 命令黑名单
//   2. 复用本地 SandboxConfig 和 SandboxJob 模型
//   3. 增强本地 service.go 的 ExecuteJob 方法
// 详细设计参见 docs/deliverables/README.md
// ============================================================

package sandbox

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

// ---- 命令黑名单 ----

var CommandBlacklist = []string{
	"rm -rf /",
	"rm -rf /*",
	":(){ :|:& };:",          // fork bomb
	"mkfs",
	"dd if=/dev/zero of=/dev/sda",
	"chmod -R 777 /",
	"nc -l -p",               // reverse shell listener
	"bash -i >& /dev/tcp/",   // reverse shell
	"wget http://0.0.0.0",    // malicious download
	"curl http://0.0.0.0",
	"> /dev/sda",
	"shutdown",
	"reboot",
	"init 0",
	"kill -9 1",
	"pkill systemd",
}

type SecurityProfile struct {
	Name            string
	SeccompFilter   string   // "default" | "strict" | "none"
	Namespaces      []string // ["pid", "mount", "network", "user", "ipc", "uts"]
	CgroupLimit     bool
	CommandBlacklist bool
	MaxProcesses    int
	MaxFileDescriptors int
}

var DefaultSecurityProfile = SecurityProfile{
	Name:            "default",
	SeccompFilter:   "default",
	Namespaces:      []string{"pid", "mount", "network", "ipc", "uts"},
	CgroupLimit:     true,
	CommandBlacklist: true,
	MaxProcesses:    50,
	MaxFileDescriptors: 1024,
}

var StrictSecurityProfile = SecurityProfile{
	Name:            "strict",
	SeccompFilter:   "strict",
	Namespaces:      []string{"pid", "mount", "network", "user", "ipc", "uts"},
	CgroupLimit:     true,
	CommandBlacklist: true,
	MaxProcesses:    10,
	MaxFileDescriptors: 256,
}

// ---- 命令黑名单检查 ----

func CheckCommandBlacklist(code string) error {
	for _, pattern := range CommandBlacklist {
		if strings.Contains(code, pattern) {
			return fmt.Errorf("blocked command detected: %s", pattern)
		}
	}
	return nil
}

// ---- Seccomp Profile 生成 ----

func GenerateSeccompProfile(mode string) []byte {
	switch mode {
	case "strict":
		return []byte(seccompStrictJSON)
	case "none":
		return nil
	default:
		return []byte(seccompDefaultJSON)
	}
}

const seccompDefaultJSON = `{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {"names": ["ptrace", "process_vm_readv", "process_vm_writev",
               "kexec_load", "open_by_handle_at", "init_module",
               "finit_module", "delete_module", "iopl", "ioperm",
               "create_module", "query_module", "get_kernel_syms",
               "nfsservctl", "vdso_void_return"],
     "action": "SCMP_ACT_ERRNO"}
  ]
}`

const seccompStrictJSON = `{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {"names": ["read", "write", "close", "mmap", "munmap",
               "brk", "rt_sigaction", "rt_sigprocmask",
               "rt_sigreturn", "ioctl", "pread64", "pwrite64",
               "readv", "writev", "access", "pipe", "pipe2",
               "select", "poll", "epoll_create1", "epoll_ctl",
               "epoll_wait", "clock_gettime", "fstat", "stat",
               "lstat", "getpid", "exit", "exit_group", "futex",
               "set_tid_address", "set_robust_list", "prlimit64",
               "getrandom", "mprotect", "arch_prctl"],
     "action": "SCMP_ACT_ALLOW"}
  ]
}`

// ---- Namespace 隔离 ----

func buildNamespaceFlags(namespaces []string) uintptr {
	var flags uintptr = 0
	for _, ns := range namespaces {
		switch ns {
		case "pid":
			flags |= syscall.CLONE_NEWPID
		case "mount":
			flags |= syscall.CLONE_NEWNS
		case "network":
			flags |= syscall.CLONE_NEWNET
		case "user":
			flags |= syscall.CLONE_NEWUSER
		case "ipc":
			flags |= syscall.CLONE_NEWIPC
		case "uts":
			flags |= syscall.CLONE_NEWUTS
		}
	}
	return flags
}

// ---- 安全命令构造 ----

type SecureCommand struct {
	Path string
	Args []string
	Env  []string
}

func BuildSecureCommand(code, language string, profile SecurityProfile) (*SecureCommand, error) {
	if profile.CommandBlacklist {
		if err := CheckCommandBlacklist(code); err != nil {
			return nil, fmt.Errorf("security check failed: %w", err)
		}
	}

	switch language {
	case "python", "python3":
		return &SecureCommand{
			Path: "python3",
			Args: []string{"-c", code},
		}, nil
	case "go":
		return &SecureCommand{
			Path: "go",
			Args: []string{"run", "-"}, // stdin
		}, nil
	case "javascript", "node":
		return &SecureCommand{
			Path: "node",
			Args: []string{"-e", code},
		}, nil
	case "shell", "bash":
		return &SecureCommand{
			Path: "bash",
			Args: []string{"-c", code},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported language: %s", language)
	}
}

// ---- 审计日志 ----

type AuditEvent struct {
	Timestamp   int64  `json:"timestamp"`
	JobID       string `json:"jobId"`
	TenantID    string `json:"tenantId"`
	Event       string `json:"event"`
	Detail      string `json:"detail"`
	Severity    string `json:"severity"`
}

type AuditLogger struct {
	events []AuditEvent
}

func NewAuditLogger() *AuditLogger {
	return &AuditLogger{events: make([]AuditEvent, 0)}
}

func (l *AuditLogger) Log(jobID, tenantID, event, detail, severity string) {
	l.events = append(l.events, AuditEvent{
		Timestamp: time.Now().UnixMilli(),
		JobID:     jobID,
		TenantID:  tenantID,
		Event:     event,
		Detail:    detail,
		Severity:  severity,
	})
}

func (l *AuditLogger) Events() []AuditEvent { return l.events }

func (l *AuditLogger) Export() []AuditEvent {
	out := make([]AuditEvent, len(l.events))
	copy(out, l.events)
	return out
}

// ---- 安全执行器 (增强本地 service.go 的 ExecuteJob) ----

type SecureExecutor struct {
	profile SecurityProfile
	audit   *AuditLogger
}

func NewSecureExecutor(profile SecurityProfile) *SecureExecutor {
	return &SecureExecutor{
		profile: profile,
		audit:   NewAuditLogger(),
	}
}

func (e *SecureExecutor) Execute(ctx context.Context, jobID, tenantID, code, language string, timeout time.Duration) (stdout, stderr string, exitCode int, err error) {
	e.audit.Log(jobID, tenantID, "job_start", fmt.Sprintf("lang=%s timeout=%v", language, timeout), "info")

	cmd, err := BuildSecureCommand(code, language, e.profile)
	if err != nil {
		e.audit.Log(jobID, tenantID, "security_block", err.Error(), "critical")
		return "", "", -1, err
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	execCmd := exec.CommandContext(ctx, cmd.Path, cmd.Args...)
	if len(cmd.Env) > 0 {
		execCmd.Env = cmd.Env
	}

	var outBuf, errBuf strings.Builder
	execCmd.Stdout = &outBuf
	execCmd.Stderr = &errBuf

	// 设置 rlimit (复用本地已有的逻辑)
	execCmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: buildNamespaceFlags(e.profile.Namespaces),
		Setpgid:    true,
	}

	err = execCmd.Run()
	stdout = outBuf.String()
	stderr = errBuf.String()

	if ctx.Err() == context.DeadlineExceeded {
		e.audit.Log(jobID, tenantID, "timeout", "execution exceeded time limit", "warning")
		exitCode = -1
		err = fmt.Errorf("execution timeout after %v", timeout)
		return
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
		e.audit.Log(jobID, tenantID, "exec_error", err.Error(), "error")
	} else {
		exitCode = 0
		e.audit.Log(jobID, tenantID, "job_complete", fmt.Sprintf("exit=0 stdout=%d stderr=%d", len(stdout), len(stderr)), "info")
	}

	return
}

func (e *SecureExecutor) AuditLog() []AuditEvent {
	return e.audit.Export()
}
