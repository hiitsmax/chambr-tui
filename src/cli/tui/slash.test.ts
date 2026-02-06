import { describe, expect, it } from "vitest";

import {
  completeSlashComposer,
  getSlashSuggestions,
  isSingleSlashCommandInput,
  tokenizeSlashInput,
} from "./slash";

describe("slash helpers", () => {
  it("tokenizes quoted values", () => {
    const tokens = tokenizeSlashInput('roomies add --name "Ava Stone" --bio "Strategist"');
    expect(tokens).toEqual(["roomies", "add", "--name", "Ava Stone", "--bio", "Strategist"]);
  });

  it("returns ordered command suggestions for prefix", () => {
    const suggestions = getSlashSuggestions("/ro");
    expect(suggestions[0]?.name).toBe("roomies");
  });

  it("autocompletes first command token", () => {
    const completed = completeSlashComposer("/cha", "chamber");
    expect(completed).toBe("/chamber ");
  });

  it("detects single command input", () => {
    expect(isSingleSlashCommandInput("/roomies")).toBe(true);
    expect(isSingleSlashCommandInput("/roomies list")).toBe(false);
  });
});
