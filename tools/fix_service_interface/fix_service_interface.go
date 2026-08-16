// fix_service_interface.go — adds missing import blocks to service_interface.go files
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	root := "orion-platform-svc-go/internal"
	matches, _ := filepath.Glob(filepath.Join(root, "*/service/service_interface.go"))

	fixed := 0
	for _, path := range matches {
		content, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		str := string(content)

		// Skip if already has import block
		if strings.Contains(str, "import (") {
			continue
		}

		needsContext := strings.Contains(str, "context.Context")
		needsModels := strings.Contains(str, "models.")

		// Determine module path for models import
		moduleDir := filepath.Dir(filepath.Dir(path))
		moduleName := filepath.Base(moduleDir)
		modelsImport := fmt.Sprintf("orion/platform-svc-go/internal/%s/models", moduleName)

		// Find position after "package service" line
		re := regexp.MustCompile(`^package service\s*$`)
		lines := strings.Split(str, "\n")
		newLines := make([]string, 0, len(lines)+6)
		inserted := false
		for i, line := range lines {
			newLines = append(newLines, line)
			if re.MatchString(line) && !inserted {
				newLines = append(newLines, "")
				newLines = append(newLines, "import (")
				if needsContext {
					newLines = append(newLines, "\t\"context\"")
				}
				if needsModels {
					newLines = append(newLines, fmt.Sprintf("\t\"%s\"", modelsImport))
				}
				newLines = append(newLines, ")")
				inserted = true
			}
			_ = i
		}

		newContent := strings.Join(newLines, "\n")
		if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
			fmt.Printf("ERROR %s: %v\n", path, err)
		} else {
			fixed++
		}
	}
	fmt.Printf("Fixed %d service_interface.go files\n", fixed)
}
