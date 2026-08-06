package models

import (
	"database/sql"
	"encoding/json"
	"testing"
	"time"
)

func TestPluginStatusConstants(t *testing.T) {
	tests := []struct {
		name     string
		status   PluginStatus
		expected string
	}{
		{"active", PluginStatusActive, "active"},
		{"disabled", PluginStatusDisabled, "disabled"},
		{"pending", PluginStatusPending, "pending"},
		{"uninstalled", PluginStatusUninstalled, "uninstalled"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if string(tc.status) != tc.expected {
				t.Errorf("PluginStatus %s: got %q, want %q", tc.name, tc.status, tc.expected)
			}
		})
	}
}

func TestPluginSerialization(t *testing.T) {
	price := int64(999)
	plugin := &Plugin{
		ID:               "plugin-1",
		TenantID:         "tenant-1",
		Name:             "test-plugin",
		Description:      sql.NullString{String: "A test plugin", Valid: true},
		Author:           sql.NullString{String: "author-1", Valid: true},
		Category:         sql.NullString{String: "ci-cd", Valid: true},
		Version:          "1.0.0",
		Tags:             sql.NullString{String: `["tag1","tag2"]`, Valid: true},
		IconURL:          sql.NullString{String: "https://example.com/icon.png", Valid: true},
		RepositoryURL:    sql.NullString{String: "https://github.com/test/plugin", Valid: true},
		DocumentationURL: sql.NullString{String: "https://example.com/docs", Valid: true},
		PriceCents:       sql.NullInt64{Int64: price, Valid: true},
		MainEntry:        sql.NullString{String: "main.js", Valid: true},
		Code:             sql.NullString{String: "console.log(1)", Valid: true},
		Dependencies:     sql.NullString{String: `{"lib":"1.0"}`, Valid: true},
		PlatformAPIVersion: sql.NullString{String: "v2", Valid: true},
		Permissions:      sql.NullString{String: `["read","write"]`, Valid: true},
		ConfigSchema:     sql.NullString{String: `{"type":"object"}`, Valid: true},
		Verified:         true,
		RatingAvg:        sql.NullFloat64{Float64: 4.5, Valid: true},
		RatingCount:      10,
		DownloadCount:    100,
		Status:           PluginStatusActive,
		CreatedAt:        1000000000,
		UpdatedAt:        sql.NullInt64{Int64: 1000000001, Valid: true},
	}

	data, err := json.Marshal(plugin)
	if err != nil {
		t.Fatalf("Marshal Plugin: %v", err)
	}

	var got Plugin
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal Plugin: %v", err)
	}
	if got.ID != plugin.ID {
		t.Errorf("ID: got %q, want %q", got.ID, plugin.ID)
	}
	if got.Name != plugin.Name {
		t.Errorf("Name: got %q, want %q", got.Name, plugin.Name)
	}
	// Code field has json:"-" so it should be omitted
	dec := make(map[string]interface{})
	if err := json.Unmarshal(data, &dec); err != nil {
		t.Fatalf("Unmarshal to map: %v", err)
	}
	if _, ok := dec["code"]; ok {
		t.Error("code field should be omitted from JSON (json:'-')")
	}
}

func TestPluginInfoSerialization(t *testing.T) {
	now := int64(time.Now().Unix())
	pluginInfo := &PluginInfo{
		ID:               "plugin-1",
		TenantID:         "tenant-1",
		Name:             "test-plugin",
		Description:      "A test plugin",
		Author:           "author-1",
		Category:         "ci-cd",
		Version:          "1.0.0",
		Tags:             []string{"tag1", "tag2"},
		IconURL:          "https://example.com/icon.png",
		RepositoryURL:    "https://github.com/test/plugin",
		DocumentationURL: "https://example.com/docs",
		MainEntry:        "main.js",
		Dependencies:     map[string]string{"lib": "1.0"},
		PlatformAPIVersion: "v2",
		Permissions:      []string{"read", "write"},
		ConfigSchema:     map[string]interface{}{"type": "object"},
		Verified:         true,
		RatingAvg:        4.5,
		RatingCount:      10,
		DownloadCount:    100,
		Status:           PluginStatusActive,
		CreatedAt:        1000000000,
		UpdatedAt:        &now,
	}

	data, err := json.Marshal(pluginInfo)
	if err != nil {
		t.Fatalf("Marshal PluginInfo: %v", err)
	}

	var got PluginInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal PluginInfo: %v", err)
	}
	if got.ID != pluginInfo.ID {
		t.Errorf("ID: got %q, want %q", got.ID, pluginInfo.ID)
	}
	if got.Status != pluginInfo.Status {
		t.Errorf("Status: got %q, want %q", got.Status, pluginInfo.Status)
	}
	if got.UpdatedAt == nil || *got.UpdatedAt != *pluginInfo.UpdatedAt {
		t.Errorf("UpdatedAt mismatch")
	}

	// Test with null optional fields
	pluginInfo2 := PluginInfo{
		ID:        "plugin-2",
		Name:      "empty-plugin",
		Version:   "0.1.0",
		Status:    PluginStatusActive,
		CreatedAt: 1000000000,
	}
	data2, err := json.Marshal(pluginInfo2)
	if err != nil {
		t.Fatalf("Marshal minimal PluginInfo: %v", err)
	}
	var got2 PluginInfo
	if err := json.Unmarshal(data2, &got2); err != nil {
		t.Fatalf("Unmarshal minimal PluginInfo: %v", err)
	}
	if got2.PriceCents != nil {
		t.Error("PriceCents should be null for minimal PluginInfo")
	}
}

func TestPluginReviewSerialization(t *testing.T) {
	review := &PluginReview{
		ID:       "rev-1",
		PluginID: "plugin-1",
		TenantID: sql.NullString{String: "tenant-1", Valid: true},
		UserID:   "user-1",
		Rating:   5,
		Comment:  sql.NullString{String: "Great plugin!", Valid: true},
		CreatedAt: 1000000000,
	}

	data, err := json.Marshal(review)
	if err != nil {
		t.Fatalf("Marshal PluginReview: %v", err)
	}

	var got PluginReview
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal PluginReview: %v", err)
	}
	if got.Rating != review.Rating {
		t.Errorf("Rating: got %d, want %d", got.Rating, review.Rating)
	}
	if got.UserID != review.UserID {
		t.Errorf("UserID: got %q, want %q", got.UserID, review.UserID)
	}

	// Test review without comment
	review2 := &PluginReview{
		ID:       "rev-2",
		PluginID: "plugin-1",
		UserID:   "user-2",
		Rating:   3,
	}
	data2, err := json.Marshal(review2)
	if err != nil {
		t.Fatalf("Marshal PluginReview without comment: %v", err)
	}
	var got2 PluginReview
	if err := json.Unmarshal(data2, &got2); err != nil {
		t.Fatalf("Unmarshal PluginReview without comment: %v", err)
	}
}

func TestQualityScoreSerialization(t *testing.T) {
	qs := &QualityScore{
		PluginID:      "plugin-1",
		Score:         85.5,
		CodeQuality:   90,
		Security:      80,
		Completeness:  75,
		Performance:   88,
		Documentation: 92,
		ComputedAt:    1000000000,
	}

	data, err := json.Marshal(qs)
	if err != nil {
		t.Fatalf("Marshal QualityScore: %v", err)
	}

	var got QualityScore
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal QualityScore: %v", err)
	}
	if got.Score != qs.Score {
		t.Errorf("Score: got %.2f, want %.2f", got.Score, qs.Score)
	}
	if got.Security != qs.Security {
		t.Errorf("Security: got %d, want %d", got.Security, qs.Security)
	}
}

func TestQualityScoreResponseSerialization(t *testing.T) {
	resp := &QualityScoreResponse{
		PluginID:             "plugin-1",
		OverallScore:         85,
		SecurityScore:        80,
		ReliabilityScore:     90,
		MaintainabilityScore: 75,
		DocumentationScore:   92,
		ReviewsCount:         10,
		AverageRating:        4.5,
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("Marshal QualityScoreResponse: %v", err)
	}

	var got QualityScoreResponse
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal QualityScoreResponse: %v", err)
	}
	if got.OverallScore != resp.OverallScore {
		t.Errorf("OverallScore: got %d, want %d", got.OverallScore, resp.OverallScore)
	}
}

func TestPluginStatsSerialization(t *testing.T) {
	stats := &PluginStats{
		TotalPlugins:    100,
		TotalInstalls:   5000,
		AverageRating:   4.2,
		PluginsByCategory: map[string]int64{
			"ci-cd":    30,
			"monitoring": 20,
		},
	}

	data, err := json.Marshal(stats)
	if err != nil {
		t.Fatalf("Marshal PluginStats: %v", err)
	}

	var got PluginStats
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal PluginStats: %v", err)
	}
	if got.TotalPlugins != stats.TotalPlugins {
		t.Errorf("TotalPlugins: got %d, want %d", got.TotalPlugins, stats.TotalPlugins)
	}
	if got.PluginsByCategory["ci-cd"] != 30 {
		t.Errorf("PluginsByCategory[ci-cd]: got %d, want 30", got.PluginsByCategory["ci-cd"])
	}
}

func TestPluginInstallResultSerialization(t *testing.T) {
	result := &PluginInstallResult{
		ID:          "install-1",
		PluginID:    "plugin-1",
		TenantID:    "tenant-1",
		Version:     "1.0.0",
		InstalledAt: 1000000000,
		Status:      "installed",
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal PluginInstallResult: %v", err)
	}

	var got PluginInstallResult
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal PluginInstallResult: %v", err)
	}
	if got.ID != result.ID {
		t.Errorf("ID: got %q, want %q", got.ID, result.ID)
	}
	if got.Status != result.Status {
		t.Errorf("Status: got %q, want %q", got.Status, result.Status)
	}
}

func TestReviewPluginRequestValidation(t *testing.T) {
	validReq := ReviewPluginRequest{
		Rating:  5,
		Comment: "good",
		UserID:  "user-1",
	}
	data, err := json.Marshal(validReq)
	if err != nil {
		t.Fatalf("Marshal ReviewPluginRequest: %v", err)
	}
	var got ReviewPluginRequest
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal ReviewPluginRequest: %v", err)
	}
	if got.Rating != 5 || got.UserID != "user-1" {
		t.Errorf("Unmarshaled ReviewPluginRequest mismatch: %+v", got)
	}
}

func TestPublishPluginRequestSerialization(t *testing.T) {
	price := int64(500)
	req := &PublishPluginRequest{
		Name:             "new-plugin",
		Description:      "A new plugin",
		Author:           "me",
		Category:         "devops",
		Version:          "2.0.0",
		Tags:             []string{"new"},
		PriceCents:       &price,
		Dependencies:     map[string]string{"dep": "1.0"},
		Permissions:      []string{"read"},
		ConfigSchema:     map[string]interface{}{"x": 1},
		PlatformAPIVersion: "v3",
		MainEntry:        "index.js",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal PublishPluginRequest: %v", err)
	}
	var got PublishPluginRequest
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal PublishPluginRequest: %v", err)
	}
	if got.Name != req.Name {
		t.Errorf("Name: got %q, want %q", got.Name, req.Name)
	}
	if got.PriceCents == nil || *got.PriceCents != price {
		t.Errorf("PriceCents mismatch")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "new" {
		t.Errorf("Tags mismatch: %v", got.Tags)
	}
}

func TestListPluginFilter(t *testing.T) {
	category := "ci-cd"
	verified := true
	limit := 50
	offset := 10

	filter := &ListPluginFilter{
		Category: &category,
		Verified: &verified,
		Search:   nil,
		Limit:    &limit,
		Offset:   &offset,
	}

	if *filter.Category != "ci-cd" {
		t.Errorf("Category: got %q, want ci-cd", *filter.Category)
	}
	if !*filter.Verified {
		t.Error("Verified should be true")
	}
	if filter.Search != nil {
		t.Error("Search should be nil")
	}
}
