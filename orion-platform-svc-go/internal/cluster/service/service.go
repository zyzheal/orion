package service

import (
	"context"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/cluster/models"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Cluster) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Cluster, error)
	List(ctx context.Context, tenantID string) ([]models.Cluster, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
}

const (
	k8sCallTimeout = 30 * time.Second
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// CreateCluster creates cluster metadata.
func (s *Service) CreateCluster(ctx context.Context, tenantID string, req models.CreateClusterRequest) (*models.Cluster, error) {
	cluster := &models.Cluster{
		TenantID:    tenantID,
		Name:        req.Name,
		APIEndpoint: req.APIEndpoint,
		CaCert:      req.CaCert,
		Token:       req.Token,
	}
	if err := s.repo.Create(ctx, cluster); err != nil {
		return nil, err
	}
	return cluster, nil
}

// GetCluster retrieves a cluster by ID.
func (s *Service) GetCluster(ctx context.Context, tenantID, id string) (*models.Cluster, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListClusters returns all clusters for a tenant.
func (s *Service) ListClusters(ctx context.Context, tenantID string) ([]models.Cluster, error) {
	return s.repo.List(ctx, tenantID)
}

// DeleteCluster deletes a cluster.
func (s *Service) DeleteCluster(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// GetClusterInfo connects to the K8s cluster and returns live info.
func (s *Service) GetClusterInfo(ctx context.Context, tenantID, clusterID string) (*models.ClusterInfo, error) {
	cluster, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	clientset, err := buildClientset(cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to build k8s client: %w", err)
	}

	infoCtx, cancel := context.WithTimeout(ctx, k8sCallTimeout)
	defer cancel()

	info := &models.ClusterInfo{}

	// Server version
	serverVersion, err := clientset.Discovery().ServerVersion()
	if err == nil {
		info.ServerVersion = &serverVersion.GitVersion
	}

	// Nodes
	nodesList, err := clientset.CoreV1().Nodes().List(infoCtx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}
	info.NodeCount = len(nodesList.Items)
	info.Nodes = make([]models.NodeInfo, 0, len(nodesList.Items))
	for _, node := range nodesList.Items {
		status := string(node.Status.Phase)
		if status == "" {
			status = "Unknown"
		}
		role := getFirstLabelValue(node.Labels, "node-role.kubernetes.io/worker", "node-role.kubernetes.io/master", "node-role.kubernetes.io/control-plane")
		if role == "" {
			role = "unknown"
		}
		info.Nodes = append(info.Nodes, models.NodeInfo{
			Name:    node.Name,
			Status:  status,
			Role:    role,
			Version: node.Status.NodeInfo.KubeletVersion,
		})
	}

	// Namespaces + Pod count per namespace
	namespacesList, err := clientset.CoreV1().Namespaces().List(infoCtx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}
	info.NamespaceCount = len(namespacesList.Items)
	info.Namespaces = make([]models.NamespaceInfo, 0, len(namespacesList.Items))
	info.PodCount = 0

	for _, ns := range namespacesList.Items {
		pods, err := clientset.CoreV1().Pods(ns.Name).List(infoCtx, metav1.ListOptions{})
		if err != nil {
			// Log the error but continue; mark pod count as 0 for this namespace
			info.Namespaces = append(info.Namespaces, models.NamespaceInfo{
				Name:   ns.Name,
				Status: string(ns.Status.Phase),
			})
			continue
		}
		count := len(pods.Items)
		info.PodCount += count
		info.Namespaces = append(info.Namespaces, models.NamespaceInfo{
			Name:     ns.Name,
			Status:   string(ns.Status.Phase),
			PodCount: count,
		})
	}

	return info, nil
}

// CreateNamespace creates a namespace via the K8s API.
func (s *Service) CreateNamespace(ctx context.Context, tenantID, clusterID, name string) (*models.Namespace, error) {
	cluster, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	clientset, err := buildClientset(cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to build k8s client: %w", err)
	}

	k8sCtx, cancel := context.WithTimeout(ctx, k8sCallTimeout)
	defer cancel()

	nsObj := &v1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
	}
	created, err := clientset.CoreV1().Namespaces().Create(k8sCtx, nsObj, metav1.CreateOptions{})
	if err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, fmt.Errorf("namespace already exists: %w", sentinel.Conflict)
		}
		return nil, fmt.Errorf("failed to create namespace: %w", err)
	}

	ns := &models.Namespace{
		ID:        string(created.UID),
		ClusterID: clusterID,
		Name:      created.Name,
		Status:    string(created.Status.Phase),
		CreatedAt: time.Now().UTC(),
	}
	return ns, nil
}

// DeleteNamespace deletes a namespace via the K8s API.
func (s *Service) DeleteNamespace(ctx context.Context, tenantID, clusterID, name string) error {
	cluster, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}
	clientset, err := buildClientset(cluster)
	if err != nil {
		return fmt.Errorf("failed to build k8s client: %w", err)
	}

	k8sCtx, cancel := context.WithTimeout(ctx, k8sCallTimeout)
	defer cancel()

	if err := clientset.CoreV1().Namespaces().Delete(k8sCtx, name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete namespace: %w", err)
	}
	return nil
}

// buildClientset creates a kubernetes.Clientset from cluster credentials.
func buildClientset(cluster *models.Cluster) (*kubernetes.Clientset, error) {
	cfg := &rest.Config{
		Host: cluster.APIEndpoint,
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: false,
			CAData:   []byte(cluster.CaCert),
		},
		BearerToken: cluster.Token,
	}
	return kubernetes.NewForConfig(cfg)
}

// getFirstLabelValue returns the value of the first matching label key.
func getFirstLabelValue(labels map[string]string, keys ...string) string {
	for _, k := range keys {
		if v, ok := labels[k]; ok {
			return v
		}
	}
	return ""
}

