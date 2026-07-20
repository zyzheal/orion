package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
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
		f, err := os.ReadFile(path)
		if err != nil {
			log.Printf("skip %s: %v", path, err)
			continue
		}
		content := string(f)

		// Skip if already has interface
		if strings.Contains(content, "type RepositoryInterface interface") {
			log.Printf("skip %s: already has interface", path)
			continue
		}

		// Check if NewService uses *repository.Repository
		if !strings.Contains(content, "*repository.Repository") {
			log.Printf("skip %s: doesn't use *repository.Repository", path)
			continue
		}

		// Parse AST
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, content, parser.ParseComments)
		if err != nil {
			log.Printf("parse error %s: %v", path, err)
			continue
		}

		// Find all s.repo.XXX() calls
		methods := make(map[string]bool)
		ast.Inspect(file, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			xsel, ok := sel.X.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			ident, ok := xsel.X.(*ast.Ident)
			if !ok || ident.Name != "s" || xsel.Sel.Name != "repo" {
				return true
			}
			methods[sel.Sel.Name] = true
			return true
		})

		if len(methods) == 0 {
			log.Printf("skip %s: no s.repo.XXX calls found", path)
			continue
		}

		// Read repository.go to get exact signatures
		repoPath := fmt.Sprintf("%s/../repository/repository.go", path[:strings.LastIndex(path, "/")])
		repoFile := ""
		if rc, err := os.ReadFile(repoPath); err == nil {
			repoFile = string(rc)
		}

		// Build method signatures from repo file
		methodSigRe := regexp.MustCompile(`func \([^)]+\) ([A-Z][A-Za-z0-9]+)\(([^)]*)\) ([\s\S]*?)(?:\nfunc |\n// |\n\})`)
		signatures := make(map[string]string)
		for _, m := range methodSigRe.FindAllStringSubmatch(repoFile, -1) {
			if _, exists := methods[m[1]]; exists {
				// Build clean signature
				params := m[2]
				rets := m[3]
				// Clean up multiline returns
				rets = strings.ReplaceAll(rets, "\n", "")
				signatures[m[1]] = fmt.Sprintf("%s(%s) %s", m[1], params, strings.TrimSpace(rets))
			}
		}

		// Build interface
		var iface strings.Builder
		iface.WriteString("// RepositoryInterface defines the repository methods used by the service.\n")
		iface.WriteString("type RepositoryInterface interface {\n")
		for name := range methods {
			if sig, ok := signatures[name]; ok {
				iface.WriteString(fmt.Sprintf("\t%s\n", sig))
			} else {
				iface.WriteString(fmt.Sprintf("\t%s()\n", name))
			}
		}
		iface.WriteString("}\n")

		// Transform content
		newContent := content

		// 1. Replace repo *repository.Repository with repo RepositoryInterface
		newContent = strings.ReplaceAll(newContent, "repo *repository.Repository", "repo RepositoryInterface")
		newContent = strings.ReplaceAll(newContent, "NewService(repo *repository.Repository)", "NewService(repo RepositoryInterface)")

		// 2. Check if repository import is still needed
		repoRefCount := strings.Count(newContent, "repository.")
		// Also check if any return type uses repository.XXX
		repoTypeRef := strings.Contains(newContent, "repository.TicketSLATracking") ||
			strings.Contains(newContent, "repository.ErrNotFound") ||
			strings.Contains(newContent, "repository.AuditLogCreateReq") ||
			strings.Contains(newContent, "repository.PolicyStats") ||
			strings.Contains(newContent, "repository.ErrNotFoundMsg") ||
			strings.Contains(newContent, "repository.ListFilter") ||
			strings.Contains(newContent, "repository.FormatCSV") ||
			strings.Contains(newContent, "repository.ErrNotFoundErr")

		if repoRefCount == 0 && !repoTypeRef {
			// Remove repository import
			importRe := regexp.MustCompile(`"orion/platform-svc-go/internal/[^"]+?/repository"\s*\n`)
			newContent = importRe.ReplaceAllString(newContent, "")
		}

		// 3. Insert interface after package declaration
		// Find the blank line after "package service"
		lines := strings.Split(newContent, "\n")
		for i, line := range lines {
			if strings.TrimSpace(line) == "package service" && i+1 < len(lines) && strings.TrimSpace(lines[i+1]) == "" {
				// Insert after this blank line
				lines = append(lines[:i+2], append([]string{iface.String(), ""}, lines[i+2:]...)...)
				newContent = strings.Join(lines, "\n")
				break
			}
		}

		// Write back
		if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
			log.Printf("write error %s: %v", path, err)
			continue
		}
		log.Printf("fixed %s (%d methods)", path, len(methods))
	}

	log.Println("Done. Run 'go test ./internal/...' to verify.")
}
