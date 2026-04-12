# TASK-305 Diagnostic Agent (诊断 Agent) - Completion Report

## Summary

Implemented the TASK-305 Diagnostic Agent service for the Orion platform, providing automated fault diagnosis, root cause analysis, structured diagnostic report generation, and a diagnostic knowledge base that learns from past incidents.

## Files Created

### Core Service Files

| File | Description |
|------|-------------|
| `src/services/diagnostic/types.ts` | Type definitions for diagnostic sessions, symptoms, findings, root causes, reports, patterns, and API requests |
| `src/services/diagnostic/DiagnosticEngine.ts` | Core diagnostic engine with decision tree-based diagnosis, symptom correlation/clustering, and root cause identification with confidence scoring |
| `src/services/diagnostic/DiagnosticDecisionTree.ts` | Tree-based diagnostic procedure with branch conditions, leaf nodes as root causes, and built-in common failure patterns |
| `src/services/diagnostic/DiagnosticKnowledgeBase.ts` | Knowledge base for storing diagnostic patterns, pattern matching, learning from confirmed outcomes |
| `src/services/diagnostic/DiagnosticReporter.ts` | Structured diagnostic report generation with timeline, findings, recommendations, and fix complexity estimation |
| `src/services/diagnostic/DiagnosticAgentService.ts` | Main orchestration service with NATS event subscription for auto-triggering diagnostics on failures |
| `src/services/diagnostic/index.ts` | Module exports |

### API Routes

| File | Description |
|------|-------------|
| `src/api/diagnostic-routes.ts` | REST API routes under `/api/v1/diagnostic` prefix |

### Modified Files

| File | Change |
|------|--------|
| `src/api/routes.ts` | Added import and registration of diagnostic routes |

### Test Files

| File | Tests |
|------|-------|
| `src/services/diagnostic/__tests__/DiagnosticDecisionTree.test.ts` | 17 tests |
| `src/services/diagnostic/__tests__/DiagnosticKnowledgeBase.test.ts` | 25 tests |
| `src/services/diagnostic/__tests__/DiagnosticEngine.test.ts` | 25 tests |
| `src/services/diagnostic/__tests__/DiagnosticReporter.test.ts` | 13 tests |
| `src/services/diagnostic/__tests__/DiagnosticAgentService.test.ts` | 27 tests |

**Total: 107 tests, all passing**

## Acceptance Criteria Verification

### 1. Automated Fault Diagnosis Workflow

- **Decision tree based diagnosis**: `DiagnosticDecisionTree` implements a tree with branches for deployment failures, pipeline failures, infrastructure issues, and database problems
- **Step-by-step diagnostic procedures**: Each branch includes `recommendedChecks` that guide the diagnostic process
- **Built-in patterns**: `createDefaultDiagnosticDecisionTree()` includes patterns for CrashLoopBackOff, ImagePullBackOff, Insufficient Resources, Test Failures, Runner Unavailable, Disk Full, and Connection Timeout
- **Auto-trigger**: `DiagnosticAgentService` subscribes to `deployment.failed`, `pipeline.run.failed`, and `incident.created` NATS events

### 2. Root Cause Analysis

- **Symptom correlation**: `DiagnosticEngine.correlateSymptoms()` clusters symptoms by source and infers categories
- **Pattern matching**: `DiagnosticKnowledgeBase.matchSymptoms()` scores patterns against observed symptoms using type matching, source pattern matching, keyword matching, and severity filtering
- **Confidence scoring**: Root causes include a 0-100 confidence score based on decision tree confidence and knowledge base match quality
- **Evidence tracking**: Each root cause includes a list of evidence strings supporting the conclusion

### 3. Diagnostic Report Generation

- **Structured reports**: `DiagnosticReporter.generateReport()` produces `DiagnosticReport` objects with summary, findings, root cause, recommendations, and timeline
- **Timeline**: `formatTimeline()` creates chronologically ordered entries for symptom detection, findings, and root cause identification
- **Recommendations**: Formatted with priority ordering, automation labels, time estimates, and relevant commands
- **Fix complexity estimation**: `estimateFixComplexity()` evaluates complexity based on action count, manual intervention ratio, critical actions, symptom count, and confidence level

### 4. Diagnostic Knowledge Base Accumulation

- **Pattern storage**: `DiagnosticKnowledgeBase.addPattern()` stores diagnostic patterns with symptom templates, root causes, and solutions
- **Pattern matching**: `matchSymptoms()` returns scored matches sorted by relevance
- **Learning from outcomes**: `recordOutcome()` updates pattern frequency and average confirmation rate
- **Auto-learning**: `learnFromSession()` creates new patterns from completed diagnostic sessions
- **5 default patterns**: CrashLoopBackOff, ImagePull Failure, Database Connection, Pipeline Test Failure, Resource Exhaustion
- **Search**: `searchPatterns()` supports filtering by category, keyword, minimum frequency, and result limiting

## API Endpoints

All endpoints are under `/api/v1/diagnostic`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trigger` | Trigger a new diagnostic session |
| GET | `/sessions` | List diagnostic sessions (with filters) |
| GET | `/sessions/:id` | Get diagnostic session details |
| POST | `/sessions/:id/symptoms` | Add symptom to running session |
| POST | `/sessions/:id/complete` | Complete diagnostic session |
| GET | `/sessions/:id/complexity` | Estimate fix complexity |
| GET | `/reports` | List diagnostic reports |
| GET | `/reports/:id` | Get report details |
| POST | `/knowledge/patterns` | Add diagnostic pattern |
| GET | `/knowledge/patterns` | Search patterns |
| GET | `/knowledge/patterns/:id` | Get pattern details |
| GET | `/knowledge/stats` | Get knowledge base statistics |
| POST | `/knowledge/outcomes` | Record diagnostic outcome |
| GET | `/status` | Get service status |

## Test Results

```
Test Suites: 5 passed, 5 total
Tests:       107 passed, 107 total
Snapshots:   0 total
```

All tests pass with no failures. TypeScript compilation for diagnostic modules produces no errors.
