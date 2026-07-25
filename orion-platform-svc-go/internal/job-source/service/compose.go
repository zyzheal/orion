// Package service provides adapters, composition, and dispatch for job sources.
//
// Composition allows sources to be chained together: an upstream source
// feeds events into downstream sources, optionally filtered, forming
// a DAG of triggers.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/job-source/models"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// SourceComposer — creates and manages source chains
// ---------------------------------------------------------------------------

// SourceComposer orchestrates source chaining and composition. It connects
// upstream sources to downstream sources with optional JSON filters applied
// between each link.
type SourceComposer struct {
	links  map[string][]models.JobSourceChainLink // chainID -> links
	chains map[string]models.JobSourceChain
	mu     sync.RWMutex
	logger *zap.Logger
}

// NewSourceComposer creates a composer with optional logging.
func NewSourceComposer(logger *zap.Logger) *SourceComposer {
	return &SourceComposer{
		links:  make(map[string][]models.JobSourceChainLink),
		chains: make(map[string]models.JobSourceChain),
		logger: logger,
	}
}

// RegisterChain registers a chain and its links.
func (c *SourceComposer) RegisterChain(chain models.JobSourceChain, links []models.JobSourceChainLink) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.chains[chain.ID] = chain
	c.links[chain.ID] = links
	c.logger.Info("source chain registered",
		zap.String("chain_id", chain.ID),
		zap.String("name", chain.Name),
		zap.Int("links", len(links)),
	)
}

// GetChain retrieves a chain by ID.
func (c *SourceComposer) GetChain(chainID string) (models.JobSourceChain, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	chain, ok := c.chains[chainID]
	return chain, ok
}

// ListChains returns all registered chains.
func (c *SourceComposer) ListChains() []models.JobSourceChain {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]models.JobSourceChain, 0, len(c.chains))
	for _, chain := range c.chains {
		result = append(result, chain)
	}
	return result
}

// GetLinks returns the links for a chain.
func (c *SourceComposer) GetLinks(chainID string) ([]models.JobSourceChainLink, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	links, ok := c.links[chainID]
	if !ok {
		return nil, false
	}
	// Return a copy
	result := make([]models.JobSourceChainLink, len(links))
	copy(result, links)
	return result, true
}

// UnregisterChain removes a chain and its links.
func (c *SourceComposer) UnregisterChain(chainID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.chains[chainID]; !ok {
		return false
	}
	delete(c.chains, chainID)
	delete(c.links, chainID)
	c.logger.Info("source chain unregistered", zap.String("chain_id", chainID))
	return true
}

// ---------------------------------------------------------------------------
// SourceCombinator — combines multiple sources with logical operators
// ---------------------------------------------------------------------------

// SourceCombinator combines events from multiple upstream sources using
// AND/OR logic. Events are delivered when the combination condition is met.
type SourceCombinator struct {
	name      string
	operator  string // "AND" or "OR"
	upstreams []string
	filter    string // JSON filter applied before combination
	mu        sync.RWMutex
	logger    *zap.Logger
	handler   EventHandler
}

// NewSourceCombinator creates a combinator.
func NewSourceCombinator(name, operator string, logger *zap.Logger) *SourceCombinator {
	return &SourceCombinator{
		name:      name,
		operator:  operator,
		upstreams: make([]string, 0),
		filter:    "{}",
		logger:    logger,
	}
}

// AddUpstream adds an upstream source to the combinator.
func (c *SourceCombinator) AddUpstream(sourceID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.upstreams = append(c.upstreams, sourceID)
	c.logger.Debug("upstream added to combinator",
		zap.String("combinator", c.name),
		zap.String("source_id", sourceID),
	)
}

// SetFilter applies a JSON filter to events before combination.
func (c *SourceCombinator) SetFilter(filter string) error {
	if filter != "" {
		var out map[string]interface{}
		if err := json.Unmarshal([]byte(filter), &out); err != nil {
			return fmt.Errorf("invalid JSON filter: %w", err)
		}
	}
	c.filter = filter
	return nil
}

// SetHandler sets the event handler for the combinator.
func (c *SourceCombinator) SetHandler(h EventHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handler = h
}

// HandleEvent processes an incoming event from an upstream source.
// For OR mode, dispatches immediately.
// For AND mode, collects events and dispatches when all upstreams have fired.
func (c *SourceCombinator) HandleEvent(ctx context.Context, sourceID string, payload EventPayload) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.handler == nil {
		return nil
	}

	// Verify this source is a known upstream
	found := false
	for _, u := range c.upstreams {
		if u == sourceID {
			found = true
			break
		}
	}
	if !found {
		c.logger.Debug("ignoring event from unknown upstream",
			zap.String("combinator", c.name),
			zap.String("source_id", sourceID),
		)
		return nil
	}

	// Apply filter if set
	if c.filter != "" && c.filter != "{}" {
		var f map[string]interface{}
		if err := json.Unmarshal([]byte(c.filter), &f); err == nil && len(f) > 0 {
			// Basic key-existence check: filter passes if payload.Data contains all filter keys
			pass := true
			for key := range f {
				if _, ok := payload.Data[key]; !ok {
					pass = false
					break
				}
			}
			if !pass {
				c.logger.Debug("event filtered out",
					zap.String("combinator", c.name),
					zap.String("source_id", sourceID),
				)
				return nil
			}
		}
	}

	// OR mode: dispatch immediately
	if c.operator == "OR" {
		if err := c.handler(ctx, payload); err != nil {
			c.logger.Error("combinator handler failed",
				zap.String("combinator", c.name),
				zap.Error(err),
			)
			return err
		}
		return nil
	}

	// AND mode: only dispatch when all upstreams have been seen
	// (simple counting implementation; real use would track per-event correlation IDs)
	c.logger.Debug("AND mode: event received, waiting for all upstreams",
		zap.String("combinator", c.name),
		zap.String("source_id", sourceID),
	)
	// Placeholder: in production, track seen events with TTL
	return nil
}

// ListUpstreams returns the list of upstream sources.
func (c *SourceCombinator) ListUpstreams() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]string, len(c.upstreams))
	copy(result, c.upstreams)
	return result
}

// ---------------------------------------------------------------------------
// SourcePipeline — ordered sequence of source transformations
// ---------------------------------------------------------------------------

// SourcePipeline is an ordered sequence of source stages where each stage
// receives events from the previous stage and can transform or filter them.
type SourcePipeline struct {
	name     string
	stages   []PipelineStage
	mu       sync.RWMutex
	logger   *zap.Logger
	lastIdx  int // index of the last stage (receives final output)
	callback EventHandler
}

// PipelineStage represents a single stage in a source pipeline.
type PipelineStage struct {
	Name    string
	Adapter IJobSourceAdapter
	Filter  string // JSON filter
}

// NewSourcePipeline creates a new pipeline.
func NewSourcePipeline(name string, logger *zap.Logger) *SourcePipeline {
	return &SourcePipeline{
		name:    name,
		stages:  make([]PipelineStage, 0),
		logger:  logger,
	}
}

// AddStage appends a stage to the pipeline.
func (p *SourcePipeline) AddStage(stage PipelineStage) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.stages = append(p.stages, stage)
	p.logger.Debug("stage added to pipeline",
		zap.String("pipeline", p.name),
		zap.String("stage", stage.Name),
	)
}

// RunStage executes a single stage and returns the transformed payload.
// Returns nil if the filter rejects the event.
func (p *SourcePipeline) RunStage(ctx context.Context, stage PipelineStage, payload EventPayload) (*EventPayload, error) {
	if stage.Filter != "" && stage.Filter != "{}" {
		var f map[string]interface{}
		if err := json.Unmarshal([]byte(stage.Filter), &f); err == nil && len(f) > 0 {
			for key := range f {
				if _, ok := payload.Data[key]; !ok {
					return nil, nil // filtered out
				}
			}
		}
	}
	return &payload, nil
}

// Process executes all stages in order, returning the final payload.
// If any stage filters out the event, processing stops.
func (p *SourcePipeline) Process(ctx context.Context, payload EventPayload) (*EventPayload, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result := payload
	for i, stage := range p.stages {
		next, err := p.RunStage(ctx, stage, result)
		if err != nil {
			return nil, fmt.Errorf("stage %d (%s) failed: %w", i, stage.Name, err)
		}
		if next == nil {
			p.logger.Debug("event filtered by stage",
				zap.String("pipeline", p.name),
				zap.String("stage", stage.Name),
			)
			return nil, nil
		}
		result = *next
	}

	// Dispatch final result
	if p.callback != nil {
		if err := p.callback(ctx, result); err != nil {
			return nil, fmt.Errorf("pipeline callback failed: %w", err)
		}
	}
	return &result, nil
}

// SetCallback sets the final output handler.
func (p *SourcePipeline) SetCallback(h EventHandler) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.callback = h
	p.logger.Info("pipeline callback set", zap.String("pipeline", p.name))
}

// ---------------------------------------------------------------------------
// ChainExecutor — orchestrates chain execution
// ---------------------------------------------------------------------------

// ChainExecutor is responsible for executing a chain when an upstream event arrives.
// It traverses the chain links in order and dispatches events to downstream sources.
type ChainExecutor struct {
	composer  *SourceComposer
	dispatcher *Dispatcher
	logger    *zap.Logger
	mu        sync.RWMutex
}

// NewChainExecutor creates a chain executor.
func NewChainExecutor(composer *SourceComposer, dispatcher *Dispatcher, logger *zap.Logger) *ChainExecutor {
	return &ChainExecutor{
		composer:   composer,
		dispatcher: dispatcher,
		logger:     logger,
	}
}

// ExecuteChain triggers a chain by ID with an initial event payload.
// It walks the chain links in order and dispatches each downstream.
func (e *ChainExecutor) ExecuteChain(ctx context.Context, chainID string, payload EventPayload) error {
	links, ok := e.composer.GetLinks(chainID)
	if !ok {
		return fmt.Errorf("chain not found: %s", chainID)
	}

	e.logger.Info("executing chain",
		zap.String("chain_id", chainID),
		zap.Int("links", len(links)),
	)

	for i, link := range links {
		e.logger.Debug("executing chain link",
			zap.String("chain_id", chainID),
			zap.String("upstream", link.UpstreamID),
			zap.String("downstream", link.DownstreamID),
			zap.Int("step", i),
		)

		// Apply link filter if present
		if link.Filter != "" && link.Filter != "{}" {
			var f map[string]interface{}
			if err := json.Unmarshal([]byte(link.Filter), &f); err == nil && len(f) > 0 {
				pass := true
				for key := range f {
					if _, ok := payload.Data[key]; !ok {
						pass = false
						break
					}
				}
				if !pass {
					e.logger.Debug("event filtered by chain link",
						zap.String("chain_id", chainID),
						zap.String("downstream", link.DownstreamID),
					)
					break
				}
			}
		}

		// Dispatch to downstream
		payload.SourceID = link.DownstreamID
		if err := e.dispatcher.Dispatch(ctx, payload); err != nil {
			e.logger.Error("chain execution failed at link",
				zap.String("chain_id", chainID),
				zap.String("downstream", link.DownstreamID),
				zap.Int("step", i),
				zap.Error(err),
			)
			return fmt.Errorf("chain link %d failed: %w", i, err)
		}
	}

	e.logger.Info("chain execution complete",
		zap.String("chain_id", chainID),
	)
	return nil
}

// ---------------------------------------------------------------------------
// Compile-time checks
// ---------------------------------------------------------------------------

var _ SourceChainable = (*SourceComposer)(nil)

// SourceChainable is the interface for components that manage source chains.
type SourceChainable interface {
	ListChains() []models.JobSourceChain
}
