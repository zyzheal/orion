package calldispatcher

import "context"

type Domain string

const (
	DomainCMDB     Domain = "cmdb"
	DomainPipeline Domain = "pipeline"
	DomainAlert    Domain = "alert"
	DomainIncident Domain = "incident"
	DomainChange   Domain = "change"
	DomainApproval Domain = "approval"
)

type CrossDomainRequest struct {
	TenantID string
	Source   Domain
	Target   Domain
	Action   string
	Payload  map[string]any
}

type CrossDomainResponse struct {
	Success    bool
	StatusCode int
	Data       any
	Error      string
}

type HandlerFunc func(ctx context.Context, req CrossDomainRequest) CrossDomainResponse
