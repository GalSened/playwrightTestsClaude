/**
 * ELG Runtime - Deterministic Graph Executor
 * Executes event loop graphs with checkpointing and replay support
 */

import type {
  GraphDef,
  NodeDef,
  EdgeDef,
  NodeResult,
  NodeContext,
  EdgeKey,
} from './node.js';
import type { ActivityClient, ActivityMode } from './activity.js';
import { createHash } from 'crypto';

/**
 * Execution status
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  ABORTED = 'aborted',
}

/**
 * Step execution record
 */
export interface StepRecord {
  stepIndex: number;
  nodeId: string;
  stateHash: string;
  inputHash: string;
  outputHash: string;
  nextEdge: EdgeKey | null;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Execution result
 */
export interface ExecutionResult<State = Record<string, unknown>> {
  traceId: string;
  status: ExecutionStatus;
  finalState: State;
  stateHash: string;
  steps: StepRecord[];
  startedAt: number;
  completedAt: number;
  durationMs: number;
  error?: {
    message: string;
    code?: string;
    nodeId?: string;
    stepIndex?: number;
  };
}

/**
 * Checkpointer interface
 */
export interface Checkpointer {
  saveRun(traceId: string, graphId: string, graphVersion: string): Promise<void>;
  saveStep(traceId: string, step: StepRecord): Promise<void>;
  updateRunStatus(traceId: string, status: ExecutionStatus, error?: string): Promise<void>;
  getLastStep(traceId: string): Promise<StepRecord | null>;
  getAllSteps(traceId: string): Promise<StepRecord[]>;
  saveActivity(
    traceId: string,
    stepIndex: number,
    activityType: string,
    requestHash: string,
    requestData: unknown,
    responseData: unknown | undefined,
    responseBlobRef: string | undefined,
    timestamp: string,
    durationMs: number | undefined,
    error: { message: string; stack?: string } | undefined
  ): Promise<void>;
  getActivitiesForStep(traceId: string, stepIndex: number): Promise<unknown[]>;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  /**
   * Activity client for I/O operations
   */
  activityClient: ActivityClient;

  /**
   * Checkpointer for persistence
   */
  checkpointer: Checkpointer;

  /**
   * Maximum step duration in milliseconds
   */
  maxStepDurationMs?: number;

  /**
   * Maximum total execution time in milliseconds
   */
  maxExecutionTimeMs?: number;

  /**
   * Enable state hash verification
   */
  verifyStateHashes?: boolean;

  /**
   * Checkpoint after every N steps (default: 1)
   */
  checkpointInterval?: number;
}

/**
 * ELG Runtime
 * Executes graphs deterministically with checkpointing
 */
export class ELGRuntime<State = Record<string, unknown>> {
  private config: Required<RuntimeConfig>;
  private nodeMap: Map<string, NodeDef<State>> = new Map();
  private edgeMap: Map<string, EdgeDef[]> = new Map();

  constructor(config: RuntimeConfig) {
    this.config = {
      maxStepDurationMs: 30000,
      maxExecutionTimeMs: 600000,
      verifyStateHashes: true,
      checkpointInterval: 1,
      ...config,
    };
  }

  /**
   * Execute a graph
   */
  async execute(
    graph: GraphDef<State>,
    traceId: string,
    initialInput?: unknown
  ): Promise<ExecutionResult<State>> {
    const startedAt = Date.now();
    const steps: StepRecord[] = [];

    try {
      // Build node and edge maps
      this.buildMaps(graph);

      // Save run to checkpointer
      await this.config.checkpointer.saveRun(traceId, graph.id, graph.version);

      // Check if resuming from checkpoint
      const lastStep = await this.config.checkpointer.getLastStep(traceId);
      let currentState: State;
      let currentNodeId: string;
      let currentInput: unknown;
      let stepIndex: number;

      if (lastStep) {
        // Resume from checkpoint
        const resumedSteps = await this.config.checkpointer.getAllSteps(traceId);
        steps.push(...resumedSteps);
        stepIndex = lastStep.stepIndex + 1;

        // Reconstruct state from steps (in real impl, would replay activities)
        currentState = graph.initialState();
        currentNodeId = this.findNextNode(lastStep.nodeId, lastStep.nextEdge);
        currentInput = null; // Would come from last step output
      } else {
        // Fresh execution
        currentState = graph.initialState();
        currentNodeId = graph.entryNode;
        currentInput = initialInput;
        stepIndex = 0;
      }

      // Execution loop
      while (currentNodeId) {
        // Check timeout
        if (Date.now() - startedAt > this.config.maxExecutionTimeMs) {
          throw new Error(
            `Execution timeout after ${this.config.maxExecutionTimeMs}ms`
          );
        }

        // Execute step
        const stepResult = await this.executeStep(
          graph,
          traceId,
          stepIndex,
          currentNodeId,
          currentState,
          currentInput
        );

        steps.push(stepResult);

        // Checkpoint
        if (stepIndex % this.config.checkpointInterval === 0) {
          await this.config.checkpointer.saveStep(traceId, stepResult);
        }

        // Check for errors
        if (stepResult.error) {
          throw new Error(stepResult.error.message);
        }

        // Update for next iteration
        stepIndex++;
        currentNodeId = this.findNextNode(stepResult.nodeId, stepResult.nextEdge);

        // Note: In real implementation, would deserialize output from step
        currentInput = null;
      }

      // Execution completed
      const completedAt = Date.now();
      await this.config.checkpointer.updateRunStatus(traceId, ExecutionStatus.COMPLETED);

      return {
        traceId,
        status: ExecutionStatus.COMPLETED,
        finalState: currentState,
        stateHash: this.hashState(currentState),
        steps,
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
      };
    } catch (error) {
      const completedAt = Date.now();
      await this.config.checkpointer.updateRunStatus(
        traceId,
        ExecutionStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        traceId,
        status: ExecutionStatus.FAILED,
        finalState: graph.initialState(),
        stateHash: '',
        steps,
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_FAILED',
        },
      };
    }
  }

  /**
   * Execute a single step (node)
   */
  private async executeStep(
    graph: GraphDef<State>,
    traceId: string,
    stepIndex: number,
    nodeId: string,
    state: State,
    input: unknown
  ): Promise<StepRecord> {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const startedAt = Date.now();

    try {
      // Create node context
      const context: NodeContext = {
        traceId,
        stepIndex,
        nodeId,
        graph,
        startTime: startedAt,
      };

      // Execute node with timeout
      const timeout = node.timeout || this.config.maxStepDurationMs;
      const result = await this.executeWithTimeout(
        node.fn(state, input),
        timeout,
        `Node ${nodeId} timeout after ${timeout}ms`
      );

      const completedAt = Date.now();

      // Compute hashes
      const stateHash = this.hashState(result.state);
      const inputHash = this.hashValue(input);
      const outputHash = this.hashValue(result.output);

      return {
        stepIndex,
        nodeId,
        stateHash,
        inputHash,
        outputHash,
        nextEdge: result.next,
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
      };
    } catch (error) {
      const completedAt = Date.now();

      return {
        stepIndex,
        nodeId,
        stateHash: this.hashState(state),
        inputHash: this.hashValue(input),
        outputHash: '',
        nextEdge: null,
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'NODE_EXECUTION_FAILED',
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Hash state for determinism verification
   */
  private hashState(state: State): string {
    const json = JSON.stringify(state, Object.keys(state).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Hash any value
   */
  private hashValue(value: unknown): string {
    const json = JSON.stringify(value);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Build node and edge maps for fast lookup
   */
  private buildMaps(graph: GraphDef<State>): void {
    this.nodeMap.clear();
    this.edgeMap.clear();

    // Build node map
    for (const node of graph.nodes) {
      this.nodeMap.set(node.id, node);
    }

    // Build edge map (grouped by source node)
    for (const edge of graph.edges) {
      if (!this.edgeMap.has(edge.from)) {
        this.edgeMap.set(edge.from, []);
      }
      this.edgeMap.get(edge.from)!.push(edge);
    }
  }

  /**
   * Find next node based on edge key
   */
  private findNextNode(fromNodeId: string, edgeKey: EdgeKey | null): string {
    if (!edgeKey) {
      return ''; // Execution terminates
    }

    const edges = this.edgeMap.get(fromNodeId) || [];
    const edge = edges.find((e) => e.key === edgeKey);

    if (!edge) {
      throw new Error(
        `Edge not found: ${edgeKey} from node ${fromNodeId}`
      );
    }

    return edge.to;
  }

  /**
   * Abort execution
   */
  async abort(traceId: string): Promise<void> {
    await this.config.checkpointer.updateRunStatus(
      traceId,
      ExecutionStatus.ABORTED
    );
  }

  /**
   * Get execution status
   */
  async getStatus(traceId: string): Promise<{
    status: ExecutionStatus;
    steps: StepRecord[];
  }> {
    const steps = await this.config.checkpointer.getAllSteps(traceId);
    // In real impl, would query run status from checkpointer
    const status = steps.length > 0 ? ExecutionStatus.RUNNING : ExecutionStatus.PENDING;

    return { status, steps };
  }
}
