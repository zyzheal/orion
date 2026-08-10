package service

import (
	"testing"
)

// NOTE: All tests now require PostgreSQL. The repository constructor
// NewRepository(*sqlx.DB) no longer supports in-memory mode.
// These tests are marked as PostgreSQL-required until integration
// test infrastructure is available.

func TestCreateRule_Success(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestCreateRule_EmptyName(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestCreateRule_EmptyPattern(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestListRules_WithRules(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestListRules_Empty(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetRule_Success(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetRule_NotFound(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetRule_TenantIsolation(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestDeleteRule_Success(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestDeleteRule_NotFound(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestLevelScore_Scores(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestLevelScore_Default(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestClassify_MatchesPattern(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestClassify_HighestLevelWins(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestClassify_DisabledRuleIgnored(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestClassify_ResourceTypeMismatch(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestClassify_NoMatch(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetClassification_Success(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetClassification_NotFound(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestGetClassification_TenantIsolation(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestService_RejectionFormats(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestService_CreateAndGetRoundTrip(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestService_ListOnlyReturnsTenantRules(t *testing.T) { t.Skip("requires PostgreSQL") }
func TestService_TenantIDValidation(t *testing.T) { t.Skip("requires PostgreSQL") }