package k8s

import (
	"context"
	"fmt"
	"sync"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// Watcher watches K8s resources and triggers events
type Watcher struct {
	config         *SyncConfig
	client         *kubernetes.Clientset
	stopCh         chan struct{}
	handlers       *eventHandlers
	mu             sync.RWMutex
	namespaces     []string
	resourceTypes  []string
}

// eventHandlers holds the callback handlers for resource events
type eventHandlers struct {
	onAdd    func(resource K8sResource)
	onUpdate func(oldResource, newResource K8sResource)
	onDelete func(resource K8sResource)
}

// NewWatcher creates a new K8s watcher
func NewWatcher(config *SyncConfig) (*Watcher, error) {
	if config == nil {
		return nil, fmt.Errorf("config cannot be nil")
	}

	// Build kubeconfig using loading rules
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if config.KubeConfigPath != "" {
		loadingRules.ExplicitPath = config.KubeConfigPath
	}

	clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{
		CurrentContext: config.Context,
	})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	namespaces := config.Namespaces
	if len(namespaces) == 0 {
		namespaces = []string{metav1.NamespaceDefault}
	}

	return &Watcher{
		config:        config,
		client:        clientset,
		stopCh:        make(chan struct{}),
		handlers:      &eventHandlers{},
		namespaces:    namespaces,
		resourceTypes: SupportedResourceTypes,
	}, nil
}

// Start starts watching K8s resources
func (w *Watcher) Start(ctx context.Context) error {
	for _, namespace := range w.namespaces {
		for _, resourceType := range w.resourceTypes {
			go w.watchResource(ctx, resourceType, namespace)
		}
	}
	return nil
}

// Stop stops the watcher
func (w *Watcher) Stop() error {
	close(w.stopCh)
	return nil
}

// OnAdd sets the handler for add events
func (w *Watcher) OnAdd(handler func(resource K8sResource)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.handlers.onAdd = handler
}

// OnUpdate sets the handler for update events
func (w *Watcher) OnUpdate(handler func(oldResource, newResource K8sResource)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.handlers.onUpdate = handler
}

// OnDelete sets the handler for delete events
func (w *Watcher) OnDelete(handler func(resource K8sResource)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.handlers.onDelete = handler
}

// watchResource watches a specific resource type in a namespace
func (w *Watcher) watchResource(ctx context.Context, resourceType, namespace string) {
	var watcher watch.Interface
	var err error

	switch resourceType {
	case "Pod":
		watcher, err = w.client.CoreV1().Pods(namespace).Watch(ctx, metav1.ListOptions{})
	case "Deployment":
		watcher, err = w.client.AppsV1().Deployments(namespace).Watch(ctx, metav1.ListOptions{})
	case "Service":
		watcher, err = w.client.CoreV1().Services(namespace).Watch(ctx, metav1.ListOptions{})
	case "ConfigMap":
		watcher, err = w.client.CoreV1().ConfigMaps(namespace).Watch(ctx, metav1.ListOptions{})
	case "Secret":
		watcher, err = w.client.CoreV1().Secrets(namespace).Watch(ctx, metav1.ListOptions{})
	case "Ingress":
		watcher, err = w.client.NetworkingV1().Ingresses(namespace).Watch(ctx, metav1.ListOptions{})
	default:
		return
	}

	if err != nil {
		fmt.Printf("Failed to watch %s in namespace %s: %v\n", resourceType, namespace, err)
		return
	}

	defer watcher.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopCh:
			return
		case event := <-watcher.ResultChan():
			w.handleEvent(event, resourceType)
		}
	}
}

// handleEvent processes a watch event
func (w *Watcher) handleEvent(event watch.Event, resourceType string) {
	w.mu.RLock()
	onAdd := w.handlers.onAdd
	onUpdate := w.handlers.onUpdate
	onDelete := w.handlers.onDelete
	w.mu.RUnlock()

	obj := event.Object
	if obj == nil {
		return
	}

	k8sResource := w.convertToK8sResource(obj, resourceType)

	switch event.Type {
	case watch.Added:
		if onAdd != nil {
			onAdd(k8sResource)
		}
	case watch.Modified:
		if onUpdate != nil {
			// For update, we need both old and new
			// In this simple implementation, we pass the same resource twice
			// In production, you'd want to track the previous state
			onUpdate(k8sResource, k8sResource)
		}
	case watch.Deleted:
		if onDelete != nil {
			onDelete(k8sResource)
		}
	}
}

// convertToK8sResource converts a K8s runtime.Object to our K8sResource type
func (w *Watcher) convertToK8sResource(obj runtime.Object, resourceType string) K8sResource {
	meta := obj.(metav1.Object)
	labels := meta.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}

	status := "Unknown"
	switch obj := obj.(type) {
	case *corev1.Pod:
		status = string(obj.Status.Phase)
	case *corev1.Service:
		status = string(obj.Spec.Type)
	}

	return K8sResource{
		Kind:       resourceType,
		APIVersion: "v1",
		Name:       meta.GetName(),
		Namespace:  meta.GetNamespace(),
		UID:        string(meta.GetUID()),
		Labels:     labels,
		Status:     status,
	}
}

// ListResources lists all resources of the specified types in the configured namespaces
func (w *Watcher) ListResources(ctx context.Context) ([]K8sResource, error) {
	var allResources []K8sResource

	for _, namespace := range w.namespaces {
		for _, resourceType := range w.resourceTypes {
			resources, err := w.listResourcesByType(ctx, resourceType, namespace)
			if err != nil {
				return nil, fmt.Errorf("failed to list %s in namespace %s: %w", resourceType, namespace, err)
			}
			allResources = append(allResources, resources...)
		}
	}

	return allResources, nil
}

// listResourcesByType lists resources of a specific type in a namespace
func (w *Watcher) listResourcesByType(ctx context.Context, resourceType, namespace string) ([]K8sResource, error) {
	switch resourceType {
	case "Pod":
		return w.listPods(ctx, namespace)
	case "Deployment":
		return w.listDeployments(ctx, namespace)
	case "Service":
		return w.listServices(ctx, namespace)
	case "ConfigMap":
		return w.listConfigMaps(ctx, namespace)
	case "Secret":
		return w.listSecrets(ctx, namespace)
	case "Ingress":
		return w.listIngresses(ctx, namespace)
	default:
		return nil, nil
	}
}

func (w *Watcher) listPods(ctx context.Context, namespace string) ([]K8sResource, error) {
	pods, err := w.client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	resources := make([]K8sResource, 0, len(pods.Items))
	for _, pod := range pods.Items {
		resources = append(resources, K8sResource{
			Kind:       "Pod",
			APIVersion: "v1",
			Name:       pod.Name,
			Namespace:  pod.Namespace,
			UID:        string(pod.UID),
			Labels:     pod.Labels,
			Status:     string(pod.Status.Phase),
		})
	}
	return resources, nil
}

func (w *Watcher) listDeployments(ctx context.Context, namespace string) ([]K8sResource, error) {
	deployments, err := w.client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	resources := make([]K8sResource, 0, len(deployments.Items))
	for _, deployment := range deployments.Items {
		resources = append(resources, K8sResource{
			Kind:       "Deployment",
			APIVersion: "apps/v1",
			Name:       deployment.Name,
			Namespace:  deployment.Namespace,
			UID:        string(deployment.UID),
			Labels:     deployment.Labels,
			Status:     "Active",
		})
	}
	return resources, nil
}

func (w *Watcher) listServices(ctx context.Context, namespace string) ([]K8sResource, error) {
	services, err := w.client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	resources := make([]K8sResource, 0, len(services.Items))
	for _, svc := range services.Items {
		resources = append(resources, K8sResource{
			Kind:       "Service",
			APIVersion: "v1",
			Name:       svc.Name,
			Namespace:  svc.Namespace,
			UID:        string(svc.UID),
			Labels:     svc.Labels,
			Status:     string(svc.Spec.Type),
		})
	}
	return resources, nil
}

func (w *Watcher) listConfigMaps(ctx context.Context, namespace string) ([]K8sResource, error) {
	configMaps, err := w.client.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	resources := make([]K8sResource, 0, len(configMaps.Items))
	for _, cm := range configMaps.Items {
		resources = append(resources, K8sResource{
			Kind:       "ConfigMap",
			APIVersion: "v1",
			Name:       cm.Name,
			Namespace:  cm.Namespace,
			UID:        string(cm.UID),
			Labels:     cm.Labels,
			Status:     "Active",
		})
	}
	return resources, nil
}

func (w *Watcher) listSecrets(ctx context.Context, namespace string) ([]K8sResource, error) {
	secrets, err := w.client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	resources := make([]K8sResource, 0, len(secrets.Items))
	for _, secret := range secrets.Items {
		resources = append(resources, K8sResource{
			Kind:       "Secret",
			APIVersion: "v1",
			Name:       secret.Name,
			Namespace:  secret.Namespace,
			UID:        string(secret.UID),
			Labels:     secret.Labels,
			Status:     "Active",
		})
	}
	return resources, nil
}

func (w *Watcher) listIngresses(ctx context.Context, namespace string) ([]K8sResource, error) {
	ingresses, err := w.client.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	resources := make([]K8sResource, 0, len(ingresses.Items))
	for _, ingress := range ingresses.Items {
		resources = append(resources, K8sResource{
			Kind:       "Ingress",
			APIVersion: "networking.k8s.io/v1",
			Name:       ingress.Name,
			Namespace:  ingress.Namespace,
			UID:        string(ingress.UID),
			Labels:     ingress.Labels,
			Status:     "Active",
		})
	}
	return resources, nil
}