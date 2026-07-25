package k8s

import (
	"testing"
	"time"
)

// TestK8sResourceToCiType tests the mapping from K8s resource types to CI types
func TestK8sResourceToCiType(t *testing.T) {
	tests := []struct {
		kind     string
		expected string
	}{
		{"Pod", "K8S_POD"},
		{"Deployment", "K8S_DEPLOYMENT"},
		{"Service", "K8S_SERVICE"},
		{"ConfigMap", "K8S_CONFIGMAP"},
		{"Secret", "K8S_SECRET"},
		{"Ingress", "K8S_INGRESS"},
		{"Unknown", "K8S_UNKNOWN"},
	}

	for _, tt := range tests {
		t.Run(tt.kind, func(t *testing.T) {
			result := K8sResourceToCiType(tt.kind)
			if result != tt.expected {
				t.Errorf("K8sResourceToCiType(%s) = %s; want %s", tt.kind, result, tt.expected)
			}
		})
	}
}

// TestSyncStatus tests the SyncStatus struct
func TestSyncStatus(t *testing.T) {
	status := &SyncStatus{
		LastSyncTime:   time.Now().Format(time.RFC3339),
		ResourcesFound: 10,
		Added:          5,
		Updated:        3,
		Deleted:        2,
		Errors:         0,
	}

	if status.ResourcesFound != 10 {
		t.Errorf("ResourcesFound = %d; want 10", status.ResourcesFound)
	}
	if status.Added != 5 {
		t.Errorf("Added = %d; want 5", status.Added)
	}
	if status.Updated != 3 {
		t.Errorf("Updated = %d; want 3", status.Updated)
	}
	if status.Deleted != 2 {
		t.Errorf("Deleted = %d; want 2", status.Deleted)
	}
	if status.Errors != 0 {
		t.Errorf("Errors = %d; want 0", status.Errors)
	}
}

// TestSyncConfig tests the SyncConfig struct
func TestSyncConfig(t *testing.T) {
	config := &SyncConfig{
		KubeConfigPath: "/path/to/kubeconfig",
		Context:        "my-cluster",
		Namespaces:     []string{"default", "kube-system"},
		ResyncInterval: 60,
	}

	if config.KubeConfigPath != "/path/to/kubeconfig" {
		t.Errorf("KubeConfigPath = %s; want /path/to/kubeconfig", config.KubeConfigPath)
	}
	if config.Context != "my-cluster" {
		t.Errorf("Context = %s; want my-cluster", config.Context)
	}
	if len(config.Namespaces) != 2 {
		t.Errorf("Namespaces length = %d; want 2", len(config.Namespaces))
	}
	if config.ResyncInterval != 60 {
		t.Errorf("ResyncInterval = %d; want 60", config.ResyncInterval)
	}
}

// TestSupportedResourceTypes tests that all expected resource types are supported
func TestSupportedResourceTypes(t *testing.T) {
	expectedTypes := []string{
		"Pod",
		"Deployment",
		"Service",
		"ConfigMap",
		"Secret",
		"Ingress",
	}

	if len(SupportedResourceTypes) != len(expectedTypes) {
		t.Errorf("SupportedResourceTypes length = %d; want %d", len(SupportedResourceTypes), len(expectedTypes))
	}

	for i, expected := range expectedTypes {
		if SupportedResourceTypes[i] != expected {
			t.Errorf("SupportedResourceTypes[%d] = %s; want %s", i, SupportedResourceTypes[i], expected)
		}
	}
}

// TestNewWatcherNilConfig tests that NewWatcher returns error for nil config
func TestNewWatcherNilConfig(t *testing.T) {
	_, err := NewWatcher(nil)
	if err == nil {
		t.Error("NewWatcher(nil) should return error")
	}
}

// TestK8sResource tests the K8sResource struct
func TestK8sResource(t *testing.T) {
	resource := K8sResource{
		Kind:       "Pod",
		APIVersion: "v1",
		Name:       "my-pod",
		Namespace:  "default",
		UID:        "abc-123",
		Labels: map[string]string{
			"app": "myapp",
		},
		Status: "Running",
	}

	if resource.Kind != "Pod" {
		t.Errorf("Kind = %s; want Pod", resource.Kind)
	}
	if resource.Name != "my-pod" {
		t.Errorf("Name = %s; want my-pod", resource.Name)
	}
	if resource.Namespace != "default" {
		t.Errorf("Namespace = %s; want default", resource.Namespace)
	}
	if resource.Labels["app"] != "myapp" {
		t.Errorf("Labels[app] = %s; want myapp", resource.Labels["app"])
	}
}