package injector

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"orion/platform-svc-go/internal/otel"

	"go.uber.org/zap"
)

// FaultType defines supported chaos injection types.
type FaultType string

const (
	FaultCpuSpike       FaultType = "cpu-spike"
	FaultMemoryLeak     FaultType = "memory-leak"
	FaultNetworkLatency FaultType = "network-latency"
	FaultServiceDown    FaultType = "service-down"
	FaultPodKill        FaultType = "pod-kill"
	FaultPodOOM         FaultType = "pod-oom"
)

const stressImage = "polinux/stress:latest"

type Config struct {
	Kubeconfig       string
	RestConfig       *rest.Config
	Clientset        kubernetes.Interface
	DefaultTimeout   time.Duration
	DefaultNamespace string
	Logger           *zap.Logger
}

func defaultConfig(cfg Config) Config {
	if cfg.DefaultTimeout == 0 {
		cfg.DefaultTimeout = 5 * time.Minute
	}
	if cfg.DefaultNamespace == "" {
		cfg.DefaultNamespace = "default"
	}
	if cfg.Logger == nil {
		cfg.Logger, _ = zap.NewProduction()
	}
	return cfg
}

type Injector struct {
	client kubernetes.Interface
	cfg    Config
}

func NewInjector(cfg Config) (*Injector, error) {
	cfg = defaultConfig(cfg)
	var client kubernetes.Interface

	if cfg.Clientset != nil {
		client = cfg.Clientset
	} else if cfg.RestConfig != nil {
		c, err := kubernetes.NewForConfig(cfg.RestConfig)
		if err != nil {
			return nil, fmt.Errorf("create clientset from rest config: %w", err)
		}
		client = c
	} else {
		var config *rest.Config
		var err error
		config, err = rest.InClusterConfig()
		if err != nil && cfg.Kubeconfig != "" {
			config, err = clientcmd.BuildConfigFromFlags("", cfg.Kubeconfig)
		}
		if err != nil {
			return nil, fmt.Errorf("load kubeconfig: %w", err)
		}
		c, err := kubernetes.NewForConfig(config)
		if err != nil {
			return nil, fmt.Errorf("create clientset: %w", err)
		}
		client = c
	}

	return &Injector{client: client, cfg: cfg}, nil
}

type InjectConfig struct {
	Duration     string  `json:"duration"`
	Intensity    float64 `json:"intensity"`
	Percentage   float64 `json:"percentage"`
	Ports        []int   `json:"ports"`
	NodeLabels   string  `json:"node_labels"`
	Namespace    string  `json:"namespace"`
	Selector     string  `json:"selector"`
	Target       string  `json:"target"`
	ContainerIdx *int    `json:"container_idx"`
}

type InjectResult struct {
	InjectionID string
	FaultType   string
	Target      string
	Namespace   string
	Success     bool
	Message     string
	Duration    time.Duration
	RollbackID  string
}

type RecoverResult struct {
	InjectionID string
	Success     bool
	Message     string
	Duration    time.Duration
}

func (i *Injector) Inject(ctx context.Context, faultType FaultType, target string, configJSON string) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.Inject",
		otel.AttrString("fault.type", string(faultType)),
		otel.AttrString("target", target),
	)
	defer span.End()

	start := time.Now()
	var cfg InjectConfig
	if configJSON != "" {
		if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
			otel.SetSpanError(span, err)
			return &InjectResult{FaultType: string(faultType), Target: target, Success: false, Message: err.Error()}, err
		}
	}

	namespace, resource, err := parseTarget(target, i.cfg.DefaultNamespace)
	if err != nil {
		otel.SetSpanError(span, err)
		return &InjectResult{FaultType: string(faultType), Target: target, Success: false, Message: err.Error()}, err
	}

	var result *InjectResult
	switch faultType {
	case FaultCpuSpike:
		result, err = i.injectCpuSpike(ctx, namespace, resource, &cfg)
	case FaultMemoryLeak:
		result, err = i.injectMemoryLeak(ctx, namespace, resource, &cfg)
	case FaultNetworkLatency:
		result, err = i.injectNetworkLatency(ctx, namespace, resource, &cfg)
	case FaultServiceDown:
		result, err = i.injectServiceDown(ctx, namespace, resource, &cfg)
	case FaultPodKill:
		result, err = i.injectPodKill(ctx, namespace, resource, &cfg)
	case FaultPodOOM:
		result, err = i.injectPodOOM(ctx, namespace, resource, &cfg)
	default:
		err = fmt.Errorf("unsupported fault type: %s", faultType)
	}

	if err != nil {
		otel.SetSpanError(span, err)
		result = &InjectResult{
			FaultType: string(faultType), Target: target,
			Namespace: namespace, Success: false,
			Message: err.Error(), Duration: time.Since(start),
		}
		return result, err
	}

	result.Duration = time.Since(start)
	result.Success = true
	otel.SetSpanAttr(span, otel.AttrBool("result.success", true))
	i.cfg.Logger.Info("chaos fault injected",
		zap.String("fault", string(faultType)),
		zap.String("namespace", namespace),
		zap.String("target", resource),
		zap.Duration("duration", result.Duration),
		zap.String("rollback_id", result.RollbackID),
	)

	return result, nil
}

func (i *Injector) Recover(ctx context.Context, faultType FaultType, injectionID string, configJSON string) (*RecoverResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.Recover",
		otel.AttrString("fault.type", string(faultType)),
		otel.AttrString("injection_id", injectionID),
	)
	defer span.End()

	start := time.Now()
	var cfg InjectConfig
	if configJSON != "" {
		if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
			otel.SetSpanError(span, err)
			return &RecoverResult{InjectionID: injectionID, Success: false, Message: err.Error()}, err
		}
	}

	namespace := cfg.Namespace
	if namespace == "" {
		namespace = i.cfg.DefaultNamespace
	}

	var result *RecoverResult
	var err error

	switch faultType {
	case FaultCpuSpike, FaultMemoryLeak, FaultNetworkLatency, FaultPodOOM:
		result, err = i.cleanupStressPod(ctx, namespace, injectionID)
	case FaultServiceDown:
		result, err = i.restoreDeployment(ctx, namespace, injectionID, &cfg)
	case FaultPodKill:
		result = &RecoverResult{InjectionID: injectionID, Success: true, Message: "pods managed by controllers, no recovery needed"}
	default:
		err = fmt.Errorf("unsupported fault type for recovery: %s", faultType)
	}

	if err != nil {
		otel.SetSpanError(span, err)
		result = &RecoverResult{InjectionID: injectionID, Success: false, Message: err.Error(), Duration: time.Since(start)}
		return result, err
	}

	result.Duration = time.Since(start)
	return result, nil
}

// injectCpuSpike creates a stress pod that consumes CPU cores.
func (i *Injector) injectCpuSpike(ctx context.Context, namespace, target string, cfg *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectCpuSpike",
		otel.AttrString("namespace", namespace),
	)
	defer span.End()

	cores := cfg.Intensity
	if cores <= 0 {
		cores = 1.0
	}
	duration := cfg.Duration
	if duration == "" {
		duration = "300s"
	}

	podName := fmt.Sprintf("chaos-cpu-%s-%d", target, time.Now().UnixNano())
	cmd := fmt.Sprintf("stress-ng --cpu %d --timeout %s", int(cores), duration)
	pod := newChaosPod(namespace, podName, target, "stress", cmd)

	_, err := i.client.CoreV1().Pods(namespace).Create(ctx, pod, metav1.CreateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("create cpu stress pod: %w", err)
	}

	return &InjectResult{
		FaultType: "cpu-spike", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("CPU stress pod %s created (%.1f cores, %s)", podName, cores, duration),
		RollbackID: podName,
	}, nil
}

// injectMemoryLeak creates a stress pod that allocates memory.
func (i *Injector) injectMemoryLeak(ctx context.Context, namespace, target string, cfg *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectMemoryLeak",
		otel.AttrString("namespace", namespace),
	)
	defer span.End()

	memoryMB := int64(cfg.Intensity)
	if memoryMB <= 0 {
		memoryMB = 512
	}
	duration := cfg.Duration
	if duration == "" {
		duration = "300s"
	}

	podName := fmt.Sprintf("chaos-mem-%s-%d", target, time.Now().UnixNano())
	cmd := fmt.Sprintf("stress-ng --vm 2 --vm-bytes %dM --timeout %s", memoryMB, duration)
	pod := newChaosPod(namespace, podName, target, "stress", cmd)

	_, err := i.client.CoreV1().Pods(namespace).Create(ctx, pod, metav1.CreateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("create memory stress pod: %w", err)
	}

	return &InjectResult{
		FaultType: "memory-leak", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("Memory stress pod %s created (%d MB, %s)", podName, memoryMB, duration),
		RollbackID: podName,
	}, nil
}

// injectNetworkLatency creates a pod that injects network delay using tc.
func (i *Injector) injectNetworkLatency(ctx context.Context, namespace, target string, cfg *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectNetworkLatency",
		otel.AttrString("namespace", namespace),
	)
	defer span.End()

	latencyMs := int64(cfg.Intensity)
	if latencyMs <= 0 {
		latencyMs = 500
	}
	duration := cfg.Duration
	if duration == "" {
		duration = "300s"
	}
	durationSec := parseDurationSeconds(duration)

	podName := fmt.Sprintf("chaos-net-%s-%d", target, time.Now().UnixNano())
	netCmd := fmt.Sprintf(
		"tc qdisc add dev eth0 root netem delay %dms && sleep %d && tc qdisc del dev eth0 root",
		latencyMs, durationSec,
	)

	pod := newChaosPod(namespace, podName, target, "netem", netCmd)
	pod.Spec.HostNetwork = true
	pod.Spec.SecurityContext = &corev1.PodSecurityContext{
		RunAsUser: int64Ptr(0),
	}
	pod.Spec.Containers[0].SecurityContext = &corev1.SecurityContext{
		Privileged: boolPtr(true),
		Capabilities: &corev1.Capabilities{
			Add: []corev1.Capability{"NET_ADMIN"},
		},
	}

	_, err := i.client.CoreV1().Pods(namespace).Create(ctx, pod, metav1.CreateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("create network latency pod: %w", err)
	}

	return &InjectResult{
		FaultType: "network-latency", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("Network latency pod %s created (%d ms, %s)", podName, latencyMs, duration),
		RollbackID: podName,
	}, nil
}

// injectServiceDown scales the target deployment to 0 replicas.
func (i *Injector) injectServiceDown(ctx context.Context, namespace, target string, _ *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectServiceDown",
		otel.AttrString("namespace", namespace),
		otel.AttrString("deployment", target),
	)
	defer span.End()

	deployClient := i.client.AppsV1().Deployments(namespace)
	deploy, err := deployClient.Get(ctx, target, metav1.GetOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get deployment %s/%s: %w", namespace, target, err)
	}

	originalReplicas := int32(0)
	if deploy.Spec.Replicas != nil {
		originalReplicas = *deploy.Spec.Replicas
	}

	zero := int32(0)
	deploy.Spec.Replicas = &zero
	_, err = deployClient.Update(ctx, deploy, metav1.UpdateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("scale deployment %s/%s to 0: %w", namespace, target, err)
	}

	rollbackID := fmt.Sprintf("scale:%s/%s:%d", namespace, target, originalReplicas)
	return &InjectResult{
		FaultType: "service-down", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("deployment %s/%s scaled to 0 (was %d)", namespace, target, originalReplicas),
		RollbackID: rollbackID,
	}, nil
}

// injectPodKill deletes pods matching the target selector.
func (i *Injector) injectPodKill(ctx context.Context, namespace, target string, cfg *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectPodKill",
		otel.AttrString("namespace", namespace),
		otel.AttrString("selector", target),
	)
	defer span.End()

	podClient := i.client.CoreV1().Pods(namespace)
	selector := cfg.Selector
	if selector == "" {
		selector = "app=" + target
	}

	pods, err := podClient.List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("list pods with selector %s: %w", selector, err)
	}

	if len(pods.Items) == 0 {
		return nil, fmt.Errorf("no pods found with selector %s in namespace %s", selector, namespace)
	}

	percentage := cfg.Percentage
	if percentage <= 0 || percentage > 100 {
		percentage = 100
	}
	count := int(float64(len(pods.Items)) * percentage / 100.0)
	if count <= 0 {
		count = 1
	}
	if count > len(pods.Items) {
		count = len(pods.Items)
	}

	var killed []string
	zero := int64(0)
	for idx := 0; idx < count; idx++ {
		pod := pods.Items[idx]
		err = podClient.Delete(ctx, pod.Name, metav1.DeleteOptions{GracePeriodSeconds: &zero})
		if err != nil {
			i.cfg.Logger.Warn("failed to delete pod", zap.String("pod", pod.Name), zap.Error(err))
			continue
		}
		killed = append(killed, pod.Name)
	}

	return &InjectResult{
		FaultType: "pod-kill", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("killed %d pod(s): %v", len(killed), killed),
		RollbackID: fmt.Sprintf("kill:%s:%s", namespace, selector),
	}, nil
}

// injectPodOOM creates a pod with tight memory limits that triggers OOMKill.
func (i *Injector) injectPodOOM(ctx context.Context, namespace, target string, cfg *InjectConfig) (*InjectResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.injectPodOOM",
		otel.AttrString("namespace", namespace),
	)
	defer span.End()

	memoryMB := int64(cfg.Intensity)
	if memoryMB <= 0 {
		memoryMB = 2048
	}
	duration := cfg.Duration
	if duration == "" {
		duration = "60s"
	}

	podName := fmt.Sprintf("chaos-oom-%s-%d", target, time.Now().UnixNano())
	cmd := fmt.Sprintf("fallocate -l %dM /tmp/oom.dat && sleep %s", memoryMB, duration)
	pod := newChaosPod(namespace, podName, target, "oom", cmd)

	memQty := resource.MustParse(fmt.Sprintf("%dMi", memoryMB))
	pod.Spec.Containers[0].Resources = corev1.ResourceRequirements{
		Limits: corev1.ResourceList{corev1.ResourceMemory: memQty},
	}

	_, err := i.client.CoreV1().Pods(namespace).Create(ctx, pod, metav1.CreateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("create OOM stress pod: %w", err)
	}

	return &InjectResult{
		FaultType: "pod-oom", Target: target, Namespace: namespace,
		Message:    fmt.Sprintf("OOM stress pod %s created (%d MB)", podName, memoryMB),
		RollbackID: podName,
	}, nil
}

// cleanupStressPod deletes a chaos stress pod by its name.
func (i *Injector) cleanupStressPod(ctx context.Context, namespace, injectionID string) (*RecoverResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.cleanupStressPod",
		otel.AttrString("namespace", namespace),
		otel.AttrString("pod", injectionID),
	)
	defer span.End()

	start := time.Now()
	podClient := i.client.CoreV1().Pods(namespace)
	zero := int64(0)
	err := podClient.Delete(ctx, injectionID, metav1.DeleteOptions{GracePeriodSeconds: &zero})
	if err != nil {
		otel.SetSpanError(span, err)
		if strings.Contains(err.Error(), "not found") {
			return &RecoverResult{InjectionID: injectionID, Success: true, Message: "stress pod already cleaned up", Duration: time.Since(start)}, nil
		}
		return nil, fmt.Errorf("delete stress pod %s/%s: %w", namespace, injectionID, err)
	}

	return &RecoverResult{
		InjectionID: injectionID,
		Message:     fmt.Sprintf("stress pod %s/%s deleted", namespace, injectionID),
		Duration:    time.Since(start),
	}, nil
}

// restoreDeployment restores a deployment to its original replica count.
func (i *Injector) restoreDeployment(ctx context.Context, namespace, rollbackID string, _ *InjectConfig) (*RecoverResult, error) {
	ctx, span := otel.StartSpan(ctx, "chaos.restoreDeployment",
		otel.AttrString("namespace", namespace),
		otel.AttrString("rollback_id", rollbackID),
	)
	defer span.End()

	start := time.Now()
	parts := strings.Split(rollbackID, ":")
	if len(parts) != 3 || parts[0] != "scale" {
		return nil, fmt.Errorf("invalid rollback ID format: %s", rollbackID)
	}

	target := parts[1]
	replicas, err := strconv.ParseInt(parts[2], 10, 32)
	if err != nil {
		return nil, fmt.Errorf("parse replicas from rollback ID: %w", err)
	}

	targetParts := strings.Split(target, "/")
	if len(targetParts) != 2 {
		return nil, fmt.Errorf("invalid target in rollback ID: %s", target)
	}
	ns := targetParts[0]
	deployName := targetParts[1]

	replicaInt32 := int32(replicas)
	scaleClient := i.client.AppsV1().Deployments(ns)
	scale, err := scaleClient.GetScale(ctx, deployName, metav1.GetOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get scale for %s/%s: %w", ns, deployName, err)
	}

	scale.Spec.Replicas = replicaInt32
	_, err = scaleClient.UpdateScale(ctx, deployName, scale, metav1.UpdateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("restore scale for %s/%s: %w", ns, deployName, err)
	}

	return &RecoverResult{
		InjectionID: rollbackID,
		Success:     true,
		Message:     fmt.Sprintf("deployment %s/%s restored to %d replicas", ns, deployName, replicaInt32),
		Duration:    time.Since(start),
	}, nil
}

// HealthCheck verifies the injector can reach the K8s API.
func (i *Injector) HealthCheck(ctx context.Context) error {
	_, err := i.client.Discovery().ServerVersion()
	if err != nil {
		return fmt.Errorf("k8s api unreachable: %w", err)
	}
	return nil
}

func parseTarget(target, defaultNamespace string) (namespace, resource string, err error) {
	parts := strings.Split(strings.TrimSpace(target), "/")
	switch len(parts) {
	case 1:
		return defaultNamespace, parts[0], nil
	case 2:
		return parts[0], parts[1], nil
	case 3:
		return parts[0], parts[2], nil
	default:
		return "", "", fmt.Errorf("invalid target %q: expected 'namespace/resource'", target)
	}
}

func newChaosPod(namespace, name, target, containerName, cmd string) *corev1.Pod {
	podName := name
	if len(podName) > 63 {
		podName = podName[:63]
	}

	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":          "orion-chaos",
				"chaos-target": truncateLabel(target),
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    containerName,
					Image:   stressImage,
					Command: []string{"sh", "-c"},
					Args:    []string{cmd},
				},
			},
			Tolerations: []corev1.Toleration{
				{Operator: corev1.TolerationOpExists, Effect: corev1.TaintEffectNoSchedule},
				{Operator: corev1.TolerationOpExists, Effect: corev1.TaintEffectNoExecute},
			},
		},
	}
}

func truncateLabel(s string) string {
	if len(s) <= 63 {
		return s
	}
	return s[:63]
}

func parseDurationSeconds(d string) int {
	if d == "" {
		return 300
	}
	t, err := time.ParseDuration(d)
	if err != nil {
		return 300
	}
	return int(t.Seconds())
}

func boolPtr(b bool) *bool    { return &b }
func int64Ptr(v int64) *int64 { return &v }
