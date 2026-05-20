// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordArrangement } from "../record-arrangement.ts";

describe("ppal-record-arrangement runbook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("minimal flow opens with Tab, clicks Record, ends with Stop + screenshot", () => {
    const result = recordArrangement({});
    const labels = result.steps.map((s) => s.label);

    expect(labels[0]).toBe("ensure Arrangement view");
    expect(labels).toContain("click Record button");
    expect(labels).toContain("stop transport");
    expect(labels.at(-1)).toBe("anchor: final state after record + save");
  });

  it("view='session' skips the Tab step", () => {
    const result = recordArrangement({ view: "session" });
    const labels = result.steps.map((s) => s.label);

    expect(labels).not.toContain("ensure Arrangement view");
    expect(labels[0]).toBe("click Record button");
  });

  it("homeBeforeRecord pushes Home key before record click", () => {
    const result = recordArrangement({ homeBeforeRecord: true });
    const labels = result.steps.map((s) => s.label);
    const homeIdx = labels.indexOf("reset Insert Marker to 1.1.1");
    const recordIdx = labels.indexOf("click Record button");

    expect(homeIdx).toBeGreaterThanOrEqual(0);
    expect(homeIdx).toBeLessThan(recordIdx);
  });

  it("durationSeconds=2 inserts a 2s wait between record and stop", () => {
    const result = recordArrangement({ durationSeconds: 2 });
    const recordIdx = result.steps.findIndex(
      (s) => s.label === "click Record button",
    );
    const stopIdx = result.steps.findIndex((s) => s.label === "stop transport");
    const waitStep = result.steps
      .slice(recordIdx, stopIdx)
      .find((s) => s.action === "wait" && s.duration === 2);

    expect(waitStep).toBeTruthy();
  });

  it("saveAfter='save' adds cmd+s after the stop", () => {
    const result = recordArrangement({ saveAfter: "save" });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("Save Set (cmd+s)");
  });

  it("saveAfter='save-as' with savePath uses cmd+shift+s + save-dialog pattern", () => {
    const result = recordArrangement({
      saveAfter: "save-as",
      savePath: "/Users/x/sets/take-001.als",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("Save Set As (cmd+shift+s)");
    expect(labels).toContain("type filename take-001.als");
    expect(labels).toContain("type parent directory /Users/x/sets");
  });

  it("saveAfter='save-as' without savePath warns and notes the missing path", async () => {
    const consoleModule = await import("#src/shared/v8-max-console.ts");
    const warn = vi.spyOn(consoleModule, "warn").mockImplementation(() => {});

    const result = recordArrangement({ saveAfter: "save-as" });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("saveAfter='save-as' requires savePath"),
    );
    expect(
      result.meta.notes.some((n) => n.startsWith("savePath missing")),
    ).toBe(true);
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("Save Set As (cmd+shift+s)");
    expect(labels.some((l) => l.startsWith("type parent directory"))).toBe(
      false,
    );
    warn.mockRestore();
  });

  it("saveAfter='none' produces no save-key steps", () => {
    const result = recordArrangement({ saveAfter: "none" });
    const labels = result.steps.map((s) => s.label);

    expect(labels.some((l) => l.startsWith("Save Set"))).toBe(false);
  });

  it("failModes covers at least 8 distinct symptoms", () => {
    const result = recordArrangement({});

    expect(result.failModes.length).toBeGreaterThanOrEqual(8);
    const symptoms = new Set(result.failModes.map((f) => f.symptom));

    expect(symptoms.size).toBe(result.failModes.length);
  });

  it("verify schema reports transportShouldBeStopped true and setDirty based on save mode", () => {
    const noSave = recordArrangement({ saveAfter: "none" });

    expect(noSave.verify).toStrictEqual({
      transportShouldBeStopped: true,
      setDirty: true,
    });
    const withSave = recordArrangement({ saveAfter: "save" });

    expect(withSave.verify.setDirty).toBe(false);
  });

  it("meta carries tool name, version, abletonLocale default, estimatedSeconds", () => {
    const r = recordArrangement({ durationSeconds: 3, saveAfter: "save" });

    expect(r.meta.tool).toBe("ppal-record-arrangement");
    expect(r.meta.version).toBe("1.0.0");
    expect(r.meta.abletonLocale).toBe("unknown");
    expect(r.meta.estimatedSeconds).toBeGreaterThan(3);
  });

  it("step order: Tab BEFORE Record, Record BEFORE Stop, Stop BEFORE Save", () => {
    const result = recordArrangement({
      view: "arrangement",
      saveAfter: "save",
    });
    const labels = result.steps.map((s) => s.label);
    const tabIdx = labels.indexOf("ensure Arrangement view");
    const recordIdx = labels.indexOf("click Record button");
    const stopIdx = labels.indexOf("stop transport");
    const saveIdx = labels.indexOf("Save Set (cmd+s)");

    expect(tabIdx).toBeLessThan(recordIdx);
    expect(recordIdx).toBeLessThan(stopIdx);
    expect(stopIdx).toBeLessThan(saveIdx);
  });
});
