import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createChamberRecord, addRoomieToChamber } from "./chamber-service";
import { runHeadless } from "./run";

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chambr-tui-run-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("runHeadless", () => {
  it("returns a versioned envelope with events and metrics", async () => {
    const baseDir = await makeTempDir();

    const chamber = await createChamberRecord(
      {
        id: "test-run",
        name: "Test Run",
        presetId: "balanced",
        baseDir,
      },
    );

    await addRoomieToChamber(
      {
        chamberId: chamber.id,
        name: "Ava",
        bio: "Strategic thinker",
        id: "r1",
        model: "test/model",
        baseDir,
      },
    );

    const mockGenerator = async (request: {
      trace?: { name?: string };
      model: string;
    }) => {
      const traceName = request.trace?.name || "";

      if (traceName.includes("director")) {
        return '{"beats":[{"agent_id":"r1","intent":"respond","allow_action":false,"allow_thought":false,"tone_hint":"balanced","max_events":1}]}';
      }

      if (traceName.includes("speaker")) {
        return '{"type":"speak","author":"Ava","content":"We should focus on one clear bet.","visibility":"public","intensity":2}';
      }

      if (traceName.includes("summarizer")) {
        return "Summary";
      }

      return '{"type":"speak","author":"Ava","content":"Fallback","visibility":"public","intensity":2}';
    };

    const result = await runHeadless(
      {
        prompt: "How should we position the launch?",
        chamberId: chamber.id,
        generateText: mockGenerator,
        fixtureMode: "live",
        logToStderr: false,
      },
      { baseDir }
    );

    expect(result.schemaVersion).toBe(1);
    expect(result.status).toBe("ok");
    expect(result.output?.events.length).toBeGreaterThan(0);
    expect(result.metrics?.eventCounts.speak).toBeGreaterThan(0);
    expect(result.output?.directorPlan.beats.length).toBe(1);
    expect(result.output?.stateRef.turnIndex).toBeGreaterThan(0);
  });
});
