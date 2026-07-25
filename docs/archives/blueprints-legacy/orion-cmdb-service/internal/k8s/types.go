package k8s

// K8sResource represents a Kubernetes resource
type K8sResource struct {
	Kind       string            `json:"kind"`
	APIVersion string            `json:"apiVersion"`
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	UID        string            `json:"uid"`
	Labels     map[string]string `json:"labels"`
	Status     string            `json:"status"`
}

// SyncConfig holds the configuration for K8s synchronization
type SyncConfig struct {
	KubeConfigPath string
	Context        string
	Namespaces     []string
	ResyncInterval int // 秒
}

// SyncStatus represents the status of a sync operation
type SyncStatus struct {
	LastSyncTime   string `json:"last_sync_time"`
	ResourcesFound int    `json:"resources_found"`
	Added          int    `json:"added"`
	Updated        int    `json:"updated"`
	Deleted        int    `json:"deleted"`
	Errors         int    `json:"errors"`
}

// ResourceEvent represents a K8s resource event
type ResourceEvent struct {
	Type     string
	Resource K8sResource
}

// SupportedResourceTypes defines the K8s resource types to watch
var SupportedResourceTypes = []string{
	"Pod",
	"Deployment",
	"Service",
	"ConfigMap",
	"Secret",
	"Ingress",
}

// K8sResourceToCiType maps K8s resource kinds to CMDB CI types
func K8sResourceToCiType(kind string) string {
	switch kind {
	case "Pod":
		return "K8S_POD"
	case "Deployment":
		return "K8S_DEPLOYMENT"
	case "Service":
		return "K8S_SERVICE"
	case "ConfigMap":
		return "K8S_CONFIGMAP"
	case "Secret":
		return "K8S_SECRET"
	case "Ingress":
		return "K8S_INGRESS"
	default:
		return "K8S_UNKNOWN"
	}
}