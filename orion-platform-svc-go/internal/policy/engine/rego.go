package engine

import (
	"errors"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Engine evaluates a Rego policy against an input document.
type Engine struct {
	policy *policy
}

// Compile parses and compiles a Rego policy string.
func Compile(rego string) (*Engine, error) {
	p, err := compile(rego)
	if err != nil {
		return nil, err
	}
	return &Engine{policy: p}, nil
}

// Evaluate runs the compiled policy against the given input and returns a
// document containing all derived rule values plus a boolean "allow" key.
func (e *Engine) Evaluate(input map[string]interface{}) (map[string]interface{}, error) {
	if input == nil {
		input = make(map[string]interface{})
	}
	return e.policy.evaluate(input)
}

// ErrSyntax is returned when the Rego source cannot be parsed.
var ErrSyntax = errors.New("rego syntax error")

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type tok struct {
	typ  string
	val  string
	line int
}

var kw = map[string]bool{
	"true":     true,
	"false":    true,
	"null":     true,
	"and":      true,
	"or":       true,
	"not":      true,
	"contains": true,
	"in":       true,
	"default":  true,
	"package":  true,
	"if":       true,
}

type scanner struct {
	s    []rune
	i    int
	line int
}

func (s *scanner) next() tok {
	for {
		for s.i < len(s.s) && isSpace(s.s[s.i]) {
			if s.s[s.i] == '\n' {
				s.line++
			}
			s.i++
		}
		if s.i >= len(s.s) {
			return tok{typ: "EOF"}
		}
		c := s.s[s.i]
		if c == '#' || (c == '-' && s.i+1 < len(s.s) && s.s[s.i+1] == '-') {
			for s.i < len(s.s) && s.s[s.i] != '\n' {
				s.i++
			}
			_ = s.s // consumed
			continue
		}
		if c == '"' {
			return s.scanStr()
		}
		if c == '=' && s.i+1 < len(s.s) && s.s[s.i+1] == '=' {
			s.i += 2
			return tok{typ: "==", val: "==", line: s.line}
		}
		if c == '!' && s.i+1 < len(s.s) && s.s[s.i+1] == '=' {
			s.i += 2
			return tok{typ: "!=", val: "!=", line: s.line}
		}
		if c == ':' && s.i+1 < len(s.s) && s.s[s.i+1] == '=' {
			s.i += 2
			return tok{typ: ":=", val: ":=", line: s.line}
		}
		if c == '>' && s.i+1 < len(s.s) && s.s[s.i+1] == '=' {
			s.i += 2
			return tok{typ: ">=", val: ">=", line: s.line}
		}
		if c == '<' && s.i+1 < len(s.s) && s.s[s.i+1] == '=' {
			s.i += 2
			return tok{typ: "<=", val: "<=", line: s.line}
		}
		if isDigit(c) {
			return s.scanNum()
		}
		if isIdent(c) {
			return s.scanIdent()
		}
		s.i++
		return tok{typ: string(c), val: string(c), line: s.line}
	}
}

func (s *scanner) scanStr() tok {
	s.i++
	start := s.i
	for s.i < len(s.s) && s.s[s.i] != '"' {
		s.i++
	}
	v := string(s.s[start:s.i])
	if s.i < len(s.s) {
		s.i++
	}
	return tok{typ: "str", val: v, line: s.line}
}

func (s *scanner) scanIdent() tok {
	start := s.i
	for s.i < len(s.s) && (isAlnum(s.s[s.i]) || s.s[s.i] == '_') {
		s.i++
	}
	ident := string(s.s[start:s.i])
	if _, ok := kw[ident]; ok {
		return tok{typ: ident, val: ident, line: s.line}
	}
	return tok{typ: "ident", val: ident, line: s.line}
}

func (s *scanner) scanNum() tok {
	start := s.i
	hasDot := false
	for s.i < len(s.s) {
		c := s.s[s.i]
		if isDigit(c) {
			s.i++
		} else if c == '.' && !hasDot {
			hasDot = true
			s.i++
		} else {
			_ = c
			break
		}
	}
	return tok{typ: "num", val: string(s.s[start:s.i]), line: s.line}
}

func (s *scanner) peek() tok {
	i, line := s.i, s.line
	t := s.next()
	s.i, s.line = i, line
	return t
}

func isIdent(c rune) bool  { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' }
func isAlnum(c rune) bool  { return isIdent(c) || isDigit(c) }
func isDigit(c rune) bool  { return c >= '0' && c <= '9' }
func isSpace(c rune) bool  { return c == ' ' || c == '\t' || c == '\n' || c == '\r' }
func isCompOp(t tok) bool  { return t.typ == "==" || t.typ == "!=" || t.typ == ">" || t.typ == "<" || t.typ == ">=" || t.typ == "<=" }

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

type parser struct {
	s   *scanner
	cur tok
}

func (p *parser) next() { p.cur = p.s.next() }
func (p *parser) peek() tok { return p.s.peek() }

func (p *parser) errf(format string, args ...interface{}) error {
	_ = format
	_ = args
	return ErrSyntax
}

func (p *parser) parse() (*policy, error) {
	p.next()
	if p.cur.typ == "EOF" {
		return emptyPolicy(), nil
	}
	rules := make([]rule, 0)
	for !p.isEOF() {
		if p.cur.typ == "package" {
			p.next()
			for p.cur.typ == "ident" {
				p.next()
			}
			continue
		}
		if p.cur.typ == "default" {
			// skip default X = <value> : consume the identifier and the
			// assignment expression, but stop at the next newline so that
			// following rules are still parsed.
			for {
				t := p.cur.typ
				if t == "ident" || t == "num" || t == "str" || t == "true" || t == "false" || t == "null" {
					p.next()
					continue
				}
				if t == "=" || t == ":=" {
					p.next()
					// consume the expression until the line ends
					for p.cur.typ != "EOF" && p.cur.typ != "ident" {
						p.next()
					}
					break
				}
				if t == "EOF" {
					break
				}
				p.next()
			}
			// skip any trailing tokens on the same logical line
			for p.cur.typ == "." || p.cur.typ == "[" || p.cur.typ == "]" {
				p.next()
			}
			continue
		}
		if p.cur.typ != "ident" {
			p.next()
			continue
		}
		name := p.cur.val
		if _, ok := kw[name]; ok {
			p.next()
			continue
		}
		r, ok := p.parseRule(name)
		if !ok {
			continue
		}
		rules = append(rules, r)
	}
	return &policy{rules: rules}, nil
}

func (p *parser) isEOF() bool { return p.cur.typ == "EOF" }

func (p *parser) parseRule(name string) (rule, bool) {
	p.next()
	// consume dotted continuation e.g. allow[msg]
	for p.cur.typ == "." {
		p.next()
		if p.cur.typ == "[" {
			p.next()
			p.expr()
			for p.cur.typ != "]" && !p.isEOF() {
				p.next()
			}
			if p.cur.typ == "]" {
				p.next()
			}
		}
	}
	for p.cur.typ == ":" {
		p.next()
	}
	if p.cur.typ != "=" && p.cur.typ != ":=" {
		return rule{}, false
	}
	p.next()

	// In Rego, rules come in two shapes:
	//   allow = true           (value expression becomes the body)
	//   allow = true if X      (the `if X` clause is the body; `true` is just the result)
	//
	// Peek ahead to see whether an `if` follows; if so, skip over the result value
	// and parse the condition as the rule body.
	var body expr
	if p.cur.typ == "if" {
		p.next()
		body = p.parseOr()
	} else if p.peek().typ == "if" {
		// There is a value expression between `=` and `if`. Skip it.
		p.parseComp()
		// consume the `if` keyword
		p.next()
		body = p.parseOr()
	} else {
		// Plain assignment: `name = expr` with no `if` clause.
		body = p.parseComp()
	}
	return rule{name: name, body: body}, true
}

func (p *parser) expr() { p.parseOr() }

func (p *parser) parsePath() expr {
	if p.cur.typ == "ident" && p.cur.val == "input" {
		p.next()
		if p.cur.typ == "." {
			p.next()
			if p.cur.typ == "ident" {
				key := p.cur.val
				p.next()
				return dotExpr{key: key}
			}
		}
		return inputExpr{}
	}
	if p.cur.typ == "num" {
		f, _ := strconv.ParseFloat(p.cur.val, 64)
		p.next()
		return numExpr{v: f}
	}
	if p.cur.typ == "str" {
		v := p.cur.val
		p.next()
		return strExpr{v: v}
	}
	if p.cur.typ == "true" {
		p.next()
		return boolExpr{v: true}
	}
	if p.cur.typ == "false" {
		p.next()
		return boolExpr{v: false}
	}
	if p.cur.typ == "null" {
		p.next()
		return nilExpr{}
	}
	if p.cur.typ == "ident" {
		fn := p.cur.val
		p.next()
		if p.cur.typ == "(" {
			p.next()
			var args []expr
			if p.cur.typ != ")" {
				args = append(args, p.parseAtom())
				for p.cur.typ == "," {
					p.next()
					args = append(args, p.parseAtom())
				}
			}
			if p.cur.typ != ")" {
				return nilLit{}
			}
			p.next()
			return fnExpr{name: fn, args: args}
		}
		return varExpr{name: fn}
	}
	if p.cur.typ == "[" {
		return p.parseArray()
	}
	return nilLit{}
}

func (p *parser) parseArray() expr {
	p.next()
	var elems []expr
	for p.cur.typ != "]" && !p.isEOF() {
		elems = append(elems, p.parseAtom())
		if p.cur.typ == "," {
			p.next()
		}
	}
	if p.cur.typ == "]" {
		p.next()
	}
	return arrayExpr{elems: elems}
}

func (p *parser) parseComp() expr {
	left := p.parsePath()
	for p.cur.typ == "." && p.isIdent() {
		p.next()
		method := p.cur.val
		p.next()
		if p.cur.typ != "(" {
			break
		}
		p.next()
		var args []expr
		if p.cur.typ != ")" {
			args = append(args, p.parseAtom())
			for p.cur.typ == "," {
				p.next()
				args = append(args, p.parseAtom())
			}
		}
		if p.cur.typ != ")" {
			break
		}
		p.next()
		left = methodExpr{target: left, method: method, args: args}
	}
	if p.cur.typ == "contains" {
		p.next()
		right := p.parseAtom()
		return containsExpr{left: left, right: right}
	}
	if p.cur.typ == "in" {
		p.next()
		right := p.parseAtom()
		return inExpr{left: left, right: right}
	}
	if isCompOp(p.cur) {
		op := p.cur.val
		p.next()
		right := p.parseAtom()
		return cmpExpr{op: op, left: left, right: right}
	}
	return truthyExpr{inner: left}
}

func (p *parser) parseAtom() expr { return p.parsePath() }

func (p *parser) parseOr() expr {
	left := p.parseAnd()
	for p.cur.typ == "or" {
		p.next()
		right := p.parseAnd()
		left = orExpr{left: left, right: right}
	}
	return left
}

func (p *parser) parseAnd() expr {
	e := p.parseNot()
	for p.cur.typ == "and" {
		p.next()
		right := p.parseNot()
		e = andExpr{left: e, right: right}
	}
	return e
}

func (p *parser) parseNot() expr {
	if p.cur.typ == "not" {
		p.next()
		return notExpr{inner: p.parseNot()}
	}
	if p.cur.typ == "(" {
		p.next()
		e := p.parseOr()
		if p.cur.typ != ")" {
			return boolExpr{v: false}
		}
		p.next()
		return e
	}
	return p.parseComp()
}

func (p *parser) isIdent() bool {
	pt := p.peek()
	return pt.typ == "ident"
}

// ---------------------------------------------------------------------------
// Expression tree
// ---------------------------------------------------------------------------

type expr interface {
	eval(ctx *ctx) bool
	val(ctx *ctx) interface{}
}

type ctx struct{ input map[string]interface{} }

// ---- leaves ----

type boolExpr struct{ v bool }
func (e boolExpr) eval(_ *ctx) bool { return e.v }
func (e boolExpr) val(_ *ctx) interface{} { return e.v }

type numExpr struct{ v float64 }
func (e numExpr) eval(_ *ctx) bool { return e.v != 0 }
func (e numExpr) val(_ *ctx) interface{} { return e.v }

type strExpr struct{ v string }
func (e strExpr) eval(_ *ctx) bool { return e.v != "" }
func (e strExpr) val(_ *ctx) interface{} { return e.v }

type nilExpr struct{}
func (nilExpr) eval(_ *ctx) bool { return false }
func (nilExpr) val(_ *ctx) interface{} { return nil }

type nilLit struct{}
func (nilLit) eval(_ *ctx) bool { return false }
func (nilLit) val(_ *ctx) interface{} { return nil }

type inputExpr struct{}
func (inputExpr) eval(_ *ctx) bool { return true }
func (inputExpr) val(ctx *ctx) interface{} { return ctx.input }

type dotExpr struct{ key string }
func (e dotExpr) eval(_ *ctx) bool { return true }
func (e dotExpr) val(ctx *ctx) interface{} {
	if ctx.input == nil {
		return nil
	}
	return ctx.input[e.key]
}

type varExpr struct{ name string }
func (varExpr) eval(_ *ctx) bool { return false }
func (varExpr) val(_ *ctx) interface{} { return nil }

type arrayExpr struct{ elems []expr }
func (e arrayExpr) eval(_ *ctx) bool { return true }
func (e arrayExpr) val(c *ctx) interface{} {
	v := make([]interface{}, len(e.elems))
	for i, e := range e.elems {
		v[i] = e.val(c)
	}
	return v
}

// ---- compound boolean ----

type truthyExpr struct{ inner expr }
func (e truthyExpr) eval(ctx *ctx) bool { return isTruthy(e.inner.val(ctx)) }
func (e truthyExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

type andExpr struct{ left, right expr }
func (e andExpr) eval(ctx *ctx) bool { return e.left.eval(ctx) && e.right.eval(ctx) }
func (e andExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

type orExpr struct{ left, right expr }
func (e orExpr) eval(ctx *ctx) bool { return e.left.eval(ctx) || e.right.eval(ctx) }
func (e orExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

type notExpr struct{ inner expr }
func (e notExpr) eval(ctx *ctx) bool { return !e.inner.eval(ctx) }
func (e notExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

// ---- comparison ----

type cmpExpr struct {
	op    string
	left  expr
	right expr
}

func (e cmpExpr) eval(ctx *ctx) bool {
	lv := e.left.val(ctx)
	rv := e.right.val(ctx)
	lv, lk := normalise(lv)
	rv, rk := normalise(rv)
	switch e.op {
	case "==":
		return eq(lv, rv, lk, rk)
	case "!=":
		return !eq(lv, rv, lk, rk)
	case ">":
		if lk == kindNum && rk == kindNum {
			return asFloat(lv) > asFloat(rv)
		}
		return false
	case ">=":
		if lk == kindNum && rk == kindNum {
			return asFloat(lv) >= asFloat(rv)
		}
		return false
	case "<":
		if lk == kindNum && rk == kindNum {
			return asFloat(lv) < asFloat(rv)
		}
		return false
	case "<=":
		if lk == kindNum && rk == kindNum {
			return asFloat(lv) <= asFloat(rv)
		}
		return false
	}
	return false
}

func (e cmpExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

// ---- contains ----

type containsExpr struct{ left, right expr }
func (e containsExpr) eval(ctx *ctx) bool {
	lv, ok := e.left.val(ctx).(string)
	rv, ok2 := e.right.val(ctx).(string)
	if !ok || !ok2 {
		return false
	}
	return strings.Contains(lv, rv)
}
func (e containsExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

// ---- in ----

type inExpr struct{ left, right expr }
func (e inExpr) eval(ctx *ctx) bool {
	lv := e.left.val(ctx)
	rv := e.right.val(ctx)
	rk := kindValue(rv)
	ak := kindValue(lv)
	switch arr := rv.(type) {
	case []interface{}:
		for _, elem := range arr {
			if eq(lv, elem, ak, kindValue(elem)) {
				return true
			}
		}
	case []string:
		for _, elem := range arr {
			if eq(lv, elem, ak, kindValue(elem)) {
				return true
			}
		}
		_ = rk
	}
	return false
}
func (e inExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

// ---- functions ----

type fnExpr struct {
	name string
	args []expr
}

func (e fnExpr) eval(ctx *ctx) bool { return isTruthy(e.val(ctx)) }
func (e fnExpr) val(ctx *ctx) interface{} {
	vals := make([]interface{}, len(e.args))
	for i, a := range e.args {
		vals[i] = a.val(ctx)
	}
	switch e.name {
	case "len":
		if len(vals) == 0 {
			return float64(0)
		}
		if s, ok := vals[0].(string); ok {
			return float64(len(s))
		}
		if arr, ok := vals[0].([]interface{}); ok {
			return float64(len(arr))
		}
		if m, ok := vals[0].(map[string]interface{}); ok {
			return float64(len(m))
		}
		return float64(0)
	}
	return true
}

// ---- method calls on strings ----

type methodExpr struct {
	target expr
	method string
	args   []expr
}

func (e methodExpr) eval(ctx *ctx) bool {
	tv := e.target.val(ctx)
	s, ok := tv.(string)
	if !ok {
		return false
	}
	var arg string
	for _, a := range e.args {
		if v, ok := a.val(ctx).(string); ok {
			arg = v
			break
		}
	}
	switch e.method {
	case "startswith":
		return strings.HasPrefix(s, arg)
	case "endswith":
		return strings.HasSuffix(s, arg)
	case "contains":
		return strings.Contains(s, arg)
	}
	return false
}
func (e methodExpr) val(ctx *ctx) interface{} { return e.eval(ctx) }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func asFloat(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	}
	return 0
}

type kind int
const (
	kindStr kind = iota
	kindNum
	kindBool
	kindNil
)

func kindValue(v interface{}) kind {
	if v == nil {
		return kindNil
	}
	switch v.(type) {
	case string:
		return kindStr
	case float64, int, int64:
		return kindNum
	case bool:
		return kindBool
	}
	return kindNil
}

func normalise(v interface{}) (interface{}, kind) {
	if v == nil {
		return nil, kindNil
	}
	switch t := v.(type) {
	case string:
		if f, err := strconv.ParseFloat(t, 64); err == nil {
			return f, kindNum
		}
		return t, kindStr
	case float64:
		return t, kindNum
	case int:
		return float64(t), kindNum
	case int64:
		return float64(t), kindNum
	case bool:
		if t {
			return float64(1), kindNum
		}
		return float64(0), kindNum
	}
	return v, kindNil
}

func eq(a, b interface{}, ak, bk kind) bool {
	if ak == kindNil && bk == kindNil {
		return true
	}
	if ak == kindNil || bk == kindNil {
		return false
	}
	if ak == kindNum && bk == kindNum {
		av, ok := a.(float64)
		bv, ok2 := b.(float64)
		if ok && ok2 {
			return av == bv
		}
	}
	if ak == kindStr && bk == kindStr {
		return a.(string) == b.(string)
	}
	if ak == kindBool && bk == kindBool {
		return a.(bool) == b.(bool)
	}
	return false
}

func isTruthy(v interface{}) bool {
	if v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t != ""
	case float64:
		return t != 0
	_ = t
	case []interface{}:
		return len(t) > 0
	case map[string]interface{}:
		return len(t) > 0
	}
	return true
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

type policy struct{ rules []rule }
type rule struct {
	name string
	body expr
}

func emptyPolicy() *policy {
	return &policy{rules: []rule{{name: "allow", body: boolExpr{v: false}}}}
}

func (p policy) evaluate(input map[string]interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	for _, r := range p.rules {
		result[r.name] = r.body.eval(&ctx{input: input})
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

func compile(rego string) (*policy, error) {
	if strings.TrimSpace(rego) == "" {
		return emptyPolicy(), nil
	}
	p := &parser{s: &scanner{s: []rune(rego), line: 1}}
	return p.parse()
}
