/**
 * Node interface for ELG (Event Loop Graph)
 * Nodes are pure functions that transform state and determine next steps
 */

/**
 * Edge key identifies the next node to transition to
 */
export type EdgeKey = string;

/**
 * Node execution result
 */
export interface NodeResult<State = Record<string, unknown>> {
  /**
   * Updated state after node execution
   */
  state: State;

  /**
   * Output data from this node (can be passed to next node)
   */
  output: unknown;

  /**
   * Edge key to determine next node
   * If null/undefined, execution terminates
   */
  next: EdgeKey | null;

  /**
   * Optional metadata for debugging/telemetry
   */
  metadata?: {
    /**
     * Human-readable description of what happened
     */
    description?: string;

    /**
     * Tags for categorization
     */
    tags?: string[];

    /**
     * Custom metrics
     */
    metrics?: Record<string, number>;
  };
}

/**
 * Node function signature
 * MUST be pure and deterministic - no side effects allowed
 * All I/O must go through ActivityClient
 */
export interface NodeFn<State = Record<string, unknown>, Input = unknown> {
  /**
   * Execute the node logic
   *
   * @param state - Current graph state
   * @param input - Input data from previous node
   * @returns Promise resolving to NodeResult
   */
  (state: State, input: Input): Promise<NodeResult<State>>;
}

/**
 * Node definition in the graph
 */
export interface NodeDef<State = Record<string, unknown>> {
  /**
   * Unique node identifier
   */
  id: string;

  /**
   * Human-readable node name
   */
  name: string;

  /**
   * Node execution function
   */
  fn: NodeFn<State>;

  /**
   * Optional timeout in milliseconds
   * Defaults to global ELG_MAX_STEP_DURATION_MS
   */
  timeout?: number;

  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum retry attempts
     */
    maxAttempts: number;

    /**
     * Backoff strategy
     */
    backoff?: 'exponential' | 'linear' | 'constant';

    /**
     * Initial delay in milliseconds
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds
     */
    maxDelay?: number;
  };

  /**
   * Validation schema for input (optional)
   */
  inputSchema?: unknown; // ajv schema

  /**
   * Validation schema for output (optional)
   */
  outputSchema?: unknown; // ajv schema
}

/**
 * Edge definition in the graph
 */
export interface EdgeDef {
  /**
   * Edge key (used in next field of NodeResult)
   */
  key: EdgeKey;

  /**
   * Source node ID
   */
  from: string;

  /**
   * Target node ID
   */
  to: string;

  /**
   * Optional edge condition (for dynamic routing)
   */
  condition?: (state: Record<string, unknown>, output: unknown) => boolean;

  /**
   * Optional metadata
   */
  metadata?: {
    description?: string;
    tags?: string[];
  };
}

/**
 * Graph definition
 */
export interface GraphDef<State = Record<string, unknown>> {
  /**
   * Unique graph identifier
   */
  id: string;

  /**
   * Graph version (for schema evolution)
   */
  version: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Entry node ID
   */
  entryNode: string;

  /**
   * All nodes in the graph
   */
  nodes: NodeDef<State>[];

  /**
   * All edges in the graph
   */
  edges: EdgeDef[];

  /**
   * Initial state factory
   */
  initialState: () => State;

  /**
   * Optional metadata
   */
  metadata?: {
    owner?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
  };
}

/**
 * Execution context for a node
 */
export interface NodeContext {
  /**
   * Current trace ID
   */
  traceId: string;

  /**
   * Current step index
   */
  stepIndex: number;

  /**
   * Node ID being executed
   */
  nodeId: string;

  /**
   * Graph definition
   */
  graph: GraphDef;

  /**
   * Start time of current step
   */
  startTime: number;

  /**
   * Previous node ID (if any)
   */
  previousNodeId?: string;

  /**
   * Previous edge key (if any)
   */
  previousEdge?: EdgeKey;
}
