package explain

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// stackNode wraps ExplainNode with the indent level at which it was
// found in the raw text. Sibling detection relies on matching indents.
type stackNode struct {
	node   ExplainNode
	indent int
}

// ParsePG parses PostgreSQL's text-format EXPLAIN output into a tree.
//
// PG's plan output has three structural forms:
//
//  1. A single-line leaf:
//         Seq Scan on orders (cost=...)
//
//  2. A parent with indented children prefixed by "->":
//         Hash Join (cost=...)
//            ->  Seq Scan on orders
//            ->  Hash
//                  ->  Seq Scan on customers
//
//  3. A parent followed by un-arrowed lines at the same indent
//     (which are actually children — this is what PG emits for
//     multi-line Hash Join children that start with "->" at the
//     same visual column as the parent's first child).
//
// The algorithm tracks a stack of {node, indent}. For each new line:
//   - if it's the first line, it becomes the root
//   - if its indent is deeper than the stack top, it's a child
//   - if its indent is shallower, we pop until we find an ancestor
//     with a smaller indent, then attach
//   - if it's at the same indent as the top, it's a sibling
func ParsePG(raw string) ExplainNode {
	// We must preserve leading whitespace on the FIRST line — PG's
	// Hash Join output starts at indent 3 and the join root's
	// indent is what anchors the whole tree. Trim only the leading
	// and trailing newlines.
	trimmed := strings.Trim(raw, "\n")
	lines := strings.Split(trimmed, "\n")
	if len(lines) == 0 || strings.TrimSpace(trimmed) == "" {
		return ExplainNode{}
	}

	costRe := regexp.MustCompile(`cost=([\d.]+)\.\.([\d.]+)`)
	rowsRe := regexp.MustCompile(`rows=([0-9,]+)`)
	actualRe := regexp.MustCompile(`actual time=([\d.]+)\.\.([\d.]+)`)
	seqRe := regexp.MustCompile(`Seq Scan on (\S+)`)
	idxRe := regexp.MustCompile(`(Index(?: Only)? Scan) using (\S+) on (\S+)`)
	bitmapRe := regexp.MustCompile(`Bitmap (Heap|Index) Scan`)
	// Includes bare "Hash" (PG emits "Hash (cost=...)" as a join child)
	// in addition to "Hash Join" (the root join operator).
	joinRe := regexp.MustCompile(`^(Nested Loop|Hash Join|Hash|Merge Join)\s*\(`)
	appendRe := regexp.MustCompile(`^(Append|SubPlan)\s*\(`)

	var root ExplainNode
	var stack []stackNode

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		indent := leadingSpaces(line)

		node := parseNodeLine(trimmed, seqRe, idxRe, bitmapRe, joinRe, appendRe, costRe, rowsRe, actualRe)

		if len(stack) == 0 {
			// First non-empty line becomes the root.
			root = node
			stack = []stackNode{{node: node, indent: indent}}
			continue
		}

		top := stack[len(stack)-1]

		if indent > top.indent {
			// Deeper: child of top.
			stack[len(stack)-1].node.Children = append(stack[len(stack)-1].node.Children, node)
			stack = append(stack, stackNode{node: node, indent: indent})
		} else if indent == top.indent {
			// Same indent: sibling. Pop top, attach to grandparent.
			//
			// Special case: when the popped node was the root, the new
			// node becomes the root's child. This handles PG's Hash Join
			// output where the join line is at indent 0 and both
			// children are at indent 3 with "->" — the second child
			// would otherwise be treated as a root-level sibling and
			// detach from the tree.
			popped := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if len(stack) == 0 {
				// Was the root: attach as its child.
				popped.node.Children = append(popped.node.Children, node)
				stack = []stackNode{popped, {node: node, indent: indent}}
			} else {
				stack[len(stack)-1].node.Children = append(stack[len(stack)-1].node.Children, node)
				stack = append(stack, stackNode{node: node, indent: indent})
			}
		} else {
			// Shallower: walk up to the first ancestor with indent < current.
			idx := len(stack) - 1
			for idx >= 0 && stack[idx].indent >= indent {
				idx--
			}
			if idx >= 0 {
				stack[idx].node.Children = append(stack[idx].node.Children, node)
				stack = stack[:idx+1]
				stack = append(stack, stackNode{node: node, indent: indent})
			} else {
				// No ancestor found: attach as sibling of root.
				root.Children = append(root.Children, node)
				stack = []stackNode{{node: node, indent: indent}}
			}
		}

		// Note: hasArrow is unused in this simplified algorithm because
		// the indent-based approach handles PG's Hash Join case (where
		// children are at the same indent as each other).
	}
	// The root is stack[0].node; returning `root` (a copy from the first
	// iteration) would lose children appended later via stack mutation.
	if len(stack) > 0 {
		return stack[0].node
	}
	return root
}

// parseNodeLine extracts fields from a single EXPLAIN line. Kept as a
// helper so the main loop stays focused on tree structure.
func parseNodeLine(
	trimmed string,
	seqRe, idxRe, bitmapRe, joinRe, appendRe, costRe, rowsRe, actualRe *regexp.Regexp,
) ExplainNode {
	node := ExplainNode{Raw: trimmed}

	// PG prefixes children with "->  " or "-> " — strip it so the node
	// type regexes below match the actual node name (e.g. "Hash" instead
	// of "-> Hash").
	trimmed = strings.TrimPrefix(trimmed, "->")
	trimmed = strings.TrimSpace(trimmed)
	node.Raw = trimmed

	if m := joinRe.FindStringSubmatch(trimmed); m != nil {
		node.NodeType = m[1]
	} else if m := appendRe.FindStringSubmatch(trimmed); m != nil {
		node.NodeType = m[1]
	} else if m := seqRe.FindStringSubmatch(trimmed); m != nil {
		node.NodeType = "Seq Scan"
		node.ScanType = "Seq"
		node.Relation = m[1]
	} else if m := idxRe.FindStringSubmatch(trimmed); m != nil {
		node.NodeType = m[1]
		node.ScanType = "Index"
		node.Index = m[2]
		node.Relation = m[3]
	} else if m := bitmapRe.FindStringSubmatch(trimmed); m != nil {
		node.NodeType = "Bitmap " + m[1] + " Scan"
		node.ScanType = "Bitmap"
	} else {
		parts := strings.SplitN(trimmed, ":", 2)
		node.NodeType = strings.TrimSpace(parts[0])
	}

	if m := costRe.FindStringSubmatch(trimmed); m != nil {
		start, _ := strconv.ParseFloat(m[1], 64)
		total, _ := strconv.ParseFloat(m[2], 64)
		node.Cost = &PlanCost{Start: start, Total: total, Run: total - start}
	}
	if m := rowsRe.FindStringSubmatch(trimmed); m != nil {
		clean := strings.ReplaceAll(m[1], ",", "")
		if n, err := strconv.ParseInt(clean, 10, 64); err == nil {
			node.Rows = &n
		}
	}
	if m := actualRe.FindStringSubmatch(trimmed); m != nil {
		end, _ := strconv.ParseFloat(m[2], 64)
		node.TimeMs = &end
	}
	return node
}

// ParseMySQL parses MySQL's EXPLAIN FORMAT=JSON output into a tree.
// MySQL's JSON is deeply nested; we extract only the fields the
// frontend and analyzer need.
func ParseMySQL(raw string) ExplainNode {
	var payload struct {
		QueryBlock struct {
			SelectID     int                 `json:"select_id"`
			CostInfo     map[string]string   `json:"cost_info"`
			Table        map[string]any      `json:"table"`
			PruneCond    string              `json:"pruning_condition,omitempty"`
			AttachedSubqueries []map[string]any `json:"attached_subqueries,omitempty"`
		} `json:"query_block"`
		CostInfo map[string]string `json:"cost_info"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return ExplainNode{NodeType: "parse_error", Raw: raw}
	}

	root := ExplainNode{NodeType: "query_block", Raw: raw}

	if c, ok := payload.CostInfo["query_cost"]; ok {
		if v, err := strconv.ParseFloat(c, 64); err == nil && v > 0 {
			root.Cost = &PlanCost{Total: v}
		}
	}

	if tbl, ok := payload.QueryBlock.Table["table_name"].(string); ok {
		root.Relation = tbl
	}
	if access, ok := payload.QueryBlock.Table["access_type"].(string); ok {
		switch access {
		case "ALL":
			root.ScanType = "Seq"
		case "index", "ref", "range", "const", "eq_ref", "system":
			root.ScanType = "Index"
		}
	}
	if key, ok := payload.QueryBlock.Table["key"].(string); ok && key != "" {
		root.Index = key
	}
	if rows, ok := payload.QueryBlock.Table["rows"].(float64); ok {
		n := int64(rows)
		root.Rows = &n
	}
	if cost, ok := payload.QueryBlock.Table["cost_info"].(map[string]any); ok {
		if s, ok := cost["read_cost"].(string); ok {
			if v, err := strconv.ParseFloat(s, 64); err == nil && root.Cost != nil {
				root.Cost.Start = v
			}
		}
	}
	return root
}

// Parse dispatches based on dbType.
func Parse(dbType, raw string) ExplainNode {
	switch strings.ToLower(dbType) {
	case "mysql":
		return ParseMySQL(raw)
	default:
		return ParsePG(raw)
	}
}

// Suggest walks the parsed plan and emits deterministic optimization
// hints. Rules are cheap — this runs per request.
func Suggest(plan ExplainNode, dbType string) []Suggestion {
	var out []Suggestion
	walk(plan, &out)
	return out
}

func walk(node ExplainNode, out *[]Suggestion) {
	if node.NodeType == "Seq Scan" {
		*out = append(*out, Suggestion{
			Category:    "scan_type",
			Severity:    "high",
			Title:       "顺序扫描 (Seq Scan) 检测到",
			Description: fmt.Sprintf("表 %s 正在执行顺序扫描，通常意味着缺少合适的索引。", node.Relation),
			NodeID:      node.Relation,
		})
	}
	if node.Cost != nil && node.Cost.Total > 10000 {
		*out = append(*out, Suggestion{
			Category:    "cost",
			Severity:    "medium",
			Title:       "总成本偏高",
			Description: fmt.Sprintf("节点 %s 的总成本 %g 超过 10000，考虑改写或添加索引。",
				node.NodeType, node.Cost.Total),
			NodeID: node.NodeType,
		})
	}
	if node.Rows != nil && *node.Rows > 1000000 {
		*out = append(*out, Suggestion{
			Category:    "rows",
			Severity:    "high",
			Title:       "扫描行数超过 100 万",
			Description: fmt.Sprintf("节点 %s 预估扫描 %d 行，可能引发全表扫描。",
				node.NodeType, *node.Rows),
			NodeID: node.Relation,
		})
	}
	if node.NodeType == "Hash Join" && len(node.Children) == 2 &&
		node.Children[1].ScanType == "Seq" &&
		node.Children[0].Cost != nil && node.Children[0].Cost.Total > 0 &&
		node.Children[1].Cost != nil &&
		node.Children[1].Cost.Total > node.Children[0].Cost.Total*100 {
		*out = append(*out, Suggestion{
			Category:    "join",
			Severity:    "medium",
			Title:       "哈希连接构建大表",
			Description: "哈希连接将大表放入内存构建哈希表，可能引发内存压力。考虑调整 join order 或添加索引以走 nested loop。",
			NodeID: node.NodeType,
		})
	}
	for _, c := range node.Children {
		walk(c, out)
	}
}

// leadingSpaces returns the count of leading ASCII space characters.
func leadingSpaces(s string) int {
	n := 0
	for n < len(s) && s[n] == ' ' {
		n++
	}
	return n
}
