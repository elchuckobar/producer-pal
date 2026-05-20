// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderExport } from "../render-export.ts";

describe("ppal-render-export runbook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("default WAV recipe starts with cmd+shift+r and ends with save+wait+screenshot", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/Users/x/out/mix-001.wav",
    });

    expect(result.steps[0]).toMatchObject({
      action: "key",
      text: "cmd+shift+r",
    });
    const last = result.steps.at(-1);

    expect(last).toMatchObject({ action: "screenshot" });
    const beforeLast = result.steps.at(-2);

    expect(beforeLast).toMatchObject({ action: "wait" });
  });

  it("WAV recipe contains the WAV row click", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("pick Datei-Typ WAV");
  });

  it("AIFF recipe explicitly clicks the AIFF row even though it is default", () => {
    const result = renderExport({
      format: "aiff",
      destPath: "/tmp/mix.aif",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("pick Datei-Typ AIFF");
  });

  it("FLAC recipe clicks the FLAC row", () => {
    const result = renderExport({
      format: "flac",
      destPath: "/tmp/mix.flac",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("pick Datei-Typ FLAC");
  });

  it("MP3 recipe toggles PCM off and MP3 on, no Datei-Typ row click", () => {
    const result = renderExport({
      format: "mp3",
      destPath: "/tmp/mix.mp3",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle PCM-Encodierung -> Aus");
    expect(labels).toContain("toggle MP3-Encodierung -> An");
    expect(labels.some((l) => l.startsWith("pick Datei-Typ "))).toBe(false);
  });

  it("MP3 + bitDepth emits a warning note and ignores bitDepth", async () => {
    const consoleModule = await import("#src/shared/v8-max-console.ts");
    const warn = vi.spyOn(consoleModule, "warn").mockImplementation(() => {});
    const result = renderExport({
      format: "mp3",
      destPath: "/tmp/mix.mp3",
      bitDepth: 24,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("bitDepth ignored for mp3"),
    );
    expect(result.meta.notes).toContain(
      "bitDepth ignored: mp3 is fixed CBR 320",
    );
    const labels = result.steps.map((s) => s.label);

    expect(labels.some((l) => l.startsWith("open Bit-Tiefe"))).toBe(false);
    warn.mockRestore();
  });

  it("MP3 + dither='none' warns and ignores (mp3 has no dither stage)", async () => {
    const consoleModule = await import("#src/shared/v8-max-console.ts");
    const warn = vi.spyOn(consoleModule, "warn").mockImplementation(() => {});

    const result = renderExport({
      format: "mp3",
      destPath: "/tmp/mix.mp3",
      dither: "none",
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("dither ignored for mp3"),
    );
    expect(result.meta.notes).toContain(
      "dither ignored: only applies to PCM formats",
    );
    warn.mockRestore();
  });

  it("PCM (wav) + dither='none' emits the Dither dropdown sequence", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      dither: "none",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("open Dither dropdown");
    expect(labels).toContain("pick Dither 'No Dither' via visible list row");
  });

  it("PCM + dither omitted leaves the Dither dropdown alone (default Triangular)", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).not.toContain("open Dither dropdown");
  });

  it("PCM + dither='default' is equivalent to omitting it (no Dither step)", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      dither: "default",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).not.toContain("open Dither dropdown");
  });

  it("destPath ending with '/' throws", () => {
    expect(() =>
      renderExport({ format: "wav", destPath: "/Users/x/out/" }),
    ).toThrow(/destPath/);
  });

  it("normalize=true emits the Normalisieren toggle step", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      normalize: true,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle Normalisieren -> An");
  });

  it("mono=true emits the In Mono konvertieren toggle step", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      mono: true,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle In Mono konvertieren -> An");
  });

  it("createAnalysisFile=false toggles off (default is on)", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      createAnalysisFile: false,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle Analyse-Datei erzeugen -> Aus");
  });

  it("createAnalysisFile=true emits NO step (matches default)", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      createAnalysisFile: true,
    });
    const labels = result.steps.map((s) => s.label);

    expect(
      labels.some((l) => l.startsWith("toggle Analyse-Datei erzeugen")),
    ).toBe(false);
  });

  it("renderStart triggers focus + select + type + Tab", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      renderStart: "1.1.1",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("focus Rendering-Start");
    expect(labels).toContain("select Rendering-Start value");
    expect(labels).toContain("type Rendering-Start 1.1.1");
    expect(labels).toContain("commit Rendering-Start");
  });

  it("renderLength triggers focus + select + type + Tab", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
      renderLength: "8.0.0",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("focus Rendering-Laenge");
    expect(labels).toContain("type Rendering-Laenge 8.0.0");
  });

  it("absent renderStart/renderLength produces no field steps", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/mix.wav",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels.some((l) => l.startsWith("focus Rendering-"))).toBe(false);
  });

  it("save dialog uses Cmd+Shift+G + Cmd+A + type filename pattern", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/Users/x/out/mix.wav",
    });

    const cmdShiftG = result.steps.find(
      (s) => s.action === "key" && s.text === "cmd+shift+g",
    );

    expect(cmdShiftG).toBeTruthy();
    const cmdA = result.steps.find(
      (s) => s.action === "key" && s.text === "cmd+a",
    );

    expect(cmdA).toBeTruthy();
    const typeFilename = result.steps.find(
      (s) => s.action === "type" && s.label === "type filename mix.wav",
    );

    expect(typeFilename).toBeTruthy();
  });

  it("save dialog uses correct parent dir for nested path", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/Users/x/out/mix.wav",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("type parent directory /Users/x/out");
  });

  it("destPath without slash uses '.' as parent dir", () => {
    const result = renderExport({
      format: "wav",
      destPath: "mix.wav",
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("type parent directory .");
    expect(labels).toContain("type filename mix.wav");
  });

  it("failModes always lists 8+ entries for PCM and 9+ for MP3", () => {
    const wav = renderExport({ format: "wav", destPath: "/tmp/m.wav" });

    expect(wav.failModes.length).toBeGreaterThanOrEqual(8);
    const mp3 = renderExport({ format: "mp3", destPath: "/tmp/m.mp3" });

    expect(mp3.failModes.length).toBeGreaterThan(wav.failModes.length);
  });

  it("verify checks include destPath, extension, minBytes", () => {
    const wav = renderExport({ format: "wav", destPath: "/tmp/m.wav" });

    expect(wav.verify).toStrictEqual({
      destPath: "/tmp/m.wav",
      expectedExtension: "wav",
      minBytes: 1024,
    });
    const aif = renderExport({ format: "aiff", destPath: "/tmp/m.aif" });

    expect(aif.verify.expectedExtension).toBe("aif");
    const mp3 = renderExport({ format: "mp3", destPath: "/tmp/m.mp3" });

    expect(mp3.verify.expectedExtension).toBe("mp3");
  });

  it("meta carries tool name, version, locale default, and estimatedSeconds > 0", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
    });

    expect(result.meta.tool).toBe("ppal-render-export");
    expect(result.meta.version).toBe("1.0.0");
    expect(result.meta.abletonLocale).toBe("unknown");
    expect(result.meta.estimatedSeconds).toBeGreaterThan(0);
  });

  it("meta.abletonLocale echoes back caller hint", () => {
    const de = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
      abletonLocale: "de",
    });

    expect(de.meta.abletonLocale).toBe("de");
    const en = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
      abletonLocale: "en",
    });

    expect(en.meta.abletonLocale).toBe("en");
  });

  it("includeReturnsAndMaster=true emits its toggle", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
      includeReturnsAndMaster: true,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle Mit Return- & Master-Effekten -> An");
  });

  it("asLoop=true emits its toggle", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
      asLoop: true,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("toggle Als Loop rendern -> An");
  });

  it("bitDepth on a PCM format opens the Bit-Tiefe dropdown with a screenshot follow-up", () => {
    const result = renderExport({
      format: "wav",
      destPath: "/tmp/m.wav",
      bitDepth: 24,
    });
    const labels = result.steps.map((s) => s.label);

    expect(labels).toContain("open Bit-Tiefe dropdown");
    expect(labels).toContain("pick Bit-Tiefe 24 via visible list row");
    expect(
      result.meta.notes.some((n) => n.includes("bitDepth row click")),
    ).toBe(true);
  });
});
