# Circuit Breaker and Degradation Strategy Design Document

**Orion Platform**

| Document Metadata | |
|---|---|
| Version | 1.0 |
| Status | Draft |
| Created | 2026-04-10 |
| Owner | Platform Architecture Team |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Circuit Breaker Configuration](#2-circuit-breaker-configuration)
3. [Degradation Strategies](#3-degradation-strategies)
4. [Graceful Degradation Levels](#4-graceful-degradation-levels)
5. [Implementation Approach](#5-implementation-approach)
6. [Monitoring and Alerting](#6-monitoring-and-alerting)
7. [Testing Strategy](#7-testing-strategy)
8. [Appendix](#8-appendix)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the circuit breaker patterns and graceful degradation strategies for the Orion platform. The goal is to ensure system resilience when downstream dependencies fail, prevent cascade failures, and maintain core functionality during partial outages.

### 1.2 Scope

This design covers all 11 services in the Orion platform:

**Core Services (8):**
- API Gateway
- User Service
- Order Service
- Inventory Service
- Payment Service
- Notification Service
- Analytics Service
- Config Service

**External Dependencies (3):**
- Payment Gateway (Stripe/PayPal)
- Email Service (SendGrid/SES)
- SMS Service (Twilio)

### 1.3 Design Principles

- **Fail Fast**: Detect failures early and fail fast to prevent resource exhaustion
- **Fail Gracefully**: Degrade functionality in a controlled manner rather than crashing
- **Self-Healing**: Automatically recover when dependencies become healthy
- **Observability**: All circuit breaker state changes must be visible and alertable
- **Progressive Degradation**: Disable non-essential features before core functionality

---

## 2. Circuit Breaker Configuration

### 2.1 Circuit Breaker States

All circuit breakers operate in three states:

| State | Behavior | Transition Trigger |
|---|---|---|
| **CLOSED** | Normal operation, requests flow through | Failure count exceeds threshold |
| **OPEN** | Requests fail fast without calling downstream | Recovery timeout expires |
| **HALF-OPEN** | Limited requests test downstream health | Success rate meets threshold |

### 2.2 Configuration Matrix for Core Services

| Service | Failure Threshold | Success Threshold | Recovery Timeout | Half-Open Requests | Request Volume Threshold | Time Window |
|---|---|---|---|---|---|---|
| API Gateway | 5 consecutive OR 50% of 100 | 3 consecutive | 30s | 5 | 100 req/min | 60s rolling |
| User Service | 5 consecutive OR 40% of 50 | 3 consecutive | 30s | 3 | 50 req/min | 60s rolling |
| Order Service | 3 consecutive OR 30% of 30 | 5 consecutive | 60s | 5 | 30 req/min | 120s rolling |
| Inventory Service | 5 consecutive OR 50% of 100 | 3 consecutive | 30s | 5 | 100 req/min | 60s rolling |
| Payment Service | 3 consecutive OR 20% of 20 | 5 consecutive | 120s | 3 | 20 req/min | 300s rolling |
| Notification Service | 10 consecutive OR 60% of 200 | 3 consecutive | 30s | 10 | 200 req/min | 60s rolling |
| Analytics Service | 10 consecutive OR 70% of 500 | 3 consecutive | 30s | 10 | 500 req/min | 60s rolling |
| Config Service | 3 consecutive OR 50% of 10 | 3 consecutive | 15s | 3 | 10 req/min | 30s rolling |

### 2.3 Configuration Rationale by Service

#### API Gateway
- **Lower failure threshold (5)**: Gateway is the entry point; failures affect all downstream services
- **Short recovery (30s)**: Need to resume routing quickly once backend recovers
- **Higher half-open requests (5)**: Gateway handles diverse traffic; need broader health sampling

#### User Service
- **Moderate thresholds**: Authentication is critical but user lookups can be cached
- **40% failure rate**: Tolerates transient issues while protecting against degradation
- **30s recovery**: Balance between quick recovery and avoiding premature re-opening

#### Order Service
- **Stricter failure threshold (3)**: Order processing is business-critical; early detection preferred
- **Longer recovery (60s)**: Order systems often have complex recovery; avoid flapping
- **5 consecutive successes**: Ensure stable recovery before full traffic restoration

#### Inventory Service
- **Standard thresholds**: Inventory checks are high-volume but can fall back to cache
- **50% failure rate**: High throughput allows statistical confidence in failure detection
- **30s recovery**: Inventory data freshness important but brief staleness acceptable

#### Payment Service
- **Most conservative settings**: Financial transactions require highest reliability
- **Lowest failure tolerance (20%)**: Payment failures have direct business impact
- **Longest recovery (120s)**: Payment gateways often need extended recovery; prevent flapping
- **5 consecutive successes**: Absolute confidence required before resuming full traffic

#### Notification Service
- **Highest thresholds**: Notifications are best-effort; system tolerates more failures
- **60% failure rate**: Non-critical path allows higher tolerance
- **30s recovery**: Quick restoration preferred for user experience

#### Analytics Service
- **Most permissive settings**: Analytics is non-critical; prioritize availability
- **70% failure rate**: Only extreme failures should disable analytics
- **High volume threshold (500)**: Analytics generates high request volume

#### Config Service
- **Fastest recovery (15s)**: Configuration is foundational; quick restoration critical
- **Low volume threshold (10)**: Config requests are infrequent but critical
- **Short time window (30s)**: Config issues should be detected immediately

### 2.4 Configuration for External Dependencies

| External Service | Failure Threshold | Success Threshold | Recovery Timeout | Half-Open Requests | Request Volume Threshold | Time Window |
|---|---|---|---|---|---|---|
| Payment Gateway (Stripe/PayPal) | 3 consecutive OR 15% of 30 | 5 consecutive | 300s | 5 | 30 req/min | 300s rolling |
| Email Service (SendGrid/SES) | 10 consecutive OR 50% of 100 | 3 consecutive | 60s | 10 | 100 req/min | 60s rolling |
| SMS Service (Twilio) | 5 consecutive OR 40% of 50 | 3 consecutive | 120s | 5 | 50 req/min | 120s rolling |

### 2.5 External Dependency Rationale

#### Payment Gateway
- **Very low failure tolerance (15%)**: Direct revenue impact requires conservative settings
- **Longest recovery (300s/5min)**: Payment gateway issues typically require manual intervention
- **5-minute time window**: Payment patterns vary; longer window prevents false positives
- **5 consecutive successes**: Multiple successful transactions confirm gateway stability

#### Email Service
- **Moderate thresholds**: Email is important but not business-critical in real-time
- **50% failure rate**: Allows for transient provider issues without disabling
- **60s recovery**: Email providers typically recover quickly

#### SMS Service
- **Stricter than email**: SMS often used for time-sensitive 2FA/alerts
- **40% failure rate**: Balance between reliability and availability
- **120s recovery**: SMS providers may have carrier interconnection issues

### 2.6 Differentiated Settings by Request Type

#### API Gateway - Per-Route Settings

| Route Type | Failure Threshold | Recovery Timeout | Rationale |
|---|---|---|---|
| /auth/* | 3 consecutive | 30s | Authentication is critical path |
| /orders/* | 5 consecutive | 60s | Order operations business-critical |
| /inventory/* | 5 consecutive | 30s | Can serve stale cache briefly |
| /analytics/* | 10 consecutive | 30s | Non-critical, high tolerance |
| /health, /ready | 0 (excluded) | N/A | Health endpoints never circuit-broken |

#### Payment Service - Per-Operation Settings

| Operation | Failure Threshold | Recovery Timeout | Rationale |
|---|---|---|---|
| Authorize | 3 consecutive | 120s | Critical for checkout flow |
| Capture | 3 consecutive | 120s | Critical for order completion |
| Refund | 5 consecutive | 300s | Can retry; longer recovery acceptable |
| Status Check | 5 consecutive | 60s | Can fall back to cached status |

---

## 3. Degradation Strategies

### 3.1 Service Degradation Matrix

| Service | Downstream Dependencies | Degradation Behavior | Fallback Mechanism | User-Facing Impact |
|---|---|---|---|---|
| API Gateway | All core services | Route to fallback instances or return degraded response | Request queuing, cached responses | Increased latency, stale data |
| User Service | Database, Cache, Config Service | Serve from cache, skip non-critical enrichments | Redis cache with TTL, default user profile | Stale profile data, missing preferences |
| Order Service | Inventory, Payment, Notification | Queue orders, reserve inventory optimistically | Kafka queue, optimistic reservation | Delayed confirmation, manual review |
| Inventory Service | Database, Warehouse API | Serve cached inventory, allow oversell within threshold | Redis cache, oversell buffer (5%) | Potential backorders |
| Payment Service | Payment Gateway, Fraud Service | Queue transactions, use cached fraud score | Kafka queue, cached risk profile | Delayed processing, manual review |
| Notification Service | Email, SMS, Push Services | Queue notifications, batch on recovery | Kafka queue, priority-based draining | Delayed notifications |
| Analytics Service | Data Warehouse, ClickStream | Buffer events locally, batch upload | Local buffer (max 1hr), compression | Data latency up to 1 hour |
| Config Service | Database, Remote Config | Serve cached config, use embedded defaults | Local cache, embedded fallback config | Stale feature flags |

### 3.2 Detailed Degradation Behaviors

#### API Gateway

**When downstream services fail:**

1. **Primary fallback**: Attempt routing to replica instances in different availability zones
2. **Secondary fallback**: Return cached response if available and not expired beyond 2x TTL
3. **Tertiary fallback**: Return HTTP 503 with Retry-After header and graceful error message
4. **Request queuing**: For idempotent GET requests, queue and retry up to 3 times with exponential backoff

**Features degraded vs functional:**
- **Degraded**: Real-time data freshness, cross-service aggregations
- **Functional**: Core routing, authentication, rate limiting, cached responses

**User-facing behavior:**
- Response header `X-Degraded-Mode: true` indicates degraded operation
- Error messages clearly indicate temporary service issues
- Retry-After header provides expected recovery time

#### User Service

**When database/cache fails:**

1. **Cache miss fallback**: Return minimal user profile from embedded cache (userId, username, accountStatus)
2. **Write operations**: Queue profile updates with confirmation "Changes will be saved shortly"
3. **Authentication**: Always attempt auth; fail closed on auth service unavailability
4. **Preferences**: Skip non-critical preference loading, use system defaults

**Features degraded vs functional:**
- **Degraded**: Profile customization, preference persistence, activity history
- **Functional**: Authentication, basic profile display, account status

**User-facing behavior:**
- Banner notification: "Some features temporarily limited"
- Profile edits show pending state until confirmed
- Authentication failures show clear "service unavailable" message

#### Order Service

**When dependencies fail:**

1. **Inventory unavailable**: Allow order with "pending availability" status, notify when confirmed
2. **Payment unavailable**: Queue payment authorization, send email when processed
3. **Notification unavailable**: Log notification intent, process asynchronously on recovery
4. **Order queue**: All orders persist to Kafka; confirmation delayed until all dependencies healthy

**Features degraded vs functional:**
- **Degraded**: Instant confirmation, real-time inventory reservation, immediate payment capture
- **Functional**: Order placement, order tracking, order history

**User-facing behavior:**
- Order confirmation shows "Processing - You'll receive confirmation within X minutes"
- Order status page shows queued state with estimated processing time
- Email/SMS notifications sent when system recovers

#### Inventory Service

**When database/warehouse API fails:**

1. **Cache serving**: Serve inventory counts from Redis with clear staleness indicator
2. **Oversell buffer**: Allow orders up to 5% beyond cached available quantity
3. **Reservation extension**: Extend reservation TTL from 15min to 60min during degradation
4. **Write queuing**: Inventory adjustments queued and reconciled on recovery

**Features degraded vs functional:**
- **Degraded**: Real-time accuracy, immediate warehouse sync, precise availability
- **Functional**: Order placement, basic availability checks, reservation system

**User-facing behavior:**
- Product pages show "Limited stock - Order now" when serving cached data
- Checkout may show "Verifying availability" with delayed confirmation
- Backorder notifications sent if oversell occurs

#### Payment Service

**When payment gateway/fraud service fails:**

1. **Gateway failure**: Queue transaction, mark order "Payment Pending", retry every 60s
2. **Fraud service failure**: Use cached risk score, allow low-risk (< 0.3) transactions through
3. **High-risk queuing**: Transactions with cached score > 0.7 queued for manual review
4. **Fallback processor**: Route to secondary payment processor for critical transactions

**Features degraded vs functional:**
- **Degraded**: Instant payment confirmation, real-time fraud scoring, automatic refunds
- **Functional**: Payment queueing, order placement, manual processing capability

**User-facing behavior:**
- Checkout shows "Payment processing - Confirmation within 5 minutes"
- Email sent when payment confirmed or if manual action required
- Order status shows payment state clearly

#### Notification Service

**When email/SMS/push services fail:**

1. **Priority queuing**: Critical notifications (2FA, order confirmations) prioritized
2. **Batching**: Non-critical notifications batched and sent on recovery
3. **Channel fallback**: Attempt alternative channels (SMS if email fails, push if SMS fails)
4. **Suppression**: Marketing/promotional notifications suppressed during degradation

**Features degraded vs functional:**
- **Degraded**: Real-time delivery, marketing notifications, non-critical alerts
- **Functional**: Critical notifications, 2FA codes, order confirmations (delayed)

**User-facing behavior:**
- 2FA codes show extended validity (10min vs 5min) during degradation
- Order confirmation emails may be delayed with in-app notification as fallback
- Users see "Notifications may be delayed" in settings

#### Analytics Service

**When data warehouse/clickstream fails:**

1. **Local buffering**: Events buffered in memory with 1-hour max retention
2. **Compression**: Enable compression on buffered events to maximize buffer capacity
3. **Sampling**: If buffer exceeds 80%, begin sampling (50% then 25% of events)
4. **Graceful loss**: If buffer full, oldest events dropped with metrics logged

**Features degraded vs functional:**
- **Degraded**: Real-time dashboards, immediate insights, complete event capture
- **Functional**: Core application functionality, eventual data consistency

**User-facing behavior:**
- No direct user impact
- Internal dashboards show data latency indicators
- Reports may show incomplete data for degradation period

#### Config Service

**When database/remote config fails:**

1. **Local cache**: Serve last-known-good configuration from local cache
2. **Embedded defaults**: Critical feature flags have embedded default values
3. **TTL extension**: Extend cache TTL from 5min to 30min during degradation
4. **Safe defaults**: Unknown configurations default to "safe" state (feature off, conservative limits)

**Features degraded vs functional:**
- **Degraded**: Real-time configuration updates, dynamic feature flag changes
- **Functional**: All services continue with cached/embedded configuration

**User-facing behavior:**
- No immediate user impact
- Feature flag changes delayed until recovery
- A/B test assignments may be stale

### 3.3 Cross-Service Degradation Coordination

**Cascading Degradation Prevention:**

When multiple services detect degradation simultaneously, the following coordination applies:

1. **Upstream awareness**: Services propagate degradation status via response headers (`X-Downstream-Degraded: service-name`)
2. **Backpressure propagation**: Circuit breaker state shared via service mesh telemetry
3. **Coordinated fallback**: If Order Service and Payment Service both degraded, orders queued end-to-end rather than multiple retry loops
4. **Single source of truth**: Config Service degradation status determines global degradation level

---

## 4. Graceful Degradation Levels

### 4.1 Degradation Level Definitions

| Level | Name | Description | Trigger Scope |
|---|---|---|---|
| **L0** | Normal | All systems operational | N/A |
| **L1** | Minor | Non-critical services degraded | Single non-critical service |
| **L2** | Moderate | Core services degraded, fallbacks active | Multiple services or single critical service |
| **L3** | Severe | Multiple core services unavailable, significant functionality impaired | Platform-wide or multiple critical services |

### 4.2 Degradation Level Specifications

#### L0 - Normal Operation

**Trigger Conditions:**
- All circuit breakers CLOSED
- All health checks passing
- Error rates below baseline thresholds (< 1%)

**Services Affected:** None

**Features Disabled:** None

**Recovery Criteria:** N/A (baseline state)

**Alerting:** Standard monitoring only, no escalation

#### L1 - Minor Degradation

**Trigger Conditions (any of):**
- Analytics Service circuit breaker OPEN
- Notification Service circuit breaker OPEN (non-critical channels only)
- Single external dependency (Email OR SMS) unavailable
- Error rate 1-5% for non-critical paths

**Services Affected:**
- Analytics Service (degraded mode)
- Notification Service (partial degradation)

**Features Disabled:**
- Real-time analytics dashboards
- Marketing/promotional notifications
- Non-urgent system notifications
- Historical analytics queries

**Features Remaining Functional:**
- All core business functionality
- Critical notifications (2FA, order confirmations)
- Transaction processing
- User authentication

**Recovery Criteria:**
- Affected service circuit breakers CLOSED for 5 consecutive minutes
- Error rates return to < 1% for 5 minutes
- Automatic recovery without intervention

**Alerting:**
- Slack notification to #platform-alerts
- On-call notification (non-urgent)
- Dashboard indicator (yellow)

#### L2 - Moderate Degradation

**Trigger Conditions (any of):**
- Order Service OR Payment Service OR Inventory Service circuit breaker OPEN
- Payment Gateway external dependency unavailable
- Multiple L1 conditions simultaneously
- Error rate 5-10% for core paths
- User Service circuit breaker OPEN

**Services Affected:**
- Order Service (queued processing)
- Payment Service (delayed processing)
- Inventory Service (cached data)
- User Service (limited functionality)
- Any L1 affected services

**Features Disabled:**
- Instant order confirmation
- Real-time payment processing
- Real-time inventory accuracy
- Profile customization updates
- A/B test configuration updates
- Analytics (all features)

**Features Remaining Functional:**
- Order placement (delayed confirmation)
- Payment processing (manual review available)
- User authentication (cached profiles)
- Core browsing and search
- Order tracking
- Customer support escalation path

**Recovery Criteria:**
- All critical service circuit breakers CLOSED for 10 consecutive minutes
- Payment gateway connectivity restored and 5 successful transactions
- Error rates return to < 2% for 10 minutes
- May require manual verification for payment systems

**Alerting:**
- Slack notification to #platform-alerts and #incident-response
- PagerDuty alert to primary on-call
- Email to engineering leadership
- Dashboard indicator (orange)
- Status page update (investigating)

#### L3 - Severe Degradation

**Trigger Conditions (any of):**
- API Gateway circuit breaker OPEN
- Multiple core services (3+) circuit breakers OPEN simultaneously
- Config Service circuit breaker OPEN
- Error rate > 10% across multiple services
- Complete external dependency failure (Payment Gateway + fallback unavailable)
- Infrastructure failure (region, cluster)

**Services Affected:**
- All core services potentially impacted
- Platform-wide degradation

**Features Disabled:**
- Order processing (new orders queued or rejected)
- Payment processing
- User account modifications
- Real-time features (all)
- Analytics (all features)
- Non-essential API endpoints

**Features Remaining Functional:**
- Health check endpoints
- Read-only access to historical data
- Static content serving
- Basic authentication (cached credentials)
- Emergency administrative access
- Customer support escalation

**User-Facing Behavior:**
- Homepage banner: "Experiencing technical difficulties"
- API responses include 503 with Retry-After
- Queue-based processing for all write operations
- Clear messaging on expected recovery time

**Recovery Criteria:**
- API Gateway and Config Service circuit breakers CLOSED
- At least 80% of core services operational
- Error rates < 5% for 15 consecutive minutes
- Manual verification and sign-off from incident commander
- Gradual traffic restoration (25%, 50%, 75%, 100%)

**Alerting:**
- Immediate PagerDuty alert to primary and secondary on-call
- Phone call to engineering leadership
- Slack war room created (#incident-YYYY-MM-DD-brief)
- Status page updated (identified outage, ETA if known)
- Customer support notification with talking points
- Executive briefing prepared

### 4.3 Degradation Level Transition Matrix

| Current Level | Transition To | Trigger | Cooling Period |
|---|---|---|---|
| L0 | L1 | Single non-critical CB opens | N/A |
| L0 | L2 | Single critical CB opens | N/A |
| L0 | L3 | Gateway CB opens OR 3+ critical CBs open | N/A |
| L1 | L0 | All L1 triggers resolved | 5 minutes |
| L1 | L2 | Additional critical CB opens | N/A |
| L2 | L1 | Critical CBs resolved, L1 triggers remain | 10 minutes |
| L2 | L0 | All L2 triggers resolved | 10 minutes |
| L2 | L3 | Additional CBs open (total 3+) | N/A |
| L3 | L2 | Gateway CB closed AND < 3 critical CBs open | 15 minutes |
| L3 | L0 | All systems nominal | 15 minutes |

**Cooling Period:** Minimum time in recovered state before level downgrade to prevent flapping

### 4.4 Automatic vs Manual Transitions

| Transition | Automatic | Requires Manual Approval |
|---|---|---|
| L0 -> L1 | Yes | No |
| L0 -> L2 | Yes | No |
| L0 -> L3 | Yes (with immediate page) | No |
| L1 -> L0 | Yes | No |
| L1 -> L2 | Yes | No |
| L2 -> L1 | Yes | No |
| L2 -> L0 | Yes | No |
| L2 -> L3 | Yes (with immediate page) | No |
| L3 -> L2 | No | Incident Commander |
| L3 -> L0 | No | Incident Commander |

---

## 5. Implementation Approach

### 5.1 Istio Service Mesh Integration

#### Istio Circuit Breaker Configuration

Circuit breakers will be implemented at the Istio service mesh layer using DestinationRules and Envoy proxy configuration:

**Connection Pool Settings:**
- Maximum connections per cluster: 100
- Maximum pending requests: 100
- Maximum concurrent requests: 1000
- Maximum active requests per connection: 100

**Outlier Detection (Circuit Breaking):**
- Consecutive 5xx errors: Threshold per service (see Section 2.2)
- Interval for ejection check: 10 seconds
- Base ejection time: Matches recovery timeout per service
- Maximum ejection percentage: 50% (prevent total blackout)

**Istio Configuration Locations:**
- DestinationRules: Per-service traffic policies
- Envoy Filters: Custom circuit breaker logic where needed
- VirtualServices: Routing rules with fallback configuration

#### Service Mesh Benefits

1. **Transparent Operation**: Application code requires no circuit breaker logic
2. **Centralized Management**: All configurations in Kubernetes manifests
3. **Consistent Behavior**: Uniform circuit breaker implementation across services
4. **Observability Integration**: Built-in metrics and tracing
5. **Dynamic Configuration**: Istio Pilot pushes updates without restart

### 5.2 Client-Side vs Server-Side Circuit Breakers

#### Server-Side (Primary Implementation)

**Location:** Istio sidecar proxies (Envoy)

**Responsibilities:**
- Outbound request protection to downstream services
- Connection pool management
- Error rate monitoring and ejection
- Retry logic with exponential backoff

**Configuration:**
- Managed via Kubernetes DestinationRule resources
- Version controlled and deployed with services
- Hot-reloadable via Istio Pilot

#### Client-Side (Supplementary Implementation)

**Location:** Application-level SDK/library

**Responsibilities:**
- Business-aware circuit breaking (e.g., payment-specific logic)
- Custom fallback behaviors requiring application state
- Cache access and management
- Queue management for deferred processing

**When Client-Side Required:**
- Fallback requires accessing local cache
- Business logic determines fallback behavior
- Queueing with application state
- Custom error handling per operation type

#### Hybrid Approach

| Scenario | Implementation |
|---|---|
| Standard HTTP calls | Server-side (Istio) only |
| Database connections | Client-side (per-framework) |
| External API calls | Server-side + Client-side fallback logic |
| Message queue operations | Client-side |
| Cache operations | Client-side |
| Streaming connections | Client-side with server-side protection |

### 5.3 Configuration Management

#### Centralized Configuration (Primary)

**Storage:** Kubernetes ConfigMaps and Istio DestinationRules in Git

**Management:**
- All circuit breaker configurations in version control
- GitOps deployment via ArgoCD
- Single source of truth for platform-wide settings

**File Structure:**
```
platform-config/
  circuit-breakers/
    api-gateway-destination-rule.yaml
    user-service-destination-rule.yaml
    order-service-destination-rule.yaml
    [per-service files]
  degradation-levels/
    degradation-config.yaml
    alerting-rules.yaml
```

**Update Process:**
1. Configuration change in Git pull request
2. Automated validation (syntax, range checks)
3. Peer review and approval
4. ArgoCD sync to staging cluster
5. Validation period (30 minutes)
6. ArgoCD sync to production
7. Monitoring for unintended effects

#### Per-Service Overrides (Limited)

**Allowed Overrides:**
- Request-specific timeout adjustments
- Operation-specific retry counts
- Route-level circuit breaker settings (via annotations)

**Override Process:**
- Service annotations on Kubernetes Deployments
- Validated by admission webhook
- Logged for audit trail
- Cannot exceed platform maximums

#### Configuration Validation

**Pre-Deployment Checks:**
- Threshold values within acceptable ranges
- Recovery timeout >= minimum (15s)
- Failure threshold >= minimum (3)
- No circular dependencies in fallback chains

**Runtime Validation:**
- Configuration change rate limiting (max 3 changes/hour)
- Automatic rollback if error rate spikes after change
- Alerting on configuration drift

### 5.4 Failover and Recovery Orchestration

#### Automatic Failover Sequence

1. **Detection**: Istio outlier detection identifies failing endpoints
2. **Ejection**: Unhealthy endpoints removed from load balancing pool
3. **Circuit Open**: After threshold, circuit breaker opens
4. **Fallback**: Requests routed to fallback handler
5. **Half-Open**: After recovery timeout, test requests sent
6. **Recovery**: Successful tests close circuit, normal operation resumes

#### Manual Intervention Points

| Scenario | Manual Action Required |
|---|---|
| L3 degradation reached | Incident Commander coordination |
| Payment Gateway extended outage | Switch to secondary processor |
| Database failure | DBA failover to replica |
| Configuration-induced failure | Rollback configuration |
| Cascading failure detected | Traffic shaping/rate limiting |

#### Recovery Orchestration

**Gradual Traffic Restoration:**
1. 25% traffic for 2 minutes
2. 50% traffic for 2 minutes
3. 75% traffic for 2 minutes
4. 100% traffic
5. Abort and re-open circuit if error rate increases at any step

**Coordination:**
- Istio Weighted Routing for traffic percentages
- Monitoring dashboards track recovery progress
- Automated abort on error rate increase

---

## 6. Monitoring and Alerting

### 6.1 Circuit Breaker Metrics

#### Core Metrics (Per Service)

| Metric Name | Type | Description | Labels |
|---|---|---|---|
| `circuit_breaker_state` | Gauge | Current state (0=CLOSED, 1=OPEN, 2=HALF-OPEN) | service, dependency |
| `circuit_breaker_state_changes_total` | Counter | Total state transitions | service, from_state, to_state |
| `circuit_breaker_rejections_total` | Counter | Requests rejected due to OPEN circuit | service, dependency |
| `circuit_breaker_success_total` | Counter | Successful requests through circuit | service, dependency |
| `circuit_breaker_failure_total` | Counter | Failed requests through circuit | service, dependency, error_type |
| `circuit_breaker_half_open_requests` | Gauge | Current requests in HALF-OPEN state | service, dependency |
| `circuit_breaker_failure_rate` | Gauge | Current failure rate percentage | service, dependency |
| `circuit_breaker_last_state_change` | Gauge | Timestamp of last state change | service, dependency |

#### Derived Metrics

| Metric Name | Calculation | Purpose |
|---|---|---|
| `circuit_breaker_health_score` | Weighted formula of state + failure rate | Overall circuit health |
| `circuit_breaker_flapping_count` | State changes per minute | Detect unstable circuits |
| `degradation_level_current` | Aggregated from all circuits | Platform degradation level |
| `estimated_recovery_time_seconds` | Based on half-open success rate | ETA for recovery |

### 6.2 Dashboard Requirements

#### Platform Circuit Breaker Dashboard

**Sections:**

1. **Platform Overview (Top Level)**
   - Current degradation level (L0-L3) indicator
   - Count of circuit breakers per state
   - Trend line of state changes over time
   - List of currently OPEN circuits

2. **Per-Service Circuit Status**
   - Grid view of all 11 services
   - Color-coded state indicators
   - Current failure rate percentage
   - Time in current state
   - Last state change timestamp

3. **Historical Analysis**
   - State change timeline (24h, 7d, 30d)
   - Failure rate trends per service
   - Correlation with deployments
   - MTTR (Mean Time To Recovery) metrics

4. **Dependency Map**
   - Visual graph of service dependencies
   - Edge thickness = request volume
   - Edge color = circuit health
   - Node color = service health

5. **Recent Events**
   - Timeline of circuit breaker events
   - Deployment markers
   - Manual interventions
   - Escalation events

#### Service-Level Dashboard (Per Service)

**Sections:**

1. **Circuit Status**
   - Current state with visual indicator
   - Configuration summary (thresholds, timeouts)
   - Time in current state
   - State change history (sparkline)

2. **Request Metrics**
   - Request rate (success/failure/rejected)
   - Latency percentiles (p50, p95, p99)
   - Error rate percentage
   - Retry rate

3. **Circuit Breaker Details**
   - Current failure count vs threshold
   - Success count (for half-open)
   - Time until next state transition
   - Pending test requests (half-open)

4. **Dependency Health**
   - Downstream service status
   - External dependency availability
   - Database connection pool status
   - Cache hit/miss rates

### 6.3 Alert Thresholds and Escalation

#### Alert Rules

| Alert Name | Condition | Severity | Initial Notification |
|---|---|---|---|
| `CircuitBreakerOpen` | Any CB state != CLOSED for > 2 min | Warning | Slack #platform-alerts |
| `CircuitBreakerOpenCritical` | Critical service CB open > 2 min | Critical | PagerDuty primary |
| `CircuitBreakerFlapping` | > 5 state changes in 10 min | Warning | Slack #platform-alerts |
| `HighRejectionRate` | > 10% requests rejected | Warning | Slack #platform-alerts |
| `DegradationLevelL1` | Platform level = L1 | Warning | Slack + on-call notify |
| `DegradationLevelL2` | Platform level = L2 | Critical | PagerDuty primary |
| `DegradationLevelL3` | Platform level = L3 | Emergency | PagerDuty primary + secondary |
| `ExtendedOutage` | L2/L3 for > 30 min | Critical | PagerDuty + leadership page |
| `CircuitBreakerConfigDrift` | Config differs from Git | Warning | Slack #platform-alerts |

#### Escalation Matrix

| Level | Initial | After 15 min | After 30 min | After 60 min |
|---|---|---|---|---|
| **Warning** | Slack | On-call notify | - | - |
| **Critical** | PagerDuty primary | PagerDuty secondary | Engineering lead | VP Engineering |
| **Emergency** | PagerDuty all | Leadership page | Executive briefing | Customer comms |

#### Escalation Triggers

**Automatic Escalation:**
- No acknowledgment within 15 minutes
- No status update within 30 minutes
- Degradation level increases
- Customer impact confirmed

**De-escalation:**
- Degradation level decreases
- All circuits CLOSED for 30 minutes
- Incident Commander approval

### 6.4 Runbook Integration

#### Automated Runbook Links

All alerts include direct links to relevant runbooks:

- Circuit breaker state change: `/runbooks/circuit-breaker-response`
- Degradation level change: `/runbooks/degradation-level-[L1/L2/L3]`
- Payment gateway failure: `/runbooks/payment-gateway-failure`
- Cascading failure: `/runbooks/cascading-failure-response`

#### Runbook Contents

Each runbook includes:
1. Immediate response actions
2. Diagnostic commands and queries
3. Escalation contacts
4. Communication templates
5. Recovery verification steps
6. Post-incident checklist

---

## 7. Testing Strategy

### 7.1 Chaos Engineering Approach

#### Testing Philosophy

- **Production-like environments**: Test in staging that mirrors production
- **Incremental exposure**: Start with low-impact experiments
- **Automated verification**: All tests have clear pass/fail criteria
- **Safe failure**: Tests cannot cause customer-impacting outages
- **Learning-focused**: Every test produces actionable insights

#### Chaos Experiment Categories

| Category | Description | Frequency | Environment |
|---|---|---|---|
| **Circuit Breaker Activation** | Trigger CB through controlled failures | Weekly | Staging |
| **Degradation Level Transition** | Force platform-wide degradation | Monthly | Staging |
| **Dependency Failure** | Simulate external service failures | Bi-weekly | Staging |
| **Cascading Failure** | Multiple simultaneous failures | Quarterly | Staging |
| **Game Day** | Full scenario with team response | Quarterly | Production (controlled) |

#### Chaos Tooling

**Primary Tools:**
- Chaos Mesh: Kubernetes-native chaos injection
- Istio Fault Injection: HTTP-level failure injection
- Custom Harness: Service-specific failure scenarios

**Injection Types:**
- HTTP 5xx response injection
- Latency injection (fixed and variable)
- Connection timeout simulation
- DNS failure simulation
- Pod termination
- Network partition simulation

### 7.2 Testing Circuit Breaker Activation

#### Test Scenarios

**Scenario 1: Consecutive Failure Threshold**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Send N consecutive failing requests (N = threshold) | CB remains CLOSED until threshold |
| 2 | Send one more failing request | CB transitions to OPEN |
| 3 | Send requests during OPEN state | Immediate rejection, no downstream call |
| 4 | Wait for recovery timeout | CB transitions to HALF-OPEN |
| 5 | Send successful test request | CB remains HALF-OPEN |
| 6 | Send required consecutive successes | CB transitions to CLOSED |

**Verification:**
- Metrics show correct state transitions
- No downstream calls during OPEN state
- Rejection count matches expected
- Recovery follows configured timing

**Scenario 2: Failure Rate Threshold**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Send mixed success/failure requests (failure rate < threshold) | CB remains CLOSED |
| 2 | Increase failure rate above threshold | CB transitions to OPEN after time window |
| 3 | Verify failure rate calculation | Matches configured time window |
| 4 | Restore healthy downstream | CB recovers through HALF-OPEN |

**Verification:**
- Failure rate metric accurate
- Time window correctly applied
- Transition timing correct

**Scenario 3: Half-Open Behavior**

| Step | Action | Expected Result |
|---|---|---|
| 1 | Force CB to HALF-OPEN state | Limited requests allowed |
| 2 | Send more than half-open-max-requests | Excess requests rejected |
| 3 | Send failing request in HALF-OPEN | CB returns to OPEN |
| 4 | Verify recovery timeout reset | New timeout period starts |

**Verification:**
- Request limiting in HALF-OPEN correct
- Failure resets to OPEN with new timeout
- Success counting accurate

#### Automated Test Suite

**Test Location:** `/tests/circuit-breaker/`

| Test File | Coverage |
|---|---|
| `test-cb-consecutive-failure.yaml` | Consecutive failure activation |
| `test-cb-failure-rate.yaml` | Percentage-based activation |
| `test-cb-recovery.yaml` | HALF-OPEN and recovery behavior |
| `test-cb-metrics.yaml` | Metric accuracy and completeness |
| `test-cb-flapping.yaml` | Anti-flapping behavior |

### 7.3 Testing Degradation Scenarios

#### Scenario Tests

**Test: Order Service with Payment Degradation**

| Step | Action | Expected Behavior |
|---|---|---|
| 1 | Trigger Payment Service CB to OPEN | Order Service detects downstream failure |
| 2 | Submit new order | Order queued, "Payment Pending" status |
| 3 | Verify user notification | Email: "Payment processing, confirmation within 5 min" |
| 4 | Restore Payment Service | Payment queue processes automatically |
| 5 | Verify order completion | Confirmation sent, order status updated |

**Test: Inventory Cache Fallback**

| Step | Action | Expected Behavior |
|---|---|---|
| 1 | Make Inventory DB unavailable | Inventory Service CB opens |
| 2 | Request inventory check | Served from Redis cache |
| 3 | Verify cache staleness indicator | Response includes freshness metadata |
| 4 | Submit order within oversell buffer | Order accepted |
| 5 | Submit order exceeding buffer | Order flagged for review |

**Test: Notification Channel Fallback**

| Step | Action | Expected Behavior |
|---|---|---|
| 1 | Make Email Service unavailable | Email circuit opens |
| 2 | Trigger order confirmation | Attempt SMS fallback |
| 3 | Verify in-app notification | Notification queued in-app |
| 4 | Restore Email Service | Queued emails sent |

**Test: Config Service Degradation**

| Step | Action | Expected Behavior |
|---|---|---|
| 1 | Make Config DB unavailable | Config Service CB opens |
| 2 | Request feature flag | Served from local cache |
| 3 | Update flag in Git | Update queued, not applied |
| 4 | Verify embedded defaults | Unknown flags use safe defaults |
| 5 | Restore Config Service | Queue processed, flags updated |

#### Degradation Level Tests

**L1 Transition Test:**
1. Inject Analytics Service failures
2. Verify L1 degradation triggered
3. Confirm only non-critical features affected
4. Verify alerting to Slack only
5. Restore service, verify L0 recovery

**L2 Transition Test:**
1. Inject Payment Service failures
2. Verify L2 degradation triggered
3. Confirm order queueing active
4. Verify PagerDuty alert sent
5. Verify status page update
6. Restore service, verify L0 recovery

**L3 Transition Test:**
1. Inject API Gateway failures (or multiple critical services)
2. Verify L3 degradation triggered
3. Confirm emergency alerting
4. Verify war room creation
5. Verify executive notification
6. Test gradual recovery process

### 7.4 Regular Drill Schedule

#### Weekly Drills (Automated)

**Schedule:** Every Tuesday 2:00 AM (low-traffic period)

**Rotation:**
- Week 1: Single service circuit breaker activation
- Week 2: External dependency failure
- Week 3: Cache/database failure scenario
- Week 4: Multi-service coordination test

**Execution:**
- Automated via CI/CD pipeline
- Results posted to #platform-testing
- Failures create investigation tickets

#### Monthly Drills (Manual)

**Schedule:** First Wednesday of each month, 10:00 AM

**Participants:**
- On-call engineer (lead)
- Platform team representative
- Optional: Service owner

**Format:**
- Pre-defined scenario injected in staging
- Team responds as if production
- Runbook usage verified
- Timing and communication evaluated

**Scenarios Rotation:**
| Month | Scenario |
|---|---|
| January | Payment Gateway extended outage |
| February | Database failover with cache warming |
| March | Cascading failure from external dependency |
| April | Config Service failure during deployment |
| May | Multi-region failover |
| June | DDoS + service failure combination |
| July | Holiday traffic + partial outage |
| August | Complete notification system failure |
| September | Order system + payment combination |
| October | Security incident + degraded performance |
| November | Black Friday scenario (high load + failure) |
| December | Year-end batch processing + failure |

#### Quarterly Game Days

**Schedule:** End of each quarter

**Scope:**
- Full team participation
- Production environment (controlled)
- Customer-impacting scenarios (with safeguards)
- Cross-team coordination

**Format:**
1. **Preparation (Week 1)**
   - Scenario definition
   - Safeguard implementation
   - Communication planning
   - Rollback procedures verified

2. **Execution (Week 2)**
   - Controlled injection during maintenance window
   - Team response and coordination
   - Customer communication (if applicable)
   - Recovery execution

3. **Review (Week 3)**
   - Blameless post-mortem
   - Runbook updates
   - Tool improvements
   - Training gaps identified

**Game Day Scenarios:**
- Q1: Complete payment processor failover
- Q2: Region failover with data replication lag
- Q3: Supply chain dependency cascade
- Q4: Peak load + multiple service failures

### 7.5 Test Environment Strategy

#### Environment Parity

| Aspect | Production | Staging | Notes |
|---|---|---|---|
| Service versions | Latest | Latest | Identical builds |
| Configuration | Production | Sanitized | Secrets differ |
| Data volume | Full | Sampled (10%) | Structurally similar |
| Traffic | Live | Synthetic + replayed | Production shadow |
| Circuit breaker settings | Production | Identical | Same thresholds |
| External dependencies | Live | Sandboxed | Test modes enabled |

#### Testing in Production

**When Appropriate:**
- Verifying monitoring and alerting
- Testing circuit breaker configuration changes
- Game day exercises
- Canary deployments with circuit breaker validation

**Safeguards:**
- Feature flags for chaos injection
- Automatic rollback on unexpected behavior
- Limited blast radius (single pod/instance first)
- Customer communication prepared
- Immediate rollback capability

### 7.6 Success Criteria

#### Circuit Breaker Test Success

| Criterion | Measurement |
|---|---|
| Activation timing | Within 10% of configured threshold |
| Recovery timing | Within 10% of configured timeout |
| Request rejection | 100% during OPEN state |
| Metrics accuracy | < 1% discrepancy |
| Alerting latency | < 60 seconds from state change |
| Runbook effectiveness | MTTR decreases over time |

#### Degradation Test Success

| Criterion | Measurement |
|---|---|---|
| Fallback activation | < 5 seconds from failure detection |
| Data consistency | No data loss during degradation |
| User experience | Error messages clear and actionable |
| Recovery completeness | All queued items processed |
| Alerting accuracy | Correct severity and recipients |

---

## 8. Appendix

### 8.1 Configuration Examples

#### DestinationRule Structure (Conceptual)

Each service circuit breaker configuration follows this structure:
- API version and kind identification
- Service selector matching
- Connection pool limits (connections, requests)
- Outlier detection (consecutive errors, interval, base ejection time, max ejection percentage)

#### Degradation Level Configuration Structure

Platform degradation configuration includes:
- Level definitions with numeric severity
- Trigger conditions per level (which circuit states)
- Affected services list
- Alerting rules per level

### 8.2 Glossary

| Term | Definition |
|---|---|
| **Circuit Breaker** | Pattern that detects failures and prevents requests to failing services |
| **CLOSED State** | Normal operation; requests flow through to downstream |
| **OPEN State** | Failure detected; requests fail fast without calling downstream |
| **HALF-OPEN State** | Testing state; limited requests probe downstream health |
| **Failure Threshold** | Number or percentage of failures triggering OPEN state |
| **Recovery Timeout** | Time in OPEN state before transitioning to HALF-OPEN |
| **Outlier Detection** | Istio mechanism for identifying unhealthy endpoints |
| **Ejection** | Removal of unhealthy endpoint from load balancing |
| **Degradation Level** | Platform-wide severity classification of service degradation |
| **Graceful Degradation** | Controlled reduction of functionality during failures |
| **Fallback** | Alternative behavior when primary path unavailable |
| **Blast Radius** | Scope of impact from a failure or test |

### 8.3 Related Documents

| Document | Location |
|---|---|
| Service Mesh Architecture | `/docs/architecture/service-mesh-design.md` |
| Monitoring and Observability | `/docs/operations/monitoring-design.md` |
| Incident Response Runbook | `/docs/operations/incident-response.md` |
| Disaster Recovery Plan | `/docs/operations/disaster-recovery.md` |
| API Gateway Design | `/docs/architecture/api-gateway-design.md` |

### 8.4 Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-10 | Platform Architecture | Initial document |

---

*Document End*
