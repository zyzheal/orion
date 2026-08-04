package alertruleengine

import (
	"fmt"
)

// MetricSnapshot represents a point-in-time view of available metrics.
type MetricSnapshot struct {
	// Values maps metric name -> instantaneous value.
	Values map[string]float64
	// Series maps metric name -> historical time series (oldest first).
	Series map[string][]float64
	// Labels maps metric name -> label key-value pairs.
	Labels map[string]map[string]string
}

// SnapshotBuilder is a convenience helper for constructing MetricSnapshot.
type SnapshotBuilder struct {
	snapshot MetricSnapshot
}

func NewSnapshotBuilder() *SnapshotBuilder {
	return &SnapshotBuilder{
		snapshot: MetricSnapshot{
			Values: make(map[string]float64),
			Series: make(map[string][]float64),
			Labels: make(map[string]map[string]string),
		},
	}
}

func (b *SnapshotBuilder) AddMetric(name string, value float64) *SnapshotBuilder {
	b.snapshot.Values[name] = value
	return b
}

func (b *SnapshotBuilder) AddSeries(name string, values []float64) *SnapshotBuilder {
	b.snapshot.Series[name] = append([]float64{}, values...)
	return b
}

func (b *SnapshotBuilder) AddLabels(name string, labels map[string]string) *SnapshotBuilder {
	b.snapshot.Labels[name] = labels
	return b
}

func (b *SnapshotBuilder) Build() *MetricSnapshot {
	s := b.snapshot
	return &s
}

// Evaluator evaluates expression trees against a MetricSnapshot.
type Evaluator struct {
	snapshot *MetricSnapshot
}

// NewEvaluator creates an evaluator for a given snapshot.
func NewEvaluator(snapshot *MetricSnapshot) *Evaluator {
	return &Evaluator{snapshot: snapshot}
}

// Evaluate evaluates an expression against the snapshot.
// Returns (value, ok, error) where:
//   - value: the numeric result of the expression
//   - ok: true if the expression evaluated successfully
//   - error: any parse/runtime error
func (e *Evaluator) Evaluate(expr Expr) (float64, bool, error) {
	if expr == nil {
		return 0, false, fmt.Errorf("expression is nil")
	}
	ctx := EvalContext{
		Metrics: e.snapshot.Values,
		Series:  e.snapshot.Series,
		Labels:  e.snapshot.Labels,
	}
	return expr.Eval(ctx)
}

// EvaluateString parses an expression string and evaluates it.
func (e *Evaluator) EvaluateString(exprStr string) (float64, bool, error) {
	expr, err := ParseExpression(exprStr)
	if err != nil {
		return 0, false, fmt.Errorf("parse error: %w", err)
	}
	return e.Evaluate(expr)
}
