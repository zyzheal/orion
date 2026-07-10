package service

import (
	"encoding/json"
	"orion/incident-svc-go/internal/diagnostic/models"
	"regexp"
	"strings"
)

// TreeResult is the result of a decision-tree evaluation.
type TreeResult struct {
	Path              []string
	Node              *models.DecisionTreeNode
	RootCause         *models.RootCause
	RecommendedChecks []string
	MatchedBranches   []models.DecisionBranch
}

// DecisionTree evaluates symptoms against a structured decision tree.
type DecisionTree struct {
	root  *models.DecisionTreeNode
	nodes map[string]*models.DecisionTreeNode
}

// CreateDefaultDecisionTree builds the built-in diagnostic decision tree.
func CreateDefaultDecisionTree() *DecisionTree {
	tree := &DecisionTree{
		root: &models.DecisionTreeNode{
			ID:          "root",
			Name:        "Diagnosis Root",
			Description: "Start of diagnostic procedure",
			IsLeaf:      false,
		},
		nodes: make(map[string]*models.DecisionTreeNode),
	}
	tree.nodes["root"] = tree.root

	// Leaf node builder
	leaf := func(id, name, desc string, rc *models.RootCause) *models.DecisionTreeNode {
		n := &models.DecisionTreeNode{
			ID:          id,
			Name:        name,
			Description: desc,
			IsLeaf:      true,
			RootCause:   rc,
		}
		tree.nodes[id] = n
		return n
	}
	internal := func(id, name, desc string) *models.DecisionTreeNode {
		n := &models.DecisionTreeNode{
			ID:          id,
			Name:        name,
			Description: desc,
			IsLeaf:      false,
		}
		tree.nodes[id] = n
		return n
	}

	// Deploy issues node
	deployNode := internal("deploy", "Deployment Issues", "Investigating deployment-related failures")
	deployNodeBranches := []models.DecisionBranch{
		{
			ID:    "deploy-crash",
			Name:  "Container Start Failure",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "CrashLoopBackOff"},
			},
			RecommendedChecks: []string{"Check container logs", "Verify image pull policy", "Check liveness probe config"},
			Children:          leaf("leaf-crash", "Container Start Failure", "Container is failing to start or crashing immediately", &models.RootCause{
				Description: "Container CrashLoopBackOff - likely due to application startup error, missing config, or failed health check",
				Category:    "deployment",
				Confidence:  75,
				Evidence:    []string{"Container status shows CrashLoopBackOff", "Repeated restart attempts detected"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Check container logs for startup errors", ActionType: "investigate", Priority: "critical", EstimatedTimeMs: 300000, AutomationLevel: "semi_auto"},
					{Description: "Verify environment variables and config maps", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 180000, AutomationLevel: "manual"},
				},
			}),
		},
		{
			ID:    "deploy-image",
			Name:  "Image Pull Failure",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "ImagePullBackOff"},
			},
			RecommendedChecks: []string{"Check image registry access", "Verify image tag exists", "Check pull secrets"},
			Children:          leaf("leaf-image", "Image Pull Failure", "Container image cannot be pulled from registry", &models.RootCause{
				Description: "ImagePullBackOff - image not found or authentication failure",
				Category:    "deployment",
				Confidence:  85,
				Evidence:    []string{"Container status shows ImagePullBackOff", "Image pull attempts failed"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Verify image name and tag exist in registry", ActionType: "investigate", Priority: "critical", EstimatedTimeMs: 120000, AutomationLevel: "semi_auto"},
					{Description: "Check image pull secrets are configured correctly", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 180000, AutomationLevel: "manual"},
				},
			}),
		},
		{
			ID:    "deploy-resource",
			Name:  "Insufficient Resources",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "Insufficient"},
			},
			RecommendedChecks: []string{"Check cluster resource usage", "Review resource quotas", "Check node capacity"},
			Children:          leaf("leaf-resource", "Insufficient Resources", "Cluster does not have enough resources for deployment", &models.RootCause{
				Description: "Insufficient cluster resources (CPU/memory) for deployment",
				Category:    "infrastructure",
				Confidence:  80,
				Evidence:    []string{"Scheduler reports Insufficient cpu/memory", "Node resource utilization is high"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Review current resource allocation and usage", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 180000, AutomationLevel: "semi_auto"},
					{Description: "Scale cluster or reduce resource requests", ActionType: "scale", Priority: "critical", EstimatedTimeMs: 600000, AutomationLevel: "semi_auto"},
				},
			}),
		},
	}
	deployNode.Branch = deployNodeBranches
	deployNode.DefaultBranch = &models.DecisionBranch{
		ID:    "deploy-default",
		Name:  "Other Deployment Issue",
		RecommendedChecks: []string{"Review deployment manifest", "Check cluster events", "Verify namespace config"},
		Children:          leaf("leaf-deploy-unknown", "Unknown Deployment Issue", "Deployment failure not matching known patterns", &models.RootCause{
			Description: "Unknown deployment failure - manual investigation required",
			Category:    "deployment",
			Confidence:  40,
			Evidence:    []string{"Deployment failed", "No matching diagnostic pattern found"},
			RecommendedActions: []models.RecommendedAction{
				{Description: "Review full deployment logs and events", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 600000, AutomationLevel: "manual"},
			},
		}),
	}

	// Pipeline issues node
	pipelineNode := internal("pipeline", "Pipeline Issues", "Investigating pipeline-related failures")
	pipelineNodeBranches := []models.DecisionBranch{
		{
			ID:    "pipe-test",
			Name:  "Test Failures",
			Conditions: []models.DecisionCondition{
				{Field: "type", Operator: "equals", Value: "test_failure"},
			},
			RecommendedChecks: []string{"Review test output", "Check test environment", "Verify dependencies"},
			Children:          leaf("leaf-test", "Test Failures", "Pipeline failed due to test failures", &models.RootCause{
				Description: "Pipeline test stage failed - application code or test environment issue",
				Category:    "application",
				Confidence:  70,
				Evidence:    []string{"Test stage reported failures", "Test output shows assertion errors"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Review test output and failing test cases", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 300000, AutomationLevel: "semi_auto"},
					{Description: "Fix failing tests and re-run pipeline", ActionType: "fix", Priority: "high", EstimatedTimeMs: 900000, AutomationLevel: "manual"},
				},
			}),
		},
		{
			ID:    "pipe-runner",
			Name:  "Runner Unavailable",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "runner"},
				{Field: "severity", Operator: "gte", Value: "error"},
			},
			RecommendedChecks: []string{"Check runner status", "Verify runner registration", "Check runner resource usage"},
			Children:          leaf("leaf-runner", "Runner Unavailable", "Pipeline runner is not available or not responding", &models.RootCause{
				Description: "Pipeline runner unavailable - runner may be offline, overloaded, or misconfigured",
				Category:    "infrastructure",
				Confidence:  75,
				Evidence:    []string{"Pipeline stuck waiting for runner", "Runner status shows offline or busy"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Check runner registration and status", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 180000, AutomationLevel: "semi_auto"},
					{Description: "Restart or re-register the runner", ActionType: "restart", Priority: "high", EstimatedTimeMs: 300000, AutomationLevel: "semi_auto"},
				},
			}),
		},
	}
	pipelineNode.Branch = pipelineNodeBranches
	pipelineNode.DefaultBranch = &models.DecisionBranch{
		ID:    "pipe-default",
		Name:  "Other Pipeline Issue",
		RecommendedChecks: []string{"Review full pipeline log", "Check stage configurations", "Verify environment variables"},
		Children:          leaf("leaf-pipe-unknown", "Unknown Pipeline Issue", "Pipeline failure not matching known patterns", &models.RootCause{
			Description: "Unknown pipeline failure - manual investigation required",
			Category:    "pipeline",
			Confidence:  35,
			Evidence:    []string{"Pipeline failed", "No matching diagnostic pattern found"},
			RecommendedActions: []models.RecommendedAction{
				{Description: "Review full pipeline execution log", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 600000, AutomationLevel: "manual"},
			},
		}),
	}

	// Database issues node
	dbNode := internal("db", "Database Issues", "Investigating database-related failures")
	dbNodeBranches := []models.DecisionBranch{
		{
			ID:    "db-timeout",
			Name:  "Connection Timeout",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "timeout"},
			},
			RecommendedChecks: []string{"Check database server status", "Review connection pool config", "Check network latency"},
			Children:          leaf("leaf-db-timeout", "Database Connection Timeout", "Database connection timeout detected", &models.RootCause{
				Description: "Database connection timeout - likely due to connection pool exhaustion, network issue, or database overload",
				Category:    "database",
				Confidence:  70,
				Evidence:    []string{"Connection timeout errors detected", "Slow query log may show issues"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Check database server status and load", ActionType: "investigate", Priority: "critical", EstimatedTimeMs: 180000, AutomationLevel: "semi_auto"},
					{Description: "Increase connection pool size if needed", ActionType: "fix", Priority: "high", EstimatedTimeMs: 300000, AutomationLevel: "semi_auto"},
				},
			}),
		},
	}
	dbNode.Branch = dbNodeBranches
	dbNode.DefaultBranch = &models.DecisionBranch{
		ID:    "db-default",
		Name:  "Other Database Issue",
		RecommendedChecks: []string{"Check database logs", "Review recent migrations", "Verify replication status"},
		Children:          leaf("leaf-db-unknown", "Unknown Database Issue", "Database failure not matching known patterns", &models.RootCause{
			Description: "Unknown database failure - manual investigation required",
			Category:    "database",
			Confidence:  35,
			Evidence:    []string{"Database issue detected", "No matching diagnostic pattern found"},
			RecommendedActions: []models.RecommendedAction{
				{Description: "Review database logs and recent changes", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 600000, AutomationLevel: "manual"},
			},
		}),
	}

	// Infrastructure issues node
	infraNode := internal("infra", "Infrastructure Issues", "Investigating infrastructure-related failures")
	infraNodeBranches := []models.DecisionBranch{
		{
			ID:    "infra-disk",
			Name:  "Disk Full",
			Conditions: []models.DecisionCondition{
				{Field: "description", Operator: "contains", Value: "disk"},
				{Field: "description", Operator: "contains", Value: "full"},
			},
			RecommendedChecks: []string{"Check disk usage", "Identify large files", "Review log rotation"},
			Children:          leaf("leaf-disk", "Disk Full", "Node disk is full or nearly full", &models.RootCause{
				Description: "Disk space exhausted - likely due to log accumulation or large file generation",
				Category:    "infrastructure",
				Confidence:  85,
				Evidence:    []string{"Disk usage above 90%", "Services failing to write"},
				RecommendedActions: []models.RecommendedAction{
					{Description: "Identify and clean up large files and old logs", ActionType: "fix", Priority: "critical", EstimatedTimeMs: 300000, AutomationLevel: "semi_auto"},
					{Description: "Configure log rotation and retention policies", ActionType: "fix", Priority: "medium", EstimatedTimeMs: 600000, AutomationLevel: "manual"},
				},
			}),
		},
	}
	infraNode.Branch = infraNodeBranches
	infraNode.DefaultBranch = &models.DecisionBranch{
		ID:    "infra-default",
		Name:  "Other Infrastructure Issue",
		RecommendedChecks: []string{"Check system metrics", "Review recent changes", "Verify network connectivity"},
		Children:          leaf("leaf-infra-unknown", "Unknown Infrastructure Issue", "Infrastructure failure not matching known patterns", &models.RootCause{
			Description: "Unknown infrastructure failure - manual investigation required",
			Category:    "infrastructure",
			Confidence:  30,
			Evidence:    []string{"Infrastructure issue detected", "No matching diagnostic pattern found"},
			RecommendedActions: []models.RecommendedAction{
				{Description: "Review system metrics and recent changes", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 900000, AutomationLevel: "manual"},
			},
		}),
	}

	// Root branches
	tree.root.Branch = []models.DecisionBranch{
		{
			ID:    "root-deploy",
			Name:  "Check Deployment Issues",
			Conditions: []models.DecisionCondition{{Field: "type", Operator: "equals", Value: "deployment_failure"}},
			RecommendedChecks: []string{"Check deployment logs", "Verify container status", "Check resource quotas"},
			Children:          deployNode,
		},
		{
			ID:    "root-pipeline",
			Name:  "Check Pipeline Issues",
			Conditions: []models.DecisionCondition{{Field: "type", Operator: "equals", Value: "pipeline_failure"}},
			RecommendedChecks: []string{"Check pipeline logs", "Verify stage configurations", "Check runner availability"},
			Children:          pipelineNode,
		},
		{
			ID:    "root-infra",
			Name:  "Check Infrastructure Issues",
			Conditions: []models.DecisionCondition{{Field: "type", Operator: "any_of", Value: "[\"node_failure\",\"resource_exhaustion\",\"network_issue\"]"}},
			RecommendedChecks: []string{"Check node health", "Review resource utilization", "Check network connectivity"},
			Children:          infraNode,
		},
		{
			ID:    "root-db",
			Name:  "Check Database Issues",
			Conditions: []models.DecisionCondition{{Field: "type", Operator: "any_of", Value: "[\"database_error\",\"connection_timeout\",\"query_failure\"]"}},
			RecommendedChecks: []string{"Check database connectivity", "Review query performance", "Check connection pool"},
			Children:          dbNode,
		},
	}

	// Root default
	tree.root.DefaultBranch = &models.DecisionBranch{
		ID:    "root-default",
		Name:  "Unknown Issue Type",
		RecommendedChecks: []string{"Collect system logs", "Check recent changes", "Review monitoring alerts"},
		Children:          leaf("leaf-general", "General Diagnosis", "General diagnostic procedure for unrecognized issues", &models.RootCause{
			Description: "Unrecognized issue pattern - requires manual investigation",
			Category:    "unknown",
			Confidence:  20,
			Evidence:    []string{"Symptoms do not match any known pattern"},
			RecommendedActions: []models.RecommendedAction{
				{Description: "Collect all relevant logs and metrics", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 600000, AutomationLevel: "manual"},
				{Description: "Check recent deployments and configuration changes", ActionType: "investigate", Priority: "high", EstimatedTimeMs: 300000, AutomationLevel: "manual"},
			},
		}),
	}

	return tree
}

// Evaluate runs the decision tree over the given symptoms and returns a TreeResult.
func (t *DecisionTree) Evaluate(symptoms []models.Symptom) *TreeResult {
	var path []string
	var matchedBranches []models.DecisionBranch
	var allChecks []string
	var currentNode *models.DecisionTreeNode
	var found bool
	for _, n := range t.nodes {
		if n.ID == "root" {
			currentNode = n
			found = true
			break
		}
	}
	if !found {
		return &TreeResult{Path: []string{"root"}, Node: t.root}
	}
	path = append(path, currentNode.Name)

	for depth := 0; depth < 20; depth++ {
		if currentNode.IsLeaf {
			return &TreeResult{
				Path:              path,
				Node:              currentNode,
				RootCause:         currentNode.RootCause,
				RecommendedChecks: allChecks,
				MatchedBranches:   matchedBranches,
			}
		}
		matched := t.findMatchingBranch(currentNode.Branch, symptoms)
		if matched != nil {
			path = append(path, matched.Name)
			matchedBranches = append(matchedBranches, *matched)
			allChecks = append(allChecks, matched.RecommendedChecks...)
			currentNode = matched.Children
			continue
		}
		if currentNode.DefaultBranch != nil {
			path = append(path, "Default: "+currentNode.DefaultBranch.Name)
			allChecks = append(allChecks, currentNode.DefaultBranch.RecommendedChecks...)
			currentNode = currentNode.DefaultBranch.Children
			continue
		}
		break
	}
	return &TreeResult{
		Path:              path,
		Node:              currentNode,
		RootCause:         currentNode.RootCause,
		RecommendedChecks: allChecks,
		MatchedBranches:   matchedBranches,
	}
}

func (t *DecisionTree) findMatchingBranch(branches []models.DecisionBranch, symptoms []models.Symptom) *models.DecisionBranch {
	for i := range branches {
		b := &branches[i]
		if t.conditionsMatch(b.Conditions, symptoms) {
			return b
		}
	}
	return nil
}

func (t *DecisionTree) conditionsMatch(conditions []models.DecisionCondition, symptoms []models.Symptom) bool {
	for _, cond := range conditions {
		ok := false
		for _, s := range symptoms {
			if t.conditionMatchesSymptom(cond, s) {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

func (t *DecisionTree) conditionMatchesSymptom(cond models.DecisionCondition, s models.Symptom) bool {
	var fieldValue string
	switch cond.Field {
	case "type":
		fieldValue = s.Type
	case "source":
		fieldValue = s.Source
	case "severity":
		fieldValue = s.Severity
	case "description":
		fieldValue = s.Description
	case "metadata":
		fieldValue = ""
	default:
		return false
	}
	return t.evaluateCondition(fieldValue, cond)
}

func (t *DecisionTree) evaluateCondition(value string, cond models.DecisionCondition) bool {
	c := cond.Value
	switch cond.Operator {
	case "equals":
		return value == c
	case "contains":
		return strings.Contains(strings.ToLower(value), strings.ToLower(c))
	case "gte":
		return severityLevel(value) >= severityLevel(c)
	case "lte":
		return severityLevel(value) <= severityLevel(c)
	case "regex":
		ok, err := regexp.MatchString(c, value)
		return err == nil && ok
	case "any_of":
		// For JSONB arrays, c looks like "[\"a\",\"b\"]"
		var vals []string
		json.Unmarshal([]byte(c), &vals)
		for _, v := range vals {
			if v == value {
				return true
			}
		}
		return value == c
	default:
		return false
	}
}
