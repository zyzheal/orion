package executor

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"orion/platform-svc-go/internal/otel"

	"go.uber.org/zap"
)

// TargetParseError indicates the target string could not be parsed.
type TargetParseError struct {
	Target string
	Reason string
}

func (e *TargetParseError) Error() string {
	return fmt.Sprintf("invalid target %q: %s", e.Target, e.Reason)
}

// Result holds the outcome of a single K8s action execution.
type Result struct {
	ActionType string
	Target     string
	Namespace  string
	Resource   string
	Success    bool
	Message    string
	Duration   time.Duration
}

// Config holds the K8s executor configuration.
type Config struct {
	// Kubeconfig path (empty = in-cluster config).
	Kubeconfig string
	// REST config (when provided, Kubeconfig is ignored).
	RestConfig *rest.Config
	// Clientset (when provided, both configs are ignored).
	Clientset kubernetes.Interface
	// Timeout for individual K8s API calls.
	APITimeout time.Duration
	// Poll interval for rollout status checks.
	PollInterval time.Duration
	// Max wait for rollout to complete.
	RolloutTimeout time.Duration
	// Logger for operations.
	Logger *zap.Logger
}

func defaultConfig(cfg Config) Config {
	if cfg.APITimeout == 0 {
		cfg.APITimeout = 30 * time.Second
	}
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 2 * time.Second
	}
	if cfg.RolloutTimeout == 0 {
		cfg.RolloutTimeout = 5 * time.Minute
	}
	if cfg.Logger == nil {
		cfg.Logger, _ = zap.NewProduction()
	}
	return cfg
}

// K8sExecutor executes self-healing actions against a Kubernetes cluster.
type K8sExecutor struct {
	client kubernetes.Interface
	cfg    Config
}

// NewK8sExecutor creates a new K8s executor.
func NewK8sExecutor(cfg Config) (*K8sExecutor, error) {
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

	return &K8sExecutor{client: client, cfg: cfg}, nil
}

// Execute performs a self-healing action against the target.
// target format: "namespace/resource" e.g. "production/api-server"
func (e *K8sExecutor) Execute(ctx context.Context, actionType, target, command string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.Execute",
		otel.AttrString("action.type", actionType),
		otel.AttrString("target", target),
	)
	defer span.End()

	start := time.Now()
	namespace, resource, err := parseTarget(target)
	if err != nil {
		otel.SetSpanError(span, err)
		return &Result{ActionType: actionType, Target: target, Success: false, Message: err.Error()}, err
	}

	var result *Result
	switch strings.ToLower(actionType) {
	case "restart":
		result, err = e.restartPod(ctx, namespace, resource)
	case "deploy":
		result, err = e.deploy(ctx, namespace, resource, command)
	case "rollback":
		result, err = e.rollbackDeployment(ctx, namespace, resource)
	case "scale":
		result, err = e.scaleDeployment(ctx, namespace, resource, command)
	case "notify":
		result = &Result{
			ActionType: actionType, Target: target,
			Namespace: namespace, Resource: resource,
			Success: true, Message: "notify action delegated to notification service",
		}
	case "run_script":
		result, err = e.runScript(ctx, namespace, resource, command)
	default:
		err = fmt.Errorf("unknown action type: %s", actionType)
	}

	if err != nil {
		otel.SetSpanError(span, err)
		result = &Result{
			ActionType: actionType, Target: target,
			Namespace: namespace, Resource: resource,
			Success: false, Message: err.Error(), Duration: time.Since(start),
		}
		return result, err
	}

	result.Duration = time.Since(start)
	result.Success = true
	otel.SetSpanAttr(span, otel.AttrBool("result.success", true))
	e.cfg.Logger.Info("K8s healing action completed",
		zap.String("action", actionType),
		zap.String("namespace", namespace),
		zap.String("resource", resource),
		zap.Duration("duration", result.Duration),
	)

	return result, nil
}

// parseTarget splits "namespace/resource" into its components.
// Supports formats:
//   - "ns/deploy" -> ("ns", "deploy")
//   - "ns/deployment/deploy" -> ("ns", "deploy")  (with kind prefix)
//   - "ns/deployments/deploy" -> ("ns", "deploy")
func parseTarget(target string) (namespace, resource string, err error) {
	parts := strings.Split(strings.TrimSpace(target), "/")
	switch len(parts) {
	case 2:
		return parts[0], parts[1], nil
	case 3:
		return parts[0], parts[2], nil
	default:
		return "", "", &TargetParseError{
			Target: target,
			Reason: fmt.Sprintf("expected 'namespace/resource' or 'namespace/kind/resource', got %d segments", len(parts)),
		}
	}
}

// restartPod deletes the pod(s) matching the name in the namespace so K8s recreates them.
func (e *K8sExecutor) restartPod(ctx context.Context, namespace, name string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.restartPod",
		otel.AttrString("namespace", namespace),
		otel.AttrString("pod", name),
	)
	defer span.End()

	// Try as a Deployment first (rollout restart)
	deployClient := e.client.AppsV1().Deployments(namespace)
	_, err := deployClient.Get(ctx, name, metav1.GetOptions{})
	if err == nil {
		timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
		patch := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"restart-at":"%s"}}}}}`, timestamp)
		_, err = deployClient.Patch(ctx, name, "application/strategic-merge-patch+json", []byte(patch), metav1.PatchOptions{})
		if err != nil {
			otel.SetSpanError(span, err)
			return nil, fmt.Errorf("restart deployment %s/%s: %w", namespace, name, err)
		}
		return &Result{
			ActionType: "restart", Target: fmt.Sprintf("%s/%s", namespace, name),
			Namespace: namespace, Resource: name,
			Success: true, Message: fmt.Sprintf("deployment %s/%s restarted via annotation bump", namespace, name),
		}, nil
	}

	// Fall back to direct pod deletion
	podClient := e.client.CoreV1().Pods(namespace)
	pods, err := podClient.List(ctx, metav1.ListOptions{LabelSelector: "app=" + name})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("list pods %s/%s: %w", namespace, name, err)
	}

	if len(pods.Items) == 0 {
		// Try exact name match
		_, err = podClient.Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			otel.SetSpanError(span, err)
			return nil, fmt.Errorf("pod not found: %s/%s", namespace, name)
		}
		zero := int64(0)
		err = podClient.Delete(ctx, name, metav1.DeleteOptions{GracePeriodSeconds: &zero})
		if err != nil {
			otel.SetSpanError(span, err)
			return nil, fmt.Errorf("delete pod %s/%s: %w", namespace, name, err)
		}
		return &Result{
			ActionType: "restart", Target: fmt.Sprintf("%s/%s", namespace, name),
			Namespace: namespace, Resource: name,
			Success: true, Message: fmt.Sprintf("pod %s/%s deleted for restart", namespace, name),
		}, nil
	}

	// Delete all matching pods
	zero := int64(0)
	var restarted []string
	for _, pod := range pods.Items {
		err = podClient.Delete(ctx, pod.Name, metav1.DeleteOptions{GracePeriodSeconds: &zero})
		if err != nil {
			e.cfg.Logger.Warn("failed to delete pod", zap.String("pod", pod.Name), zap.Error(err))
			continue
		}
		restarted = append(restarted, pod.Name)
	}

	if len(restarted) == 0 {
		return nil, fmt.Errorf("no pods restarted in %s for selector app=%s", namespace, name)
	}

	return &Result{
		ActionType: "restart", Target: fmt.Sprintf("%s/%s", namespace, name),
		Namespace: namespace, Resource: name,
		Success: true, Message: fmt.Sprintf("deleted %d pod(s) for restart: %v", len(restarted), restarted),
	}, nil
}

// deploy creates or updates a deployment to the specified image/tag.
// command format: "image:tag" or "image@digest"
func (e *K8sExecutor) deploy(ctx context.Context, namespace, name, command string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.deploy",
		otel.AttrString("namespace", namespace),
		otel.AttrString("deployment", name),
		otel.AttrString("image", command),
	)
	defer span.End()

	if command == "" {
		return nil, fmt.Errorf("image reference required for deploy action")
	}

	deployClient := e.client.AppsV1().Deployments(namespace)
	deploy, err := deployClient.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
	}

	// Update first container image
	if len(deploy.Spec.Template.Spec.Containers) == 0 {
		return nil, fmt.Errorf("deployment %s/%s has no containers", namespace, name)
	}

	container := &deploy.Spec.Template.Spec.Containers[0]
	container.Image = command

	updated, err := deployClient.Update(ctx, deploy, metav1.UpdateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("update deployment %s/%s: %w", namespace, name, err)
	}

	e.cfg.Logger.Info("deployment image updated",
		zap.String("namespace", namespace),
		zap.String("deployment", name),
		zap.String("image", command),
		zap.Int32("replicas", *updated.Spec.Replicas),
	)

	return &Result{
		ActionType: "deploy", Target: fmt.Sprintf("%s/%s", namespace, name),
		Namespace: namespace, Resource: name,
		Success: true, Message: fmt.Sprintf("deployment %s/%s updated to %s", namespace, name, command),
	}, nil
}

// rollbackDeployment rolls back a deployment to its previous ReplicaSet revision.
// It finds the most recent non-current ReplicaSet and patches the deployment spec to match it.
func (e *K8sExecutor) rollbackDeployment(ctx context.Context, namespace, name string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.rollbackDeployment",
		otel.AttrString("namespace", namespace),
		otel.AttrString("deployment", name),
	)
	defer span.End()

	deployClient := e.client.AppsV1().Deployments(namespace)
	rsClient := e.client.AppsV1().ReplicaSets(namespace)

	// List ReplicaSets owned by this deployment
	rsList, err := rsClient.List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app=%s", name),
	})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("list replicasets for deployment %s/%s: %w", namespace, name, err)
	}

	if len(rsList.Items) < 2 {
		return nil, fmt.Errorf("not enough replica set revisions for rollback (need at least 2, have %d)", len(rsList.Items))
	}

	// Sort by creation timestamp descending (newest first)
	sortRSByCreation(rsList.Items)

	// The newest RS is the current one; the second newest is the previous revision
	currentRS := &rsList.Items[0]
	previousRS := &rsList.Items[1]

	// Patch the deployment template spec to match the previous RS
	deploy, err := deployClient.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get deployment %s/%s: %w", namespace, name, err)
	}

	// Copy the previous RS template
	deploy.Spec.Template = previousRS.Spec.Template
	// Restore the previous replica count
	if previousRS.Spec.Replicas != nil {
		deploy.Spec.Replicas = previousRS.Spec.Replicas
	}

	_, err = deployClient.Update(ctx, deploy, metav1.UpdateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("update deployment %s/%s for rollback: %w", namespace, name, err)
	}

	prevRev := previousRS.Annotations["deployment.kubernetes.io/revision"]
	currRev := currentRS.Annotations["deployment.kubernetes.io/revision"]
	e.cfg.Logger.Info("deployment rolled back",
		zap.String("namespace", namespace),
		zap.String("deployment", name),
		zap.String("from_revision", currRev),
		zap.String("to_revision", prevRev),
	)

	return &Result{
		ActionType: "rollback", Target: fmt.Sprintf("%s/%s", namespace, name),
		Namespace: namespace, Resource: name,
		Success: true, Message: fmt.Sprintf("deployment %s/%s rolled back from rev %s to rev %s", namespace, name, currRev, prevRev),
	}, nil
}

// sortRSByCreation sorts ReplicaSets by creation timestamp descending (in place).
func sortRSByCreation(rsList []appsv1.ReplicaSet) {
	for i := 0; i < len(rsList)-1; i++ {
		for j := i + 1; j < len(rsList); j++ {
			if rsList[j].CreationTimestamp.After(rsList[i].CreationTimestamp.Time) {
				rsList[i], rsList[j] = rsList[j], rsList[i]
			}
		}
	}
}

// scaleDeployment scales a deployment to the specified replica count.
// command format: "N" (integer replica count)
func (e *K8sExecutor) scaleDeployment(ctx context.Context, namespace, name, command string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.scaleDeployment",
		otel.AttrString("namespace", namespace),
		otel.AttrString("deployment", name),
		otel.AttrString("replicas", command),
	)
	defer span.End()

	replicas, err := strconv.Atoi(strings.TrimSpace(command))
	if err != nil {
		return nil, fmt.Errorf("invalid replica count %q: %w", command, err)
	}
	if replicas < 0 {
		return nil, fmt.Errorf("replica count must be non-negative, got %d", replicas)
	}

	replicaInt32 := int32(replicas)
	scaleClient := e.client.AppsV1().Deployments(namespace)
	scale, err := scaleClient.GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get scale for deployment %s/%s: %w", namespace, name, err)
	}

	scale.Spec.Replicas = replicaInt32
	updated, err := scaleClient.UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("update scale for deployment %s/%s: %w", namespace, name, err)
	}

	e.cfg.Logger.Info("deployment scaled",
		zap.String("namespace", namespace),
		zap.String("deployment", name),
		zap.Int32("replicas", updated.Spec.Replicas),
	)

	return &Result{
		ActionType: "scale", Target: fmt.Sprintf("%s/%s", namespace, name),
		Namespace: namespace, Resource: name,
		Success: true, Message: fmt.Sprintf("deployment %s/%s scaled to %d replicas", namespace, name, replicas),
	}, nil
}

// runScript executes a command in a new ephemeral pod (debug container).
// command is the shell command to execute.
func (e *K8sExecutor) runScript(ctx context.Context, namespace, resource, command string) (*Result, error) {
	ctx, span := otel.StartSpan(ctx, "self-healing.runScript",
		otel.AttrString("namespace", namespace),
		otel.AttrString("resource", resource),
		otel.AttrString("command", command),
	)
	defer span.End()

	if command == "" {
		return nil, fmt.Errorf("command is required for run_script action")
	}

	podName := fmt.Sprintf("heal-%s-%d", resource, time.Now().UnixNano())
	image := "busybox:1.36"

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: namespace,
			Labels:    map[string]string{"app": "orion-healing", "script": resource},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "script",
					Image:   image,
					Command: []string{"sh", "-c"},
					Args:    []string{command},
				},
			},
			Tolerations: []corev1.Toleration{
				{Operator: corev1.TolerationOpExists, Effect: corev1.TaintEffectNoSchedule},
				{Operator: corev1.TolerationOpExists, Effect: corev1.TaintEffectNoExecute},
			},
		},
	}

	podClient := e.client.CoreV1().Pods(namespace)
	_, err := podClient.Create(ctx, pod, metav1.CreateOptions{})
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("create script pod %s/%s: %w", namespace, podName, err)
	}

	e.cfg.Logger.Info("healing script pod created",
		zap.String("namespace", namespace),
		zap.String("pod", podName),
		zap.String("command", command),
	)

	return &Result{
		ActionType: "run_script", Target: fmt.Sprintf("%s/%s", namespace, resource),
		Namespace: namespace, Resource: podName,
		Success: true, Message: fmt.Sprintf("script pod %s/%s created with command", namespace, podName),
	}, nil
}

// HealthCheck verifies the executor can reach the K8s API.
func (e *K8sExecutor) HealthCheck(ctx context.Context) error {
	_, err := e.client.Discovery().ServerVersion()
	if err != nil {
		return fmt.Errorf("k8s api unreachable: %w", err)
	}
	return nil
}

// ListNamespaces returns all namespaces visible to the executor.
func (e *K8sExecutor) ListNamespaces(ctx context.Context) ([]string, error) {
	nsList, err := e.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var names []string
	for _, ns := range nsList.Items {
		names = append(names, ns.Name)
	}
	return names, nil
}

