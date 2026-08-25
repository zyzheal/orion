// ============================================================
// Plan 37 — Chaos 真实故障注入器
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — Chaos 模块有框架但无真实故障注入
// 本地证据:
//   - internal/chaos/service/service.go: 有 ExecuteCPUSpike/ExecuteMemoryLeak/ExecuteNetworkLatency
//   - Execute 函数仅创建 InjectResult 记录, 不执行真实故障注入
//   - 无 Docker/K8s API 集成
// 合并 Plan-28: chaos.go (205行) 的 FaultType 定义可复用
// 技术约束: Go, Docker SDK, k8s.io/client-go
// ============================================================

package service

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"go.uber.org/zap"
)

// --- Fault Types (合并 Plan-28 定义) ---

type FaultType string

const (
	FaultCPUStress      FaultType = "cpu_stress"
	FaultMemoryLeak     FaultType = "memory_leak"
	FaultNetworkLatency FaultType = "network_latency"
	FaultNetworkLoss    FaultType = "network_loss"
	FaultNetworkBandwidth FaultType = "network_bandwidth"
	FaultDiskFill       FaultType = "disk_fill"
	FaultProcessKill    FaultType = "process_kill"
	FaultDNSBl          FaultType = "dns_block"
	FaultServiceDown    FaultType = "service_down"
)

type FaultTarget struct {
	Type     string // "docker", "k8s", "host"
	Container string // Docker 容器名 (type=docker)
	Namespace string // K8s namespace (type=k8s)
	PodName   string // K8s Pod 名 (type=k8s)
	Host       string // 主机地址 (type=host)
}

type FaultConfig struct {
	Type       FaultType   `json:"type"`
	Target     FaultTarget `json:"target"`
	Duration   time.Duration `json:"duration"`
	// CPU 故障
	CPUCores   int         `json:"cpuCores,omitempty"`    // 占用 CPU 核数
	CPULoad    int         `json:"cpuLoad,omitempty"`       // CPU 负载百分比
	// 内存故障
	MemoryMB   int         `json:"memoryMB,omitempty"`     // 占用内存 MB
	// 网络故障
	Latency    time.Duration `json:"latency,omitempty"`    // 网络延迟
	LossRate   float64    `json:"lossRate,omitempty"`      // 丢包率 0-1
	Bandwidth  string     `json:"bandwidth,omitempty"`     // 带宽限制 (1mbps)
	// 磁盘故障
	DiskPath   string     `json:"diskPath,omitempty"`     // 磁盘路径
	DiskFillMB int        `json:"diskFillMB,omitempty"`   // 填充 MB
	// 进程故障
	ProcessName string    `json:"processName,omitempty"`
	Signal      string    `json:"signal,omitempty"`       // SIGTERM, SIGKILL
}

type InjectionResult struct {
	ID         string      `json:"id"`
	ExperimentID string    `json:"experimentId"`
	Status     string      `json:"status"` // running, completed, failed, reverted
	FaultType  FaultType   `json:"faultType"`
	Target     FaultTarget `json:"target"`
	StartedAt  time.Time  `json:"startedAt"`
	EndedAt    *time.Time `json:"endedAt,omitempty"`
	Output     string      `json:"output,omitempty"`
	Error      string      `json:"error,omitempty"`
}

// --- Injector ---

type FaultInjector struct {
	dockerCli *client.Client
	logger    *zap.Logger

	mu         sync.Mutex
	activeInjections map[string]*InjectionResult // injectionID → result
}

func NewFaultInjector(logger *zap.Logger) (*FaultInjector, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		// 降级: 无 Docker 客户端 (仅支持 K8s/Host 故障)
		logger.Warn("docker client init failed, docker actions disabled", zap.Error(err))
		return &FaultInjector{
			logger:           logger,
			activeInjections: make(map[string]*InjectionResult),
		}, nil
	}

	return &FaultInjector{
		dockerCli:        cli,
		logger:           logger,
		activeInjections: make(map[string]*InjectionResult),
	}, nil
}

// --- Public API ---

// Inject 注入故障
func (i *FaultInjector) Inject(ctx context.Context, cfg FaultConfig) (*InjectionResult, error) {
	injectionID := fmt.Sprintf("inj-%d-%s", time.Now().Unix(), cfg.Type)

	result := &InjectionResult{
		ID:           injectionID,
		Status:       "running",
		FaultType:    cfg.Type,
		Target:       cfg.Target,
		StartedAt:    time.Now(),
	}

	// 记录到活跃注入列表
	i.mu.Lock()
	i.activeInjections[injectionID] = result
	i.mu.Unlock()

	// 执行故障注入
	var err error
	switch cfg.Type {
	case FaultCPUStress:
		err = i.injectCPUStress(ctx, cfg)
	case FaultMemoryLeak:
		err = i.injectMemoryLeak(ctx, cfg)
	case FaultNetworkLatency:
		err = i.injectNetworkLatency(ctx, cfg)
	case FaultNetworkLoss:
		err = i.injectNetworkLoss(ctx, cfg)
	case FaultNetworkBandwidth:
		err = i.injectNetworkBandwidth(ctx, cfg)
	case FaultDiskFill:
		err = i.injectDiskFill(ctx, cfg)
	case FaultProcessKill:
		err = i.injectProcessKill(ctx, cfg)
	case FaultServiceDown:
		err = i.injectServiceDown(ctx, cfg)
	default:
		err = fmt.Errorf("unsupported fault type: %s", cfg.Type)
	}

	if err != nil {
		result.Status = "failed"
		result.Error = err.Error()
		i.logger.Error("fault injection failed",
			zap.String("type", string(cfg.Type)),
			zap.Error(err))
	} else {
		result.Status = "completed"
		i.logger.Info("fault injection completed",
			zap.String("type", string(cfg.Type)),
			zap.Duration("duration", cfg.Duration))
	}

	// 定时回滚
	go func() {
		timer := time.NewTimer(cfg.Duration)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			i.Revert(context.Background(), injectionID)
		}
	}()

	return result, nil
}

// Revert 回滚故障注入
func (i *FaultInjector) Revert(ctx context.Context, injectionID string) error {
	i.mu.Lock()
	result, ok := i.activeInjections[injectionID]
	if !ok {
		i.mu.Unlock()
		return fmt.Errorf("injection not found: %s", injectionID)
	}
	delete(i.activeInjections, injectionID)
	i.mu.Unlock()

	// 执行回滚 (具体实现取决于故障类型)
	switch result.FaultType {
	case FaultCPUStress, FaultMemoryLeak:
		// 停止 stress 容器
		if i.dockerCli != nil {
			_ = i.dockerCli.ContainerStop(ctx, "chaos-"+injectionID, container.StopOptions{})
			_ = i.dockerCli.ContainerRemove(ctx, "chaos-"+injectionID, container.RemoveOptions{})
		}
	case FaultNetworkLatency, FaultNetworkLoss, FaultNetworkBandwidth:
		// 清除 tc 规则
		_ = i.execCommand(ctx, "tc", "qdisc", "del", "dev", "eth0", "root")
	case FaultDiskFill:
		// 删除填充文件
		_ = i.execCommand(ctx, "rm", "-f", "/tmp/chaos-disk-fill-"+injectionID)
	}

	now := time.Now()
	result.EndedAt = &now
	result.Status = "reverted"

	i.logger.Info("fault reverted", zap.String("injection", injectionID))
	return nil
}

// GetActiveInjections 获取当前活跃的故障注入
func (i *FaultInjector) GetActiveInjections() []*InjectionResult {
	i.mu.Lock()
	defer i.mu.Unlock()

	results := make([]*InjectionResult, 0, len(i.activeInjections))
	for _, r := range i.activeInjections {
		results = append(results, r)
	}
	return results
}

// --- Fault Implementations ---

// injectCPUStress 使用 stress-ng 注入 CPU 压力
func (i *FaultInjector) injectCPUStress(ctx context.Context, cfg FaultConfig) error {
	if cfg.CPUCores <= 0 {
		cfg.CPUCores = 1
	}
	if cfg.CPULoad <= 0 {
		cfg.CPULoad = 80
	}

	if i.dockerCli != nil {
		// 使用 Docker 运行 stress-ng 容器
		containerName := "chaos-cpu-" + fmt.Sprintf("%d", time.Now().Unix())
		cmd := []string{"stress-ng", "--cpu", strconv.Itoa(cfg.CPUCores),
			"--cpu-load", strconv.Itoa(cfg.CPULoad),
			"--timeout", strconv.Itoa(int(cfg.Duration.Seconds()))}

		_, err := i.dockerCli.ContainerCreate(ctx, &container.Config{
			Image: "alexeiled/stress-ng:latest",
			Cmd:   cmd,
		}, nil, nil, nil, containerName)
		if err != nil {
			return fmt.Errorf("create stress container: %w", err)
		}
		return i.dockerCli.ContainerStart(ctx, containerName, container.StartOptions{})
	}

	// Fallback: 直接在主机执行 (需要 stress-ng 已安装)
	_, err := i.execCommand(ctx, "stress-ng", "--cpu", strconv.Itoa(cfg.CPUCores),
		"--cpu-load", strconv.Itoa(cfg.CPULoad),
		"--timeout", strconv.Itoa(int(cfg.Duration.Seconds())))
	return err
}

// injectMemoryLeak 注入内存泄漏
func (i *FaultInjector) injectMemoryLeak(ctx context.Context, cfg FaultConfig) error {
	if cfg.MemoryMB <= 0 {
		cfg.MemoryMB = 256
	}

	if i.dockerCli != nil {
		containerName := "chaos-mem-" + fmt.Sprintf("%d", time.Now().Unix())
		cmd := []string{"stress-ng", "--vm", "1", "--vm-bytes", fmt.Sprintf("%dM", cfg.MemoryMB),
			"--timeout", strconv.Itoa(int(cfg.Duration.Seconds()))}

		_, err := i.dockerCli.ContainerCreate(ctx, &container.Config{
			Image: "alexeiled/stress-ng:latest",
			Cmd:   cmd,
		}, nil, nil, nil, containerName)
		if err != nil {
			return fmt.Errorf("create memory stress container: %w", err)
		}
		return i.dockerCli.ContainerStart(ctx, containerName, container.StartOptions{})
	}

	_, err := i.execCommand(ctx, "stress-ng", "--vm", "1",
		"--vm-bytes", fmt.Sprintf("%dM", cfg.MemoryMB),
		"--timeout", strconv.Itoa(int(cfg.Duration.Seconds())))
	return err
}

// injectNetworkLatency 注入网络延迟 (使用 tc)
func (i *FaultInjector) injectNetworkLatency(ctx context.Context, cfg FaultConfig) error {
	delayMs := int(cfg.Latency.Milliseconds())
	if delayMs <= 0 {
		delayMs = 100
	}

	// 使用 tc (traffic control) 添加网络延迟
	cmd := fmt.Sprintf("tc qdisc add dev eth0 root netem delay %dms", delayMs)
	return i.execShell(ctx, cmd)
}

// injectNetworkLoss 注入网络丢包
func (i *FaultInjector) injectNetworkLoss(ctx context.Context, cfg FaultConfig) error {
	lossPercent := int(cfg.LossRate * 100)
	if lossPercent <= 0 {
		lossPercent = 5
	}

	cmd := fmt.Sprintf("tc qdisc add dev eth0 root netem loss %d%%", lossPercent)
	return i.execShell(ctx, cmd)
}

// injectNetworkBandwidth 注入带宽限制
func (i *FaultInjector) injectNetworkBandwidth(ctx context.Context, cfg FaultConfig) error {
	if cfg.Bandwidth == "" {
		cfg.Bandwidth = "1mbit"
	}

	cmd := fmt.Sprintf("tc qdisc add dev eth0 root tbf rate %s latency 50ms burst 1540", cfg.Bandwidth)
	return i.execShell(ctx, cmd)
}

// injectDiskFill 注入磁盘填充
func (i *FaultInjector) injectDiskFill(ctx context.Context, cfg FaultConfig) error {
	if cfg.DiskPath == "" {
		cfg.DiskPath = "/tmp"
	}
	if cfg.DiskFillMB <= 0 {
		cfg.DiskFillMB = 100
	}

	filePath := fmt.Sprintf("%s/chaos-disk-fill-%d", cfg.DiskPath, time.Now().Unix())
	// 使用 fallocate 快速创建大文件
	_, err := i.execCommand(ctx, "fallocate", "-l", fmt.Sprintf("%dM", cfg.DiskFillMB), filePath)
	return err
}

// injectProcessKill 杀死进程
func (i *FaultInjector) injectProcessKill(ctx context.Context, cfg FaultConfig) error {
	if cfg.ProcessName == "" {
		return fmt.Errorf("processName is required")
	}
	if cfg.Signal == "" {
		cfg.Signal = "SIGTERM"
	}

	_, err := i.execCommand(ctx, "killall", "-s", cfg.Signal, cfg.ProcessName)
	return err
}

// injectServiceDown 停止服务
func (i *FaultInjector) injectServiceDown(ctx context.Context, cfg FaultConfig) error {
	if cfg.Target.Type == "docker" && i.dockerCli != nil {
		return i.dockerCli.ContainerStop(ctx, cfg.Target.Container, container.StopOptions{})
	}

	// Host: 停止 systemd 服务
	if cfg.Target.Type == "host" && cfg.Target.Host != "" {
		_, err := i.execCommand(ctx, "systemctl", "stop", cfg.Target.Host)
		return err
	}

	return fmt.Errorf("unsupported target type for service down: %s", cfg.Target.Type)
}

// --- Helpers ---

func (i *FaultInjector) execCommand(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%s: %w (stderr: %s)", name, err, stderr.String())
	}
	return stdout.String(), nil
}

func (i *FaultInjector) execShell(ctx context.Context, command string) error {
	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("shell: %w (stderr: %s)", err, stderr.String())
	}
	return nil
}

// --- Health Check ---

// Health 检查故障注入器健康状态
func (i *FaultInjector) Health() map[string]any {
	i.mu.Lock()
	defer i.mu.Unlock()

	health := map[string]any{
		"active_injections": len(i.activeInjections),
		"docker_available":   i.dockerCli != nil,
	}

	// 检查 Docker 连接
	if i.dockerCli != nil {
		_, err := i.dockerCli.Ping(context.Background())
		health["docker_connected"] = err == nil
	}

	return health
}

// --- Cleanup ---

// CleanupAll 回滚所有活跃的故障注入
func (i *FaultInjector) CleanupAll(ctx context.Context) error {
	i.mu.Lock()
	ids := make([]string, 0, len(i.activeInjections))
	for id := range i.activeInjections {
		ids = append(ids, id)
	}
	i.mu.Unlock()

	var errs []string
	for _, id := range ids {
		if err := i.Revert(ctx, id); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", id, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %s", strings.Join(errs, "; "))
	}
	return nil
}
