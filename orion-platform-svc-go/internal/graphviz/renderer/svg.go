package renderer

import (
	"encoding/json"
	"fmt"
	"orion/platform-svc-go/internal/graphviz/graph"
	"strings"
)

// SVGRenderer renders a Graph into SVG format using a basic layout algorithm.
type SVGRenderer struct {
	graph *graph.Graph
	width int
	height int
}

// NewSVGRenderer creates a new SVGRenderer for the given Graph.
func NewSVGRenderer(g *graph.Graph) *SVGRenderer {
	return &SVGRenderer{
		graph:  g,
		width:  800,
		height: 600,
	}
}

// WithDimensions sets the SVG canvas size.
func (r *SVGRenderer) WithDimensions(w, h int) *SVGRenderer {
	r.width = w
	r.height = h
	return r
}

// Render produces an SVG string for the graph.
func (r *SVGRenderer) Render() string {
	// Compute simple auto-layout positions
	r.autoLayout()

	var sb strings.Builder
	sb.WriteString("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ")
	sb.WriteString(r.formatInt(r.width))
	sb.WriteString(" ")
	sb.WriteString(r.formatInt(r.height))
	sb.WriteString("\">")
	sb.WriteString("<title>")
	sb.WriteString(sanitize(r.graph.Name))
	sb.WriteString("</title>")
	sb.WriteString(r.renderBackground())

	// Render edges first so nodes appear on top
	for _, l := range r.graph.Links {
		sb.WriteString(r.renderLink(l))
	}
	// Render nodes
	for _, n := range r.graph.Nodes {
		sb.WriteString(r.renderNode(n))
	}

	sb.WriteString("</svg>")
	return sb.String()
}

// RenderJSON outputs a JSON representation suitable for frontend graph libraries.
func (r *SVGRenderer) RenderJSON() (string, error) {
	data := map[string]interface{}{
		"nodes": r.graph.Nodes,
		"edges": r.graph.Links,
		"width": r.width,
		"height": r.height,
	}
	b, err := json.Marshal(data)
	return string(b), err
}

func (r *SVGRenderer) autoLayout() {
	if r.graph.Direction == "TB" || r.graph.Direction == "BT" {
		r.layoutVertical()
	} else {
		r.layoutHorizontal()
	}
}

func (r *SVGRenderer) layoutVertical() {
	nodeCount := len(r.graph.Nodes)
	if nodeCount == 0 {
		return
	}
	rows := rowsForGraph(r.graph)
	nodePos := make(map[string]*graph.Point)
	yOffset := 60.0
	for _, ids := range rows {
		for _, id := range ids {
			nodePos[id] = &graph.Point{X: 0, Y: yOffset}
		}
		yOffset += 100.0
	}
	// X coordinates
	var x float64 = 100.0
	for _, n := range r.graph.Nodes {
		if p := nodePos[n.ID]; p != nil {
			p.X = x
			n.Position = p
			x += 200.0
		}
	}
}

func (r *SVGRenderer) layoutHorizontal() {
	nodeCount := len(r.graph.Nodes)
	if nodeCount == 0 {
		return
	}
	var x float64 = 100.0
	for _, n := range r.graph.Nodes {
		n.Position = &graph.Point{X: x, Y: 100.0}
		x += 200.0
	}
}

func rowsForGraph(g *graph.Graph) map[int][]string {
	rows := make(map[int][]string)
	visited := make(map[string]bool)
	row := 0
	for _, n := range g.Nodes {
		if visited[n.ID] {
			continue
		}
		visited[n.ID] = true
		rows[row] = append(rows[row], n.ID)
	}
	return rows
}

func (r *SVGRenderer) renderBackground() string {
	return `<rect width="100%" height="100%" fill="#fafbfc"/>`
}

func (r *SVGRenderer) renderNode(n *graph.Node) string {
	p := n.Position
	if p == nil {
		p = &graph.Point{X: 100, Y: 100}
	}
	color := n.Color
	if color == "" {
		color = "#3370E6"
	}
	shape := r.nodeShapeForType(n.Type)
	if shape == "box" {
		return r.renderBoxNode(n, color)
	}
	return r.renderEllipseNode(n, color)
}

func (r *SVGRenderer) renderBoxNode(n *graph.Node, color string) string {
	x := n.Position.X
	y := n.Position.Y
	return `<rect x="` + r.formatFloat(x) + `" y="` + r.formatFloat(y) +
		`" width="140" height="50" rx="6" ry="6" fill="` + color + `" opacity="0.9"/>` +
		`<text x="` + r.formatFloat(x+70) + `" y="` + r.formatFloat(y+28) +
		`" fill="white" font-size="13" text-anchor="middle">` + sanitize(n.Label) + `</text>`
}

func (r *SVGRenderer) renderEllipseNode(n *graph.Node, color string) string {
	x := n.Position.X
	y := n.Position.Y
	return `<ellipse cx="` + r.formatFloat(x+70) + `" cy="` + r.formatFloat(y+25) +
		`" rx="70" ry="25" fill="` + color + `" opacity="0.9"/>` +
		`<text x="` + r.formatFloat(x+70) + `" y="` + r.formatFloat(y+30) +
		`" fill="white" font-size="13" text-anchor="middle">` + sanitize(n.Label) + `</text>`
}

func (r *SVGRenderer) nodeShapeForType(t string) string {
	switch t {
	case "server":
		return "box"
	case "database":
		return "box"
	case "network":
		return "ellipse"
	case "person":
		return "ellipse"
	case "container":
		return "box"
	case "process":
		return "box"
	case "service":
		return "ellipse"
	default:
		return "ellipse"
	}
}

func (r *SVGRenderer) renderLink(l *graph.Link) string {
	source := r.findPosition(l.Source)
	target := r.findPosition(l.Target)
	if source == nil || target == nil {
		return ""
	}
	return `<line x1="` + r.formatFloat(source.X+140) + `" y1="` + r.formatFloat(source.Y+25) +
		`" x2="` + r.formatFloat(target.X) + `" y2="` + r.formatFloat(target.Y+25) +
		`" stroke="#5a7184" stroke-width="1.5" opacity="0.7"/>`
}

func (r *SVGRenderer) findPosition(id string) *graph.Point {
	for _, n := range r.graph.Nodes {
		if n.ID == id && n.Position != nil {
			return n.Position
		}
	}
	return nil
}

func (r *SVGRenderer) formatFloat(f float64) string {
	return r.formatFloatStr(f)
}

func (r *SVGRenderer) formatInt(i int) string {
	return r.formatIntStr(i)
}

func (r *SVGRenderer) formatFloatStr(f float64) string {
	return fmt.Sprintf("%.1f", f)
}

func (r *SVGRenderer) formatIntStr(i int) string {
	return fmt.Sprintf("%d", i)
}
