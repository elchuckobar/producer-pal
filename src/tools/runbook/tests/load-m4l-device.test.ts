// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { loadM4lDevice } from "../load-m4l-device.ts";

describe("ppal-load-m4l-device runbook", () => {
  it("default recipe ends with Escape after the drop", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
    });
    const last = result.steps.at(-1);

    expect(last).toMatchObject({ action: "key", text: "Escape" });
  });

  it("explicit dropX/dropY override the default target", () => {
    const result = loadM4lDevice({
      deviceName: "MyDevice",
      category: "user",
      dropX: 700,
      dropY: 500,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("drag to drop target [700, 500]");
  });

  it("default dropTarget uses the first regular track anchor", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
    });
    const labels = result.steps.map((s) => s.label);
    const dropLabel = labels.find((l) => l.startsWith("drag to drop target"));

    expect(dropLabel).toBe("drag to drop target [415, 400]");
  });

  it("useArrangementView=true prepends a Tab step", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
      useArrangementView: true,
    });

    expect(result.steps[0]).toMatchObject({
      action: "key",
      text: "Tab",
    });
  });

  it("useArrangementView omitted produces no Tab step", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
    });

    expect(result.steps[0]).not.toMatchObject({ text: "Tab" });
  });

  it("category='max-audio-effect' clicks the Max for Live category", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain(
      "click Max for Live category (filter max-audio-effect)",
    );
  });

  it("category='user' clicks the User Library entry instead", () => {
    const result = loadM4lDevice({
      deviceName: "MyCustomReverb",
      category: "user",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("click User Library category");
    expect(labels.some((l) => l.startsWith("click Max for Live"))).toBe(false);
  });

  it("failModes covers 8+ distinct symptoms", () => {
    const result = loadM4lDevice({
      deviceName: "Max Audio Effect",
      category: "max-audio-effect",
    });

    expect(result.failModes.length).toBeGreaterThanOrEqual(8);
    const symptoms = new Set(result.failModes.map((f) => f.symptom));

    expect(symptoms.size).toBe(result.failModes.length);
  });

  it("verify echoes back the deviceName the caller asked for", () => {
    const result = loadM4lDevice({
      deviceName: "Max MIDI Effect",
      category: "max-midi-effect",
    });

    expect(result.verify).toStrictEqual({
      deviceShouldExist: true,
      expectedDeviceName: "Max MIDI Effect",
    });
  });

  it("meta carries tool, version, locale default, estimatedSeconds", () => {
    const r = loadM4lDevice({
      deviceName: "Foo",
      category: "user",
    });

    expect(r.meta.tool).toBe("ppal-load-m4l-device");
    expect(r.meta.version).toBe("1.0.0");
    expect(r.meta.abletonLocale).toBe("unknown");
    expect(r.meta.estimatedSeconds).toBeGreaterThan(0);
  });

  it("step order: category-click BEFORE search, search BEFORE drag, drag-up BEFORE final screenshot", () => {
    const result = loadM4lDevice({
      deviceName: "Test",
      category: "max-instrument",
    });
    const labels = result.steps.map((s) => s.label);
    const categoryIdx = labels.findIndex((l) =>
      l.startsWith("click Max for Live"),
    );
    const searchIdx = labels.indexOf("open browser search");
    const downIdx = labels.indexOf("begin drag pickup");
    const upIdx = labels.indexOf("release drop");
    const finalScreenshotIdx = labels.indexOf(
      "anchor: device should now exist on target track",
    );

    expect(categoryIdx).toBeLessThan(searchIdx);
    expect(searchIdx).toBeLessThan(downIdx);
    expect(downIdx).toBeLessThan(upIdx);
    expect(upIdx).toBeLessThan(finalScreenshotIdx);
  });

  it("Playbook §2 settle timing: 0.55s wait between mouse-down and first move", () => {
    const result = loadM4lDevice({
      deviceName: "Test",
      category: "max-instrument",
    });
    const downIdx = result.steps.findIndex(
      (s) => s.label === "begin drag pickup",
    );
    const nextWait = result.steps[downIdx + 1];

    expect(nextWait).toMatchObject({
      action: "wait",
      duration: 0.55,
    });
  });

  it("deviceName surfaces verbatim in the type step label", () => {
    const result = loadM4lDevice({
      deviceName: "SuperSpecialPlugin v2",
      category: "user",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("filter by name 'SuperSpecialPlugin v2'");
  });
});
