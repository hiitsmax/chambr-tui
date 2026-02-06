import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EXIT_CODES } from "../cli/exit-codes";
import {
  createFixtureAdapter,
  FixtureReplayMissError,
  hashFixtureRequest,
  recordFixture,
  replayFixture,
} from "./fixtures";

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chambr-tui-fixtures-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("fixtures", () => {
  it("hashes equivalent requests deterministically", () => {
    const request = {
      model: "m1",
      messages: [{ role: "user" as const, content: "hello" }],
      temperature: 0.2,
    };
    const hashA = hashFixtureRequest(request);
    const hashB = hashFixtureRequest({ ...request });
    expect(hashA).toBe(hashB);
  });

  it("records and replays fixture entries", async () => {
    const baseDir = await makeTempDir();
    const request = {
      model: "m1",
      messages: [{ role: "user" as const, content: "hello" }],
      temperature: 0.2,
    };

    await recordFixture({ request, response: "world", fixtureName: "demo", baseDir });
    const replayed = await replayFixture({ request, fixtureName: "demo", baseDir });
    expect(replayed).toBe("world");
  });

  it("fails fast on replay miss", async () => {
    const baseDir = await makeTempDir();
    const adapter = await createFixtureAdapter({
      mode: "record",
      fixtureName: "demo",
      baseDir,
      generator: async () => "{}",
    });

    await adapter.generateText({
      model: "m1",
      messages: [{ role: "user", content: "one" }],
    });

    const replay = await createFixtureAdapter({
      mode: "replay",
      fixtureName: "demo",
      baseDir,
      generator: async () => "should-not-run",
    });

    await expect(
      replay.generateText({
        model: "m1",
        messages: [{ role: "user", content: "two" }],
      })
    ).rejects.toMatchObject({
      name: "FixtureReplayMissError",
      exitCode: EXIT_CODES.FIXTURE_REPLAY_MISS,
    } satisfies Partial<FixtureReplayMissError>);
  });
});
