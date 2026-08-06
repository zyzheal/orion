package executor

import (
	"fmt"
	"strconv"
	"strings"
)

// evalExpression evaluates a simple condition expression against the execution context variables.
// Supported syntax:
//   - Comparison: value1 OP value2  (OP: == != > < >= <=)
//   - Logical:    expr && expr, expr || expr
//   - Negation:   !expr
//   - Parentheses: (expr)
//   - Value sources: "quoted string", numeric literals, variable references prefixed with $
//
// Example: '$status == "passed" && $count > 3'

func evalExpression(expr string, ctx *ExecutionCtx) (bool, error) {
	return evalExpressionAST(expr, ctx)
}

// --- Tokenizer ---

type tokenKind int

const (
	kindIdent  tokenKind = iota // number, bool, $var, bare string
	kindString                  // "quoted"
	kindOp                       // == != > < >= <=
	kindLAnd                     // &&
	kindLOr                      // ||
	kindNot                      // !
	kindLParen                   // (
	kindRParen                   // )
	kindEOF                      // end
)

type token struct {
	kind tokenKind
	val  string
}

func tokenize(expr string) ([]*token, error) {
	var tokens []*token
	i := 0
	for i < len(expr) {
		if expr[i] == ' ' || expr[i] == '\t' || expr[i] == '\n' || expr[i] == '\r' {
			i++
			continue
		}

		switch expr[i] {
		case '(':
			tokens = append(tokens, &token{kind: kindLParen, val: "("})
			i++
		case ')':
			tokens = append(tokens, &token{kind: kindRParen, val: ")"})
			i++
		case '!':
			if i+1 < len(expr) && expr[i+1] == '=' {
				tokens = append(tokens, &token{kind: kindOp, val: "!="})
				i += 2
				continue
			}
			tokens = append(tokens, &token{kind: kindNot})
			i++
		case '&':
			if i+1 < len(expr) && expr[i+1] == '&' {
				tokens = append(tokens, &token{kind: kindLAnd})
				i += 2
				continue
			}
			return nil, fmt.Errorf("unexpected &")
		case '|':
			if i+1 < len(expr) && expr[i+1] == '|' {
				tokens = append(tokens, &token{kind: kindLOr})
				i += 2
				continue
			}
			return nil, fmt.Errorf("unexpected |")
		case '=':
			if i+1 < len(expr) && expr[i+1] == '=' {
				tokens = append(tokens, &token{kind: kindOp, val: "=="})
				i += 2
				continue
			}
			return nil, fmt.Errorf("unexpected =")
		case '>':
			if i+1 < len(expr) && expr[i+1] == '=' {
				tokens = append(tokens, &token{kind: kindOp, val: ">="})
				i += 2
				continue
			}
			tokens = append(tokens, &token{kind: kindOp, val: ">"})
			i++
		case '<':
			if i+1 < len(expr) && expr[i+1] == '=' {
				tokens = append(tokens, &token{kind: kindOp, val: "<="})
				i += 2
				continue
			}
			tokens = append(tokens, &token{kind: kindOp, val: "<"})
			i++
		case '"':
			end := strings.Index(expr[i+1:], `"`)
			if end == -1 {
				return nil, fmt.Errorf("unterminated string")
			}
			tokens = append(tokens, &token{kind: kindString, val: expr[i+1 : i+1+end]})
			i += end + 2
		default:
			// identifier
			start := i
			for i < len(expr) && expr[i] != ' ' && expr[i] != '\t' && expr[i] != '(' && expr[i] != ')' {
				c := string(expr[i])
				if c == "&" || c == "|" || c == "=" || c == ">" || c == "<" || c == "!" {
					break
				}
				i++
			}
			val := expr[start:i]
			if val != "" {
				tokens = append(tokens, &token{kind: kindIdent, val: val})
			}
		}
	}
	tokens = append(tokens, &token{kind: kindEOF})
	return tokens, nil
}

// --- Parser (struct-based recursive descent) ---

type parser struct {
	tokens []*token
	pos    int
	ctx    *ExecutionCtx
}

func (p *parser) peek() *token {
	if p.pos < len(p.tokens) {
		return p.tokens[p.pos]
	}
	return &token{kind: kindEOF}
}

func (p *parser) consume() *token {
	t := p.peek()
	p.pos++
	return t
}

func (p *parser) expect(kind tokenKind) (*token, error) {
	t := p.consume()
	if t.kind != kind {
		return nil, fmt.Errorf("expected %v, got %v", kind, t.kind)
	}
	return t, nil
}

func evalExpressionAST(expr string, ctx *ExecutionCtx) (bool, error) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return false, nil
	}
	switch expr {
	case "true", "1":
		return true, nil
	case "false", "0":
		return false, nil
	}
	tokens, err := tokenize(expr)
	if err != nil {
		return false, fmt.Errorf("tokenize: %w", err)
	}
	p := &parser{tokens: tokens, ctx: ctx}
	result, err := p.parseOr()
	if err != nil {
		return false, err
	}
	if p.peek().kind != kindEOF {
		return false, fmt.Errorf("unexpected token: %v", p.peek().val)
	}
	return result, nil
}

func (p *parser) parseOr() (bool, error) {
	result, err := p.parseAnd()
	if err != nil {
		return false, err
	}
	for p.peek().kind == kindLOr {
		p.consume()
		right, err := p.parseAnd()
		if err != nil {
			return false, err
		}
		result = result || right
	}
	return result, nil
}

func (p *parser) parseAnd() (bool, error) {
	result, err := p.parseNot()
	if err != nil {
		return false, err
	}
	for p.peek().kind == kindLAnd {
		p.consume()
		right, err := p.parseNot()
		if err != nil {
			return false, err
		}
		result = result && right
	}
	return result, nil
}

func (p *parser) parseNot() (bool, error) {
	if p.peek().kind == kindNot {
		p.consume()
		result, err := p.parseNot()
		return !result, err
	}
	return p.parseComp()
}

func (p *parser) parseComp() (bool, error) {
	leftVal, err := p.parsePrimary()
	if err != nil {
		return false, err
	}
	if p.peek().kind != kindOp {
		return toBool(leftVal), nil
	}
	op := p.consume().val
	rightVal, err := p.parsePrimary()
	if err != nil {
		return false, err
	}
	return compare(leftVal, rightVal, op), nil
}

func (p *parser) parsePrimary() (interface{}, error) {
	t := p.peek()
	switch t.kind {
	case kindLParen:
		p.consume()
		result, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		_, err = p.expect(kindRParen)
		return result, err
	case kindString:
		p.consume()
		return t.val, nil
	case kindIdent:
		p.consume()
		return resolveIdent(t.val, p.ctx)
	case kindEOF:
		return nil, fmt.Errorf("unexpected EOF")
	default:
		return nil, fmt.Errorf("unexpected token: %v", t.val)
	}
}

// resolveIdent converts a token to a runtime value. It tries, in order:
//  1. $var → lookup in context (error if missing)
//  2. numeric literal
//  3. true/false keywords
//  4. bare name → lookup in context (falls back to string if not found)
func resolveIdent(s string, ctx *ExecutionCtx) (interface{}, error) {
	if strings.HasPrefix(s, "$") {
		varName := s[1:]
		val, ok := ctx.GetVar(varName)
		if !ok {
			return nil, fmt.Errorf("undefined variable: %s", s)
		}
		return val, nil
	}

	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return f, nil
	}
	if s == "true" {
		return true, nil
	}
	if s == "false" {
		return false, nil
	}

	if val, ok := ctx.GetVar(s); ok {
		return val, nil
	}
	return s, nil
}

// compare evaluates left OP right.
func compare(left, right interface{}, op string) bool {
	ll, leftNum := toFloat(left)
	rr, rightNum := toFloat(right)
	if leftNum && rightNum {
		switch op {
		case "==":
			return ll == rr
		case "!=":
			return ll != rr
		case ">":
			return ll > rr
		case ">=":
			return ll >= rr
		case "<":
			return ll < rr
		case "<=":
			return ll <= rr
		}
	}

	s1 := fmt.Sprint(left)
	s2 := fmt.Sprint(right)
	switch op {
	case "==":
		return s1 == s2
	case "!=":
		return s1 != s2
	case ">":
		return s1 > s2
	case ">=":
		return s1 >= s2
	case "<":
		return s1 < s2
	case "<=":
		return s1 <= s2
	}
	return false
}

func toFloat(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case uint:
		return float64(val), true
	case bool:
		if val {
			return 1, true
		}
		return 0, true
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err == nil {
			return f, true
		}
		return 0, false
	}
	return 0, false
}

// toBool converts a value to boolean.
func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "1"
	case float64:
		return val != 0
	case int:
		return val != 0
	case int64:
		return val != 0
	case nil:
		return false
	default:
		return true
	}
}
