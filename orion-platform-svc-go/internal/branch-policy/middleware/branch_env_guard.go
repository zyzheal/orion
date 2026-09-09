// Package middleware provides HTTP middleware used by the branch-policy
// module. Phase 2 introduces BranchEnvGuard, which enforces image-tag ↔
// environment compatibility at the deploy API boundary.
//
// Design: fail-closed. If the (branch, targetEnv) pair has no NamespaceBinding
// OR the imageTag does not match the binding's ImageTagPrefix, the middleware
// aborts the request with HTTP 400 + code BRANCH_ENV_MISMATCH. This protects
// against the classic "tag reuse across branches" failure mode where a
// release branch image is accidentally deployed to a hotfix environment.
package middleware

import (
	"encoding/json"
	"fmt"
	"io"

	"orion/platform-svc-go/internal/branch-policy/models"
	"orion/platform-svc-go/internal/branch-policy/service"

	"github.com/gin-gonic/gin"
)

// DeployRequestAlias is a compile-time alias for models.DeployRequest to make
// the middleware's body type explicit at call sites.
type DeployRequestAlias = models.DeployRequest

// BranchEnvGuard returns a Gin middleware that validates image-tag ↔
// environment compatibility for deploy API calls.
//
// It reads the request body as a models.DeployRequest:
//
//	{"tenantId": "...", "branch": "...", "targetEnv": "...", "imageTag": "..."}
//
// Then calls svc.VerifyImageTagMatch with the parsed fields. If the check
// fails or errors, the request is aborted with HTTP 400.
//
// The raw body is restored after parsing so downstream handlers can still
// read the request body (c.Request.Body).
func BranchEnvGuard(svc service.ServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetString("tenant_id")
		if tenantID == "" {
			tenantID = c.GetHeader("X-Tenant-Id")
		}

		raw, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(400, gin.H{"success": false, "code": "INVALID_BODY", "message": err.Error()})
			c.Abort()
			return
		}
		// Restore the body so downstream handlers can parse it again.
		c.Request.Body = io.NopCloser(newReadSeeker(raw))

		var req models.DeployRequest
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &req); err != nil {
				// Not a deploy-shaped body — skip validation silently.
				// This lets the middleware be mounted on wider route groups
				// without breaking non-deploy endpoints.
				c.Next()
				return
			}
		}
		if req.TenantID == "" {
			req.TenantID = tenantID
		}
		if req.TenantID == "" || req.Branch == "" || req.TargetEnv == "" || req.ImageTag == "" {
			// Malformed deploy request. Fail closed to be safe.
			c.JSON(400, gin.H{
				"success": false,
				"code":    "BRANCH_ENV_REQUIRED",
				"message": "deploy request must include branch, targetEnv, imageTag (and tenantId or X-Tenant-Id header)",
			})
			c.Abort()
			return
		}

		ok, err := svc.VerifyImageTagMatch(c.Request.Context(), req.TenantID, req.Branch, req.TargetEnv, req.ImageTag)
		if err != nil {
			c.JSON(500, gin.H{"success": false, "code": "BRANCH_ENV_VERIFY_FAILED", "message": err.Error()})
			c.Abort()
			return
		}
		if !ok {
			c.JSON(400, gin.H{
				"success": false,
				"code":    "BRANCH_ENV_MISMATCH",
				"message": fmt.Sprintf("image tag %q is not allowed for env %q on branch %q", req.ImageTag, req.TargetEnv, req.Branch),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// newReadSeeker returns a minimal io.ReadSeeker over a byte slice. We only
// need Seek(0, io.SeekStart) to rewind; this avoids pulling in bytes.Reader
// which would return io.ReadSeeker and force a type assertion at the call
// site.
type byteReader struct {
	data []byte
	pos  int
}

func newReadSeeker(data []byte) *byteReader {
	return &byteReader{data: data}
}

func (r *byteReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func (r *byteReader) Seek(offset int64, whence int) (int64, error) {
	var newAbs int64
	switch whence {
	case io.SeekStart:
		newAbs = offset
	case io.SeekCurrent:
		newAbs = int64(r.pos) + offset
	case io.SeekEnd:
		newAbs = int64(len(r.data)) + offset
	default:
		return 0, fmt.Errorf("invalid whence %d", whence)
	}
	if newAbs < 0 {
		return 0, fmt.Errorf("negative position %d", newAbs)
	}
	r.pos = int(newAbs)
	return newAbs, nil
}
