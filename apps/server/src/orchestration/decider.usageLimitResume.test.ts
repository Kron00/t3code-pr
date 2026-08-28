import {
  CommandId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationReadModel,
  type OrchestrationThread,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const FIRST_ATTEMPT = "1970-01-01T00:05:00.000Z";
const SECOND_ATTEMPT = "1970-01-01T00:20:00.000Z";

function makeReadModel(
  usageLimitResume: OrchestrationThread["usageLimitResume"] = null,
): OrchestrationReadModel {
  return {
    snapshotSequence: 0,
    projects: [],
    threads: [
      {
        id: ThreadId.make("thread-1"),
        projectId: ProjectId.make("project-1"),
        title: "Thread",
        modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        usageLimitResume,
        deletedAt: null,
        messages: [],
        proposedPlans: [],
        activities: [],
        checkpoints: [],
        session: null,
      },
    ],
    updatedAt: NOW,
  };
}

it.layer(NodeServices.layer)("usage-limit resume decider", (it) => {
  it.effect("schedules, attempts, and paces a retry", () =>
    Effect.gen(function* () {
      const scheduled = yield* decideOrchestrationCommand({
        command: {
          type: "thread.usage-limit-resume.schedule",
          commandId: CommandId.make("cmd-schedule"),
          threadId: ThreadId.make("thread-1"),
          resumeAt: FIRST_ATTEMPT,
        },
        readModel: makeReadModel(),
      });
      const scheduledEvents = Array.isArray(scheduled) ? scheduled : [scheduled];
      const scheduledEvent = scheduledEvents[0];
      expect(scheduledEvents).toHaveLength(1);
      if (scheduledEvent?.type !== "thread.usage-limit-resume-scheduled") {
        return;
      }
      expect(scheduledEvent.payload).toMatchObject({ resumeAt: FIRST_ATTEMPT, attempt: 0 });

      const attempted = yield* decideOrchestrationCommand({
        command: {
          type: "thread.usage-limit-resume.attempt",
          commandId: CommandId.make("cmd-attempt"),
          threadId: ThreadId.make("thread-1"),
          expectedAttemptAt: FIRST_ATTEMPT,
          createdAt: FIRST_ATTEMPT,
        },
        readModel: makeReadModel({ nextAttemptAt: FIRST_ATTEMPT, attempt: 0 }),
      });
      const attemptedEvents = Array.isArray(attempted) ? attempted : [attempted];
      const attemptedEvent = attemptedEvents[0];
      expect(attemptedEvents).toHaveLength(1);
      if (attemptedEvent?.type !== "thread.usage-limit-resume-attempted") {
        return;
      }
      expect(attemptedEvent.payload.shouldResume).toBe(true);

      const retried = yield* decideOrchestrationCommand({
        command: {
          type: "thread.usage-limit-resume.retry",
          commandId: CommandId.make("cmd-retry"),
          threadId: ThreadId.make("thread-1"),
          resumeAt: SECOND_ATTEMPT,
          attempt: 0,
          createdAt: FIRST_ATTEMPT,
        },
        readModel: makeReadModel({ nextAttemptAt: null, attempt: 0 }),
      });
      const retriedEvents = Array.isArray(retried) ? retried : [retried];
      const retriedEvent = retriedEvents[0];
      expect(retriedEvents).toHaveLength(1);
      if (retriedEvent?.type !== "thread.usage-limit-resume-scheduled") {
        return;
      }
      expect(retriedEvent.payload).toMatchObject({ resumeAt: SECOND_ATTEMPT, attempt: 1 });
    }),
  );

  it.effect("ignores a stale timer and clears automatic resume on a manual turn", () =>
    Effect.gen(function* () {
      const staleAttempt = yield* decideOrchestrationCommand({
        command: {
          type: "thread.usage-limit-resume.attempt",
          commandId: CommandId.make("cmd-stale"),
          threadId: ThreadId.make("thread-1"),
          expectedAttemptAt: FIRST_ATTEMPT,
          createdAt: SECOND_ATTEMPT,
        },
        readModel: makeReadModel({ nextAttemptAt: SECOND_ATTEMPT, attempt: 1 }),
      });
      const staleEvents = Array.isArray(staleAttempt) ? staleAttempt : [staleAttempt];
      const staleEvent = staleEvents[0];
      expect(staleEvents).toHaveLength(1);
      if (staleEvent?.type !== "thread.usage-limit-resume-attempted") {
        return;
      }
      expect(staleEvent.payload.shouldResume).toBe(false);

      const manualTurn = yield* decideOrchestrationCommand({
        command: {
          type: "thread.turn.start",
          commandId: CommandId.make("cmd-manual-turn"),
          threadId: ThreadId.make("thread-1"),
          message: {
            messageId: MessageId.make("message-1"),
            role: "user",
            text: "Try now",
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: NOW,
        },
        readModel: makeReadModel({ nextAttemptAt: SECOND_ATTEMPT, attempt: 1 }),
      });
      const events = Array.isArray(manualTurn) ? manualTurn : [manualTurn];
      expect(events.some((event) => event.type === "thread.usage-limit-resume-cancelled")).toBe(
        true,
      );
      expect(events.some((event) => event.type === "thread.turn-start-requested")).toBe(true);
    }),
  );
});
