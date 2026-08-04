package alertruleengine

import (
	"fmt"
	"strconv"
	"strings"
)

// TokenType represents the type of a lexical token.
type TokenType int

const (
	TokEOF TokenType = iota
	TokIdent       // metric name
	TokNumber      // numeric literal
	TokString      // string literal (for labels)
	TokCompare     // > < >= <= == !=
	TokAnd
	TokOr
	TokLParen      // (
	TokRParen      // )
	TokComma       // ,
	TokLBrace      // {
	TokRBrace      // }
	TokDot         // .
)

func (t TokenType) String() string {
	switch t {
	case TokEOF:
		return "EOF"
	case TokIdent:
		return "IDENT"
	case TokNumber:
		return "NUMBER"
	case TokString:
		return "STRING"
	case TokCompare:
		return "COMPARE"
	case TokAnd:
		return "AND"
	case TokOr:
		return "OR"
	case TokLParen:
		return "("
	case TokRParen:
		return ")"
	case TokComma:
		return ","
	case TokLBrace:
		return "{"
	case TokRBrace:
		return "}"
	case TokDot:
		return "."
	default:
		return fmt.Sprintf("unknown(%d)", t)
	}
}

// Token holds a single lexical token.
type Token struct {
	Type  TokenType
	Value string
}

// --- Expression AST ---

// Expr is the root of an expression tree.
type Expr interface {
	Eval(ctx EvalContext) (float64, bool, error)
}

// EvalContext provides metric values and time-series data for evaluation.
type EvalContext struct {
	// Metrics holds instantaneous metric values: metricName -> value.
	Metrics map[string]float64
	// Series holds time-series data for time-window queries.
	Series map[string][]float64
	// Labels holds label sets: metricName -> map[labelKey]labelValue.
	Labels map[string]map[string]string
}

// BoolExpr is the root node; it always evaluates to a boolean.
type BoolExpr struct {
	inner Expr
}

func (e *BoolExpr) Eval(ctx EvalContext) (float64, bool, error) {
	val, ok, err := e.inner.Eval(ctx)
	if err != nil {
		return 0, false, err
	}
	return val, ok, nil
}

// ComparisonExpr represents: primary COMPARE value.
type ComparisonExpr struct {
	Operator  string // ">", "<", ">=", "<=", "==", "!="
	Left      Expr
	Threshold float64
}

func (e *ComparisonExpr) Eval(ctx EvalContext) (float64, bool, error) {
	val, ok, err := e.Left.Eval(ctx)
	if err != nil {
		return 0, false, err
	}
	if !ok {
		return 0, false, nil // metric not available -> not matching
	}
	result := e.compareOp(val, e.Operator, e.Threshold)
	return val, result, nil
}

func (e *ComparisonExpr) compareOp(v float64, op string, t float64) bool {
	switch op {
	case ">":
		return v > t
	case "<":
		return v < t
	case ">=":
		return v >= t
	case "<=":
		return v <= t
	case "==":
		return v == t
	case "!=":
		return v != t
	}
	return false
}

// LogicalExpr represents: left AND right  or  left OR right.
type LogicalExpr struct {
	Operator string // "&&" or "||"
	Left     Expr
	Right    Expr
}

func (e *LogicalExpr) Eval(ctx EvalContext) (float64, bool, error) {
	_, leftOk, err := e.Left.Eval(ctx)
	if err != nil {
		return 0, false, err
	}
	switch e.Operator {
	case "&&":
		if !leftOk {
			return 0, false, nil // short-circuit AND
		}
		_, rightOk, err := e.Right.Eval(ctx)
		return 0, rightOk, err
	case "||":
		if leftOk {
			return 0, true, nil // short-circuit OR
		}
		_, rightOk, err := e.Right.Eval(ctx)
		return 0, rightOk, err
	}
	return 0, false, fmt.Errorf("unknown logical operator: %s", e.Operator)
}

// IdentifierExpr represents a plain metric name.
type IdentifierExpr struct {
	Name   string
	Labels map[string]string // optional label matchers
}

func (e *IdentifierExpr) Eval(ctx EvalContext) (float64, bool, error) {
	// Check label matchers first
	if len(e.Labels) > 0 {
		metaLabels, ok := ctx.Labels[e.Name]
		if !ok {
			return 0, false, nil
		}
		for k, v := range e.Labels {
			if metaLabels[k] != v {
				return 0, false, nil // labels don't match
			}
		}
	}
	val, ok := ctx.Metrics[e.Name]
	if !ok {
		// Check if label-matched metric exists with matching labels
		if len(e.Labels) > 0 && ctx.Labels[e.Name] != nil {
			return 0, false, nil
		}
		return 0, false, nil
	}
	return val, true, nil
}

// AggFuncExpr represents: avg(metric), max(metric), min(metric), sum(metric).
type AggFuncExpr struct {
	FuncName  string // "avg", "max", "min", "sum"
	Argument  Expr
	Labels    map[string]string // optional label matchers
}

func (e *AggFuncExpr) Eval(ctx EvalContext) (float64, bool, error) {
	var vals []float64
	switch arg := e.Argument.(type) {
	case *IdentifierExpr:
		name := arg.Name
		if len(e.Labels) > 0 {
			// Filter by labels
			metaLabels, ok := ctx.Labels[name]
			if !ok {
				return 0, false, nil
			}
			for k, v := range e.Labels {
				if metaLabels[k] != v {
					return 0, false, nil
				}
			}
			val, ok := ctx.Metrics[name]
			if ok {
				vals = append(vals, val)
			}
			return e.applyFunc(vals), len(vals) > 0, nil
		}
		// Collect all metrics whose name starts with the given prefix
		for metricName, v := range ctx.Metrics {
			if metricName == name || strings.HasPrefix(metricName, name+"_") {
				vals = append(vals, v)
			}
		}
	case *LabeledExpr:
		name := arg.Name
		// Collect all metrics with matching labels
		for metricName, v := range ctx.Metrics {
			metaLabels, ok := ctx.Labels[metricName]
			if !ok {
				continue
			}
			matched := true
			for k, v := range arg.Labels {
				if metaLabels[k] != v {
					matched = false
					break
				}
			}
			if matched {
				if name == "" || metricName == name {
					vals = append(vals, v)
				}
			}
		}
	default:
		// Fallback: evaluate the argument and use its single value
		v, ok, err := e.Argument.Eval(ctx)
		if err != nil {
			return 0, false, err
		}
		if ok {
			vals = append(vals, v)
		}
	}
	return e.applyFunc(vals), len(vals) > 0, nil
}

func (e *AggFuncExpr) applyFunc(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	switch e.FuncName {
	case "sum":
		var s float64
		for _, v := range vals {
			s += v
		}
		return s
	case "avg":
		var s float64
		for _, v := range vals {
			s += v
		}
		return s / float64(len(vals))
	case "max":
		m := vals[0]
		for _, v := range vals[1:] {
			if v > m {
				m = v
			}
		}
		return m
	case "min":
		m := vals[0]
		for _, v := range vals[1:] {
			if v < m {
				m = v
			}
		}
		return m
	}
	return vals[0]
}

// WindowExpr represents: metric.last(duration) — returns the last N values'
// average over the series.
type WindowExpr struct {
	Name    string
	Labels  map[string]string
	Duration int // window size in data points (derived from duration string)
}

func (e *WindowExpr) Eval(ctx EvalContext) (float64, bool, error) {
	series := ctx.Series[e.Name]
	if len(series) == 0 {
		return 0, false, nil
	}
	// Apply label filtering if present
	if len(e.Labels) > 0 {
		metaLabels, ok := ctx.Labels[e.Name]
		if !ok {
			return 0, false, nil
		}
		for k, v := range e.Labels {
			if metaLabels[k] != v {
				return 0, false, nil
			}
		}
	}
	// Take the last `Duration` points (or all if fewer available)
	n := e.Duration
	if n <= 0 {
		n = len(series)
	}
	if n > len(series) {
		n = len(series)
	}
	window := series[len(series)-n:]
	var sum float64
	for _, v := range window {
		sum += v
	}
	return sum / float64(len(window)), true, nil
}

// LabeledExpr represents: metric{label="value"}
type LabeledExpr struct {
	Name   string
	Labels map[string]string
}

func (e *LabeledExpr) Eval(ctx EvalContext) (float64, bool, error) {
	// Check label matchers
	metaLabels, ok := ctx.Labels[e.Name]
	if !ok {
		return 0, false, nil
	}
	for k, v := range e.Labels {
		if metaLabels[k] != v {
			return 0, false, nil
		}
	}
	val, ok := ctx.Metrics[e.Name]
	return val, ok, nil
}

// --- Lexer ---

type Lexer struct {
	input   string
	pos     int
	ch      byte
}

func NewLexer(input string) *Lexer {
	l := &Lexer{input: input}
	l.next()
	return l
}

func (l *Lexer) next() {
	if l.pos >= len(l.input) {
		l.ch = 0
		return
	}
	l.ch = l.input[l.pos]
	l.pos++
}

func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\n' || l.ch == '\r' {
		l.next()
	}
}

func (l *Lexer) Scan() Token {
	l.skipWhitespace()
	if l.ch == 0 {
		return Token{Type: TokEOF}
	}

	switch l.ch {
	case '(':
		l.next()
		return Token{Type: TokLParen, Value: "("}
	case ')':
		l.next()
		return Token{Type: TokRParen, Value: ")"}
	case ',':
		l.next()
		return Token{Type: TokComma, Value: ","}
	case '{':
		l.next()
		return Token{Type: TokLBrace, Value: "{"}
	case '}':
		l.next()
		return Token{Type: TokRBrace, Value: "}"}
	case '.':
		l.next()
		return Token{Type: TokDot, Value: "."}
	case '&':
		if l.pos < len(l.input) && l.input[l.pos] == '&' {
			l.next(); l.next()
			return Token{Type: TokAnd, Value: "&&"}
		}
		l.next()
		return Token{Type: TokAnd, Value: "&"}
	case '|':
		if l.pos < len(l.input) && l.input[l.pos] == '|' {
			l.next(); l.next()
			return Token{Type: TokOr, Value: "||"}
		}
		l.next()
		return Token{Type: TokOr, Value: "|"}
	case '>':
		if l.pos < len(l.input) && l.input[l.pos] == '=' {
			l.next(); l.next()
			return Token{Type: TokCompare, Value: ">="}
		}
		l.next()
		return Token{Type: TokCompare, Value: ">"}
	case '<':
		if l.pos < len(l.input) && l.input[l.pos] == '=' {
			l.next(); l.next()
			return Token{Type: TokCompare, Value: "<="}
		}
		l.next()
		return Token{Type: TokCompare, Value: "<"}
	case '=':
		if l.pos < len(l.input) && l.input[l.pos] == '=' {
			l.next(); l.next()
			return Token{Type: TokCompare, Value: "=="}
		}
		
		l.next()
		return Token{Type: TokIdent, Value: "="}
	case '!':
		if l.pos < len(l.input) && l.input[l.pos] == '=' {
			l.next(); l.next()
			return Token{Type: TokCompare, Value: "!="}
		}
		return Token{Type: TokCompare, Value: string(l.ch)}
	case '"':
		return l.scanString()
	}

	// Identifiers and keywords
	if isAlpha(l.ch) || l.ch == '_' {
		return l.scanIdent()
	}

	// Numbers
	if isDigit(l.ch) {
		return l.scanNumber()
	}

	return Token{Type: TokEOF, Value: string(l.ch)}
}

func (l *Lexer) scanIdent() Token {
	start := l.pos - 1
	for isAlpha(l.ch) || isDigit(l.ch) || l.ch == '_' {
		l.next()
	}
	word := l.input[start:l.pos-1]

	switch word {
	case "&&":
		return Token{Type: TokAnd, Value: "&&"}
	case "||":
		return Token{Type: TokOr, Value: "||"}
	case "and":
		return Token{Type: TokAnd, Value: "&&"}
	case "or":
		return Token{Type: TokOr, Value: "||"}
	case "avg":
		return Token{Type: TokIdent, Value: "avg"}
	case "max":
		return Token{Type: TokIdent, Value: "max"}
	case "min":
		return Token{Type: TokIdent, Value: "min"}
	case "sum":
		return Token{Type: TokIdent, Value: "sum"}
	case "last":
		return Token{Type: TokIdent, Value: "last"}
	}
	return Token{Type: TokIdent, Value: word}
}

func (l *Lexer) scanNumber() Token {
	var buf strings.Builder
	for isDigit(l.ch) || l.ch == '.' {
		buf.WriteByte(l.ch)
		l.next()
	}
	return Token{Type: TokNumber, Value: buf.String()}
}

func (l *Lexer) scanString() Token {
	l.next() // consume opening quote
	var buf strings.Builder
	for l.ch != '"' && l.ch != 0 {
		buf.WriteByte(l.ch)
		l.next()
	}
	if l.ch == '"' {
		l.next() // consume closing quote
	}
	return Token{Type: TokString, Value: buf.String()}
}

func isAlpha(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isDigit(c byte) bool {
	return c >= '0' && c <= '9'
}

// --- Parser ---

// Parser builds an expression AST from tokens produced by the Lexer.
type Parser struct {
	lex     *Lexer
	cur     Token
	peek    Token
}

func NewParser(input string) *Parser {
	lex := NewLexer(input)
	p := &Parser{lex: lex}
	p.cur = lex.Scan()
	p.peek = lex.Scan()
	return p
}

func (p *Parser) advance() {
	p.cur = p.peek
	p.peek = p.lex.Scan()
}

func (p *Parser) expect(t TokenType, msg string) error {
	if p.cur.Type != t {
		return fmt.Errorf("%s: expected %s, got %s (%q)", msg, t, p.cur.Type, p.cur.Value)
	}
	return nil
}

// Parse returns the root BoolExpr or an error.
func (p *Parser) Parse() (*BoolExpr, error) {
	expr, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if p.cur.Type != TokEOF {
		return nil, fmt.Errorf("unexpected token: %s (%q)", p.cur.Type, p.cur.Value)
	}
	return &BoolExpr{inner: expr}, nil
}

// Or: Expr && Expr
func (p *Parser) parseOr() (Expr, error) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	for p.cur.Type == TokOr {
		p.advance()
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		left = &LogicalExpr{Operator: "||", Left: left, Right: right}
	}
	return left, nil
}

// And: Or || Or
func (p *Parser) parseAnd() (Expr, error) {
	left, err := p.parseCompare()
	if err != nil {
		return nil, err
	}
	for p.cur.Type == TokAnd {
		p.advance()
		right, err := p.parseCompare()
		if err != nil {
			return nil, err
		}
		left = &LogicalExpr{Operator: "&&", Left: left, Right: right}
	}
	return left, nil
}

// Compare: Primary CMP Number
func (p *Parser) parseCompare() (Expr, error) {
	primary, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	if p.cur.Type != TokCompare {
		return primary, nil // allow plain primary (e.g. standalone metric)
	}
	op := p.cur.Value
	p.advance()
	if p.cur.Type != TokNumber {
		return nil, fmt.Errorf("expected number after operator %q, got %s", op, p.cur.Type)
	}
	threshold, err := strconv.ParseFloat(p.cur.Value, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid threshold %q: %w", p.cur.Value, err)
	}
	p.advance()
	return &ComparisonExpr{Operator: op, Left: primary, Threshold: threshold}, nil
}

// Primary: Ident | AggFunc | Window | Labeled | (Expr)
func (p *Parser) parsePrimary() (Expr, error) {
	switch p.cur.Type {
	case TokLParen:
		p.advance()
		expr, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		if err := p.expect(TokRParen, "parenthesis"); err != nil {
			return nil, err
		}
		p.advance()
		return expr, nil
	case TokIdent:
		name := p.cur.Value
		p.advance()
		return p.parsePostfix(name, nil)
	default:
		return nil, fmt.Errorf("unexpected token: %s (%q)", p.cur.Type, p.cur.Value)
	}
}

// parsePostfix handles: ident{...}, ident(...), ident.last(...), ident{...}.last(...)
func (p *Parser) parsePostfix(name string, labels map[string]string) (Expr, error) {
	// Check for label matchers: { key = "value", ... }
	if p.cur.Type == TokLBrace {
		labels = make(map[string]string)
		p.advance()
		for p.cur.Type != TokRBrace {
			if p.cur.Type != TokIdent {
				return nil, fmt.Errorf("expected identifier in label matcher, got %s", p.cur.Type)
			}
			key := p.cur.Value
			p.advance()
			eqFound := false
			if p.cur.Type == TokIdent && p.cur.Value == "=" {
				p.advance()
				eqFound = true
			} else if p.cur.Type == TokCompare && p.cur.Value == "==" {
				p.advance()
				eqFound = true
			}
			if !eqFound {
				return nil, fmt.Errorf("expected = or == in label matcher, got %s", p.cur.Type)
			}
			if p.cur.Type == TokString {
				labels[key] = p.cur.Value
			} else if p.cur.Type == TokIdent {
				labels[key] = p.cur.Value
			} else {
				return nil, fmt.Errorf("expected value in label matcher, got %s", p.cur.Type)
			}
			p.advance()
			if p.cur.Type == TokComma {
				p.advance()
			}
		}
		p.advance() // consume }
	}

	// Check for function call: last(5m), last(1h)  or agg(avg), etc.
	if p.cur.Type == TokLParen {
		p.advance()
		// Parse duration or bare argument
		arg := p.cur.Value
		if p.cur.Type == TokIdent || p.cur.Type == TokNumber {
			p.advance()
		}
		// Optional: handle comma-separated list for future extension
		for p.cur.Type == TokComma {
			p.advance()
			p.advance() // skip arg
		}
		if err := p.expect(TokRParen, "function call"); err != nil {
			return nil, err
		}
		p.advance()

		switch name {
		case "avg", "max", "min", "sum":
			return &AggFuncExpr{FuncName: name, Argument: &IdentifierExpr{Name: arg}, Labels: labels}, nil
		case "last":
			window, err := parseDuration(arg)
			if err != nil {
				return nil, fmt.Errorf("invalid duration %q in last(): %w", arg, err)
			}
			expr := &WindowExpr{Name: "", Duration: window, Labels: labels}
			// If name is not empty and not a known function, it's the metric name
			if name != "" && name != "last" {
				expr.Name = name
			}
			return expr, nil
		}
		return &IdentifierExpr{Name: name, Labels: labels}, nil
	}

	if name == "avg" || name == "max" || name == "min" || name == "sum" {
		// Standalone agg without explicit call
		return &AggFuncExpr{FuncName: name, Argument: &IdentifierExpr{}}, nil
	}

	// Handle dot notation for method-style calls: metric.last(5m)
	if p.cur.Type == TokDot {
		p.advance() // consume .
		if p.cur.Type != TokIdent {
			return nil, fmt.Errorf("expected identifier after '.', got %s", p.cur.Type)
		}
		method := p.cur.Value
		p.advance()

		if p.cur.Type == TokLParen {
			p.advance()
			arg := p.cur.Value
			if p.cur.Type == TokIdent || p.cur.Type == TokNumber {
				p.advance()
			}
			// Handle bare duration like 5m: number followed by identifier unit
			// (e.g. "5" then "m" — the "m" was consumed as arg, so rebuild the full string)
			if p.cur.Type == TokIdent {
				arg = arg + p.cur.Value
				p.advance()
			}
			if err := p.expect(TokRParen, "method call"); err != nil {
				return nil, err
			}
			p.advance()

			if method == "last" {
				window, err := parseDuration(arg)
				if err != nil {
					return nil, fmt.Errorf("invalid duration %q in last(): %w", arg, err)
				}
				return &WindowExpr{Name: name, Duration: window, Labels: labels}, nil
			}
			return nil, fmt.Errorf("unknown method %q on metric %q", method, name)
		}
		return nil, fmt.Errorf("unexpected token after '%s.%s'", name, method)
	}

	return &IdentifierExpr{Name: name, Labels: labels}, nil
}

// parseDuration converts a duration string like "5m", "1h", "30s", "10" to a window size.
func parseDuration(s string) (int, error) {
	s = strings.TrimRight(s, " )")
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty duration")
	}
	var n float64
	i := 0
	for i < len(s) && isDigit(byte(s[i])) {
		i++
	}
	if i == 0 {
		return 0, fmt.Errorf("no numeric part in duration %q", s)
	}
	unitStr := s[i:]
	var multiplier float64
	switch unitStr {
	case "s", "sec", "second":
		multiplier = 1
	case "m", "min", "minute":
		multiplier = 60
	case "h", "hour":
		multiplier = 3600
	case "d", "day":
		multiplier = 86400
	case "":
		multiplier = 1 // bare number = data points
	default:
		return 0, fmt.Errorf("unknown duration unit %q", unitStr)
	}
	n, err := strconv.ParseFloat(s[:i], 64)
	if err != nil {
		return 0, err
	}
	window := int(n * multiplier)
	// Map to a reasonable number of data points (assume 1 per second for now)
	// But if it's already a small number (seconds), keep as-is
	if unitStr == "" {
		window = int(n)
	}
	if window <= 0 {
		window = 1
	}
	return window, nil
}

// ParseExpression is the public entry point: parses an expression string into
// a BoolExpr tree.
func ParseExpression(input string) (*BoolExpr, error) {
	p := NewParser(input)
	return p.Parse()
}
