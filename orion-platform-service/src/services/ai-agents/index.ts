/**
 * AI Agents Service
 *
 * Autonomous AI agents for pipeline optimization, release notes generation,
 * performance optimization, and monitoring. All agents extend BaseAgent
 * and use AIGateway for LLM calls.
 *
 * Available agents:
 * - PipelineYamlAgent: Pipeline YAML optimization and validation
 * - ReleaseNotesAgent: Automatic release notes generation
 * - PerfOptAgent: Performance optimization recommendations
 */

// Base classes and types
export { BaseAgent } from './base/BaseAgent';
export { ToolAdapter, ToolDefinition, ToolResult, ToolHandler } from './base/ToolAdapter';
export {
  AgentConfig,
  AgentRetryConfig,
  AgentExecutionContext,
  AgentAuditLog,
  AgentTokenUsage,
  AgentCapability,
  AgentStatus,
  AgentInfo,
  BuiltInToolName,
} from './base/types';

// Concrete agents
export { PipelineYamlAgent } from './pipeline/PipelineYamlAgent';
export { ReleaseNotesAgent } from './release/ReleaseNotesAgent';
export { PerfOptAgent } from './performance/PerfOptAgent';

// Agent-specific types
export { ReleaseNotesConfig, ReleaseNotesOutput } from './release/types';
export { PerfOptConfig, PerfOptResult } from './performance/types';
export { StabilityConfig, StabilityCheckResult } from './stability/types';
