package main

import (
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	services := []string{
		"internal/ai-decisions/service/service.go",
		"internal/audit/service/service.go",
		"internal/capability/service/service.go",
		"internal/chatops/service/service.go",
		"internal/developer-portal/service/service.go",
		"internal/digital-twin/service/service.go",
		"internal/digital-twin-simulation/service/service.go",
		"internal/efficiency/service/service.go",
		"internal/governance/service/service.go",
		"internal/monitoring/service/service.go",
		"internal/pipeline-graph/service/service.go",
		"internal/tenant/service/service.go",
		"internal/test-selector/service/service.go",
		"internal/ticketing/service/service.go",
		"internal/workflow/service/service.go",
	}

	for _, path := range services {
		f, err := os.Open(path)
		if err != nil {
			log.Printf("skip %s: %v", path, err)
			continue
		}
		bs, _ := f.ReadBytes('\n')
		f.Close()

		content := string(bs)

		// Already has interface?
		if strings.Contains(content, "type RepositoryInterface interface") {
			log.Printf("skip %s: already has interface", path)
			continue
		}

		// Does NewService use *repository.Repository?
		if !strings.Contains(content, "NewService") || !strings.Contains(content, "*repository.Repository") {
			log.Printf("skip %s: NewService doesn't use *repository.Repository", path)
			continue
		}

		// Parse the file
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, content, parser.ParseComments)
		if err != nil {
			log.Printf("parse error %s: %v", path, err)
			continue
		}

		// Collect all s.repo.XXX() method calls from the AST
		methods := make(map[string]string)
		ast.Inspect(file, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			// Find s.repo.MethodName
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			xsel, ok := sel.X.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			ident, ok := xsel.X.(*ast.Ident)
			if !ok {
				return true
			}
			if ident.Name == "s" && xsel.Sel.Name == "repo" {
				methodName := sel.Sel.Name
				// Build signature from the call arguments
				sig := buildSignature(methodName, call.Args, fset, file)
				methods[methodName] = sig
			}
			return true
		})

		// Also search via regex as fallback
		re := regexp.MustCompile(`s\.repo\.([A-Z][A-Za-z0-9]+)\(`)
		for _, m := range re.FindAllStringSubmatch(content, -1) {
			name := m[1]
			if _, exists := methods[name]; !exists {
				methods[name] = "" // placeholder, will fill from repo file
			}
		}

		// Read the repository file to get exact signatures
		repoPath := filepath.Join(filepath.Dir(path), "..", "repository", "repository.go")
		var repoContent string
		if rc, err := os.ReadFile(repoPath); err == nil {
			repoContent = string(rc)
		}

		// Build interface declaration
		iface := buildInterface(methods, repoContent, path)

		// Now transform the content
		// 1. Remove old import of repository if not needed
		// 2. Insert RepositoryInterface after package declaration
		// 3. Replace *repository.Repository with RepositoryInterface

		newContent := content

		// Remove "type Service struct {" ... } and replace
		newContent = strings.ReplaceAll(newContent, "repo *repository.Repository", "repo RepositoryInterface")
		newContent = strings.ReplaceAll(newContent, "NewService(repo *repository.Repository)", "NewService(repo RepositoryInterface)")

		// Check if repository import is still needed
		// Keep it if any non-*repository.Repository references exist
		repoRefs := strings.Count(newContent, "repository.")
		if repoRefs == 0 {
			// Remove the repository import line
			newContent = regexp.MustCompile(`"\d*orion/platform-svc-go/internal/[^"]+repository"\s*\n`).ReplaceAllString(newContent, "")
		}

		// Insert interface after "package service\n\n" (or after import block)
		insertAfter := findInsertPoint(newContent)
		newContent = strings.Replace(newContent, insertAfter, insertAfter+"\n"+iface, 1)

		// Write back
		if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
			log.Printf("write error %s: %v", path, err)
			continue
		}
		log.Printf("fixed %s (%d methods)", path, len(methods))
	}

	// Run gofmt on all modified files
	for _, path := range services {
		cmd := exec.Command("gofmt", "-w", path)
		cmd.Run()
	}
}

func findInsertPoint(content string) string {
	// Find the end of the import block or package declaration
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) == ")" && i+1 < len(lines) && strings.TrimSpace(lines[i+1]) == "" {
			// End of import block
			return strings.Join(lines[:i+1], "\n") + "\n"
		}
		if strings.TrimSpace(line) == "package service" && i+1 < len(lines) && strings.TrimSpace(lines[i+1]) == "" {
			// No import block, after package
			return strings.Join(lines[:i+1], "\n") + "\n\n"
		}
	}
	return ""
}

func buildInterface(methods map[string]string, repoContent, filePath string) string {
	// Try to get signatures from repo file
	sigRe := regexp.MustCompile(`func \([^)]+\) ([A-Z][A-Za-z0-9]+)\(([^)]*)\) ([^\n]*)`)
	sigMap := make(map[string]string)
	for _, m := range sigRe.FindAllStringSubmatch(repoContent, -1) {
		sigMap[m[1]] = m[1] + "(" + m[2] + ") " + m[3]
	}

	var b strings.Builder
	b.WriteString("// RepositoryInterface defines the repository methods used by the service.\n")
	b.WriteString("type RepositoryInterface interface {\n")

	for name := range methods {
		if sig, ok := sigMap[name]; ok {
			b.WriteString(sig + "\n")
		} else {
			b.WriteString(name + "()\n")
		}
	}
	b.WriteString("}\n")
	return b.String()
}

func buildSignature(methodName string, args []ast.Expr, fset *token.FileSet, file *ast.File) string {
	// Just return method name, we'll fill from repo file
	return methodName
}
