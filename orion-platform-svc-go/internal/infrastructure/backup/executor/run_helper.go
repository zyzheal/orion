package executor

import (
	"context"
	"os/exec"
)

// newCmd constructs an exec.Cmd for the given context and invocation shape.
// It lives in its own file so both pg.go and mysql.go can customize
// Stdin/Stdout independently without duplicating the CommandContext wiring.
func newCmd(ctx context.Context, path string, args []string, env []string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, path, args...)
	cmd.Env = env
	return cmd
}
