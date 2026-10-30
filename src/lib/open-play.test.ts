import { describe, expect, it } from "vitest";
import {
  defaultOpenPlayTitle,
  parseOpenPlayForm,
  parsePlayerNameList,
} from "@/lib/open-play";

describe("parsePlayerNameList", () => {
  it("keeps the first spelling and reports later copies", () => {
    expect(parsePlayerNameList("Ana, Ben\nana; Cara")).toEqual({
      names: ["Ana", "Ben", "Cara"],
      duplicates: ["ana"],
    });
  });

  it("ignores empty separators", () => {
    expect(parsePlayerNameList("  \n, ; A,,B ")).toEqual({
      names: ["A", "B"],
      duplicates: [],
    });
  });
});

describe("parseOpenPlayForm", () => {
  it("reads a limited singles session and drops duplicate names", () => {
    const form = new FormData();
    form.set("title", "  Monday Open Play  ");
    form.set("format", "singles");
    form.set("mode", "rated");
    form.set("duration", "limit");
    form.set("maxGameMinutes", "20");
    form.set("scoreTracking", "scores");
    form.set("gameLimit", "limit");
    form.set("playerGameLimit", "5");
    form.set("matching", "manual");
    form.set("playerNames", "Ana\nAna, Ben");

    expect(parseOpenPlayForm(form)).toEqual({
      title: "Monday Open Play",
      format: "singles",
      mode: "rated",
      maxGameMinutes: 20,
      scoreTracking: "scores",
      playerGameLimit: 5,
      matching: "manual",
      playerNames: ["Ana", "Ben"],
    });
  });

  it("defaults to doubles, balanced, no clock, and manual matching", () => {
    const setup = parseOpenPlayForm(new FormData());
    expect(setup).toMatchObject({
      title: "Open Play",
      format: "doubles",
      mode: "rotating",
      maxGameMinutes: null,
      scoreTracking: "winner",
      playerGameLimit: null,
      matching: "manual",
      playerNames: [],
    });
  });

  it("keeps auto matching when the form asks for it", () => {
    const form = new FormData();
    form.set("matching", "auto");
    expect(parseOpenPlayForm(form).matching).toBe("auto");
  });

  it("does not start Couple Hunt as singles", () => {
    const form = new FormData();
    form.set("format", "singles");
    form.set("mode", "couple_hunt");
    expect(parseOpenPlayForm(form).mode).toBe("rotating");
    expect(parseOpenPlayForm(form).format).toBe("singles");
  });
});

describe("defaultOpenPlayTitle", () => {
  it("uses the weekday in the venue timezone", () => {
    expect(
      defaultOpenPlayTitle("UTC", new Date("2026-10-26T15:00:00.000Z")),
    ).toBe("Monday Open Play");
  });
});
