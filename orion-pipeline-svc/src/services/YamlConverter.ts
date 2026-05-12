/**
 * YamlConverter - Convert between pipeline YAML and JSON graph formats.
 *
 * Provides bidirectional conversion between:
 * - Pipeline YAML spec (user-facing format)
 * - JSON graph format (frontend DAG visualization format)
 */

import * as yaml from 'js-yaml';
import { PipelineGraphBuilder, GraphNode, PipelineGraph } from './PipelineGraphBuilder';
import { PipelineValidator } from './PipelineValidator';

export interface YamlToJsonResult {
  graph: PipelineGraph;
  validation: { valid: boolean; errors: any[]; warnings: any[] };
}

export interface JsonToYamlResult {
  yaml: string;
  validation: { valid: boolean; errors: any[]; warnings: any[] };
}

/**
 * YamlConverter provides bidirectional conversion between YAML pipeline specs
 * and JSON graph representations.
 */
export class YamlConverter {
  private graphBuilder: PipelineGraphBuilder;
  private validator: PipelineValidator;

  constructor() {
    this.graphBuilder = new PipelineGraphBuilder();
    this.validator = new PipelineValidator();
  }

  /**
   * Convert YAML pipeline spec to JSON graph format.
   * Also validates the YAML during conversion.
   *
   * @param yamlString - Pipeline YAML definition
   */
  yamlToJson(yamlString: string): YamlToJsonResult {
    // Validate first
    const validation = this.validator.validate(yamlString);

    // Build graph regardless of validation (errors reported separately)
    const graph = this.graphBuilder.buildGraphFromYaml(yamlString);

    return { graph, validation };
  }

  /**
   * Convert JSON graph back to YAML pipeline spec.
   *
   * @param graph - Pipeline graph object
   */
  jsonToYaml(graph: PipelineGraph): JsonToYamlResult {
    const stages = this.graphToStages(graph);

    const spec = {
      apiVersion: 'v1',
      kind: 'Pipeline',
      metadata: {
        name: graph.pipelineId || 'pipeline',
      },
      spec: {
        stages,
      },
    };

    const yamlString = yaml.dump(spec, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    // Validate the regenerated YAML
    const validation = this.validator.validate(yamlString);

    return { yaml: yamlString, validation };
  }

  /**
   * Convert graph nodes back to stage definitions.
   */
  private graphToStages(graph: PipelineGraph): Array<Record<string, any>> {
    const stageNodes = graph.nodes.filter(n => n.type === 'stage');
    const taskNodes = graph.nodes.filter(n => n.type === 'task');

    return stageNodes.map(stageNode => {
      const stage: Record<string, any> = {
        name: stageNode.name,
      };

      const metadata = stageNode.metadata || {};
      if (metadata.runsOn) stage.runsOn = metadata.runsOn;
      if (metadata.type) stage.type = metadata.type;
      if (metadata.condition) stage.if = metadata.condition;
      if (metadata.timeout) stage.timeout = metadata.timeout;
      if (metadata.retries !== undefined) stage.retries = metadata.retries;
      if (metadata.parallel) stage.parallel = metadata.parallel;
      if (metadata.config) stage.config = metadata.config;
      if (metadata.matrix) stage.matrix = metadata.matrix;
      if (metadata.env) stage.env = metadata.env;
      if (metadata.outputs) stage.outputs = metadata.outputs;

      // Add dependsOn (only stage-level dependencies)
      const stageDeps = stageNode.dependsOn.filter(depId =>
        graph.nodes.some(n => n.id === depId && n.type === 'stage')
      );
      if (stageDeps.length > 0) {
        // Map IDs back to stage names
        stage.dependsOn = stageDeps.map(depId => {
          const depNode = graph.nodes.find(n => n.id === depId);
          return depNode?.name || depId;
        });
      }

      // Attach tasks as steps
      const tasksForStage = taskNodes.filter(task =>
        task.dependsOn.includes(stageNode.id)
      );
      if (tasksForStage.length > 0) {
        stage.steps = tasksForStage.map(task => ({
          name: task.name,
          ...(task.metadata?.uses ? { uses: task.metadata.uses } : {}),
          ...(task.metadata?.with && Object.keys(task.metadata.with).length > 0
            ? { with: task.metadata.with }
            : {}),
        }));
      }

      return stage;
    });
  }
}
