#!/usr/bin/env node
/**
 * Replay CLI - Time-Travel Debugging Tool
 * Replays graph executions from checkpoints and activities
 *
 * Usage:
 *   npm run replay -- --trace <trace-id> [--to <step-index>] [--verify]
 */

import { parseArgs } from 'util';
import { PostgresCheckpointer } from '../checkpointer/postgres.js';
import { ActivityClientImpl } from '../activity/index.js';
import { ELGRuntime, type ExecutionResult } from '../runtime.js';
import { ActivityMode } from '../activity.js';
import { loadConfig } from '../../app/config.js';
import pino from 'pino';
import type { GraphDef } from '../node.js';

/**
 * CLI options
 */
interface ReplayOptions {
  traceId: string;
  toStep?: number;
  verify?: boolean;
  verbose?: boolean;
  compare?: string;
}

/**
 * Parse command-line arguments
 */
function parseCliArgs(): ReplayOptions {
  const { values } = parseArgs({
    options: {
      trace: {
        type: 'string',
        short: 't',
      },
      to: {
        type: 'string',
        short: 's',
      },
      verify: {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      verbose: {
        type: 'boolean',
        default: false,
      },
      compare: {
        type: 'string',
        short: 'c',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  });

  if (values.help) {
    console.log(`
Replay CLI - Time-Travel Debugging for CMO/ELG

Usage:
  npm run replay -- --trace <trace-id> [options]

Options:
  -t, --trace <id>      Trace ID to replay (required)
  -s, --to <step>       Replay up to this step index (optional)
  -v, --verify          Verify state hashes match original (default: false)
  -c, --compare <id>    Compare with another trace ID (step-by-step diff)
  --verbose             Enable verbose logging
  -h, --help            Show this help message

Examples:
  # Replay entire trace
  npm run replay -- --trace abc-123

  # Replay up to step 5
  npm run replay -- --trace abc-123 --to 5

  # Replay with state hash verification
  npm run replay -- --trace abc-123 --verify

  # Compare two traces
  npm run replay -- --trace abc-123 --compare xyz-789

  # Verbose mode with verification
  npm run replay -- --trace abc-123 --verify --verbose
    `);
    process.exit(0);
  }

  if (!values.trace) {
    console.error('Error: --trace is required');
    process.exit(1);
  }

  return {
    traceId: values.trace,
    toStep: values.to ? parseInt(values.to, 10) : undefined,
    verify: values.verify || false,
    verbose: values.verbose || false,
    compare: values.compare,
  };
}

/**
 * Main replay function
 */
async function replay(): Promise<void> {
  const options = parseCliArgs();

  // Initialize logger
  const logger = pino({
    level: options.verbose ? 'debug' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });

  logger.info({ traceId: options.traceId }, 'Starting replay');

  // Load configuration
  const config = loadConfig();

  // Initialize checkpointer
  const checkpointer = new PostgresCheckpointer({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    maxConnections: config.database.maxConnections,
  });

  await checkpointer.initialize();
  logger.debug('Checkpointer initialized');

  try {
    // Load original execution steps
    const originalSteps = await checkpointer.getAllSteps(options.traceId);

    if (originalSteps.length === 0) {
      logger.error({ traceId: options.traceId }, 'No steps found for trace');
      process.exit(1);
    }

    logger.info(
      { totalSteps: originalSteps.length },
      'Loaded original execution steps'
    );

    // Determine how many steps to replay
    const targetStepCount = options.toStep
      ? Math.min(options.toStep + 1, originalSteps.length)
      : originalSteps.length;

    logger.info(
      { replaySteps: targetStepCount, totalSteps: originalSteps.length },
      'Replaying steps'
    );

    // Load all activities for replay
    const allActivities = [];
    for (let i = 0; i < targetStepCount; i++) {
      const stepActivities = await checkpointer.getActivitiesForStep(
        options.traceId,
        i
      );

      allActivities.push(...stepActivities.map((a: any) => ({
        stepIndex: i,
        activityType: a.activityType,
        requestHash: a.requestHash,
        requestData: a.requestData,
        responseData: a.responseData,
        responseBlobRef: a.responseBlobRef,
        timestamp: new Date().toISOString(), // Not used in replay, but required
      })));
    }

    logger.debug(
      { activityCount: allActivities.length },
      'Loaded activities for replay'
    );

    // Create activity client in replay mode
    const activityClient = new ActivityClientImpl({
      mode: ActivityMode.REPLAY,
      traceId: options.traceId + '-replay',
      checkpointer,
      replayActivities: allActivities,
      logger,
    });

    logger.info('Activity client configured for replay mode');

    // Note: In a real scenario, we would need to reconstruct the original GraphDef
    // For now, we'll log a warning and provide instructions
    logger.warn(
      'Graph reconstruction not yet implemented. To complete replay:'
    );
    logger.warn('1. Load the GraphDef that was used for the original execution');
    logger.warn('2. Create an ELGRuntime with the replay activity client');
    logger.warn('3. Execute the graph and compare state hashes');

    // Display original execution summary
    console.log('\n=== Original Execution Summary ===\n');
    console.log(`Trace ID: ${options.traceId}`);
    console.log(`Total Steps: ${originalSteps.length}`);
    console.log(`Replaying: ${targetStepCount} steps`);
    console.log('');

    // Display step-by-step breakdown
    for (let i = 0; i < targetStepCount; i++) {
      const step = originalSteps[i];
      console.log(`Step ${step!.stepIndex}: ${step!.nodeId}`);
      console.log(`  State Hash: ${step!.stateHash.substring(0, 16)}...`);
      console.log(`  Duration: ${step!.durationMs}ms`);

      if (step!.error) {
        console.log(`  ❌ Error: ${step!.error.message}`);
      } else {
        console.log(`  ✅ Success → ${step!.nextEdge || 'END'}`);
      }

      console.log('');
    }

    // Compare mode
    if (options.compare) {
      logger.info({ compareTraceId: options.compare }, 'Comparison mode enabled');

      // Load comparison trace steps
      const compareSteps = await checkpointer.getAllSteps(options.compare);

      if (compareSteps.length === 0) {
        logger.error({ traceId: options.compare }, 'Comparison trace not found');
        throw new Error(`Comparison trace ${options.compare} not found`);
      }

      logger.info(
        { trace1Steps: originalSteps.length, trace2Steps: compareSteps.length },
        'Loaded comparison trace'
      );

      // Compare step-by-step
      console.log('\n=== Trace Comparison ===\n');
      console.log(`Trace 1: ${options.traceId} (${originalSteps.length} steps)`);
      console.log(`Trace 2: ${options.compare} (${compareSteps.length} steps)`);
      console.log('');

      const maxSteps = Math.max(originalSteps.length, compareSteps.length);

      console.log('Step | Trace 1 Hash         | Trace 2 Hash         | Match  | Node');
      console.log('-----|----------------------|----------------------|--------|------------');

      for (let i = 0; i < maxSteps; i++) {
        const step1 = originalSteps[i];
        const step2 = compareSteps[i];

        if (!step1) {
          console.log(
            `${i.toString().padStart(4)} | ${'(missing)'.padEnd(20)} | ${step2!.stateHash.substring(0, 20)} | ❌     | ${step2!.nodeId}`
          );
        } else if (!step2) {
          console.log(
            `${i.toString().padStart(4)} | ${step1.stateHash.substring(0, 20)} | ${'(missing)'.padEnd(20)} | ❌     | ${step1.nodeId}`
          );
        } else {
          const match = step1.stateHash === step2.stateHash;
          const matchSymbol = match ? '✅' : '❌';
          console.log(
            `${i.toString().padStart(4)} | ${step1.stateHash.substring(0, 20)} | ${step2.stateHash.substring(0, 20)} | ${matchSymbol}     | ${step1.nodeId} / ${step2.nodeId}`
          );
        }
      }

      console.log('');

      // Summary
      let matchCount = 0;
      const minSteps = Math.min(originalSteps.length, compareSteps.length);
      for (let i = 0; i < minSteps; i++) {
        if (originalSteps[i]!.stateHash === compareSteps[i]!.stateHash) {
          matchCount++;
        }
      }

      const matchPercentage = minSteps > 0 ? ((matchCount / minSteps) * 100).toFixed(1) : '0';

      console.log(`Matching steps: ${matchCount} / ${minSteps} (${matchPercentage}%)`);
      console.log('');

      if (matchCount === minSteps && originalSteps.length === compareSteps.length) {
        console.log('✅ Traces are identical!');
      } else {
        console.log('❌ Traces differ');
      }

      console.log('');
    }

    // Verification mode
    if (options.verify) {
      logger.info('Verification mode enabled');
      logger.warn('State hash verification requires graph re-execution (not yet implemented)');

      // Future: Re-execute graph and verify state hashes
      // const runtime = new ELGRuntime({ activityClient, checkpointer });
      // const replayResult = await runtime.execute(graph, traceId + '-replay');
      //
      // for (let i = 0; i < targetStepCount; i++) {
      //   const original = originalSteps[i];
      //   const replayed = replayResult.steps[i];
      //
      //   if (original.stateHash !== replayed.stateHash) {
      //     logger.error({ step: i, original: original.stateHash, replayed: replayed.stateHash },
      //       'State hash mismatch!');
      //   } else {
      //     logger.debug({ step: i }, 'State hash verified');
      //   }
      // }

      console.log('\n⚠️  Full verification requires graph definition (future enhancement)\n');
    }

    logger.info('Replay completed successfully');
  } catch (error) {
    logger.error({ error }, 'Replay failed');
    throw error;
  } finally {
    await checkpointer.close();
    logger.debug('Checkpointer closed');
  }
}

/**
 * Main entrypoint
 */
async function main(): Promise<void> {
  try {
    await replay();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { replay, type ReplayOptions };
