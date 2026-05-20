// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import * as console from "#src/shared/v8-max-console.ts";
import {
  appendDialogOpen,
  appendFileTypeSelection,
  appendRenderRange,
  appendSaveDialog,
  appendToggleIfDiffers,
  RENDER_DIALOG_ANCHORS,
  type RunbookStep,
} from "./helpers/build-render-steps.ts";

interface RenderExportArgs {
  format: "wav" | "aiff" | "flac" | "mp3";
  destPath: string;
  bitDepth?: number;
  renderStart?: string;
  renderLength?: string;
  includeReturnsAndMaster?: boolean;
  asLoop?: boolean;
  mono?: boolean;
  normalize?: boolean;
  createAnalysisFile?: boolean;
  dither?: "default" | "none";
  abletonLocale?: "de" | "en" | "unknown";
}

interface FailMode {
  symptom: string;
  detect: string;
  recovery: string;
}

interface VerifyChecks {
  destPath: string;
  expectedExtension: string;
  minBytes: number;
}

interface RenderExportResult {
  steps: RunbookStep[];
  failModes: FailMode[];
  verify: VerifyChecks;
  meta: {
    tool: "ppal-render-export";
    version: "1.0.0";
    abletonLocale: "de" | "en" | "unknown";
    estimatedSeconds: number;
    notes: string[];
  };
}

const TOOL_VERSION = "1.0.0";

// Conservative wall-clock estimate. Real renders typically finish faster but
// this padding keeps the wait step from racing the save dialog.
const BASE_RENDER_SECONDS = 6;

/**
 * Build a deterministic computer-use runbook for Ableton's Export Audio/Video
 * dialog. No Live API or filesystem touch. Output is a pure function of the
 * args - safe to test as plain JSON.
 * @param args - Render parameters.
 * @returns Step plan, fail modes, post-render verify checks, and meta.
 */
export function renderExport(args: RenderExportArgs): RenderExportResult {
  const notes: string[] = [];
  const steps: RunbookStep[] = [];

  if (args.format === "mp3" && args.bitDepth != null) {
    console.warn(
      "ppal-render-export: bitDepth ignored for mp3 (CBR 320 is fixed)",
    );
    notes.push("bitDepth ignored: mp3 is fixed CBR 320");
  }

  if (
    args.format === "mp3" &&
    args.dither != null &&
    args.dither !== "default"
  ) {
    console.warn("ppal-render-export: dither ignored for mp3");
    notes.push("dither ignored: only applies to PCM formats");
  }

  if (args.destPath.endsWith("/")) {
    throw new Error(
      "ppal-render-export: destPath must include a filename, not end with '/'",
    );
  }

  appendDialogOpen(steps);

  // Render range fields ship first - they sit at the top of the dialog and
  // do not depend on other state.
  appendRenderRange(steps, {
    renderStart: args.renderStart,
    renderLength: args.renderLength,
  });

  appendToggleIfDiffers(steps, {
    name: "Mit Return- & Master-Effekten",
    anchor: RENDER_DIALOG_ANCHORS.toggleReturnsMaster,
    desired: args.includeReturnsAndMaster ?? false,
    defaultState: false,
  });
  appendToggleIfDiffers(steps, {
    name: "Als Loop rendern",
    anchor: RENDER_DIALOG_ANCHORS.toggleAsLoop,
    desired: args.asLoop ?? false,
    defaultState: false,
  });
  appendToggleIfDiffers(steps, {
    name: "In Mono konvertieren",
    anchor: RENDER_DIALOG_ANCHORS.toggleMono,
    desired: args.mono ?? false,
    defaultState: false,
  });
  appendToggleIfDiffers(steps, {
    name: "Normalisieren",
    anchor: RENDER_DIALOG_ANCHORS.toggleNormalize,
    desired: args.normalize ?? false,
    defaultState: false,
  });
  // createAnalysisFile defaults to An in Live; only emit a step if turning off.
  appendToggleIfDiffers(steps, {
    name: "Analyse-Datei erzeugen",
    anchor: RENDER_DIALOG_ANCHORS.toggleAnalysisFile,
    desired: args.createAnalysisFile ?? true,
    defaultState: true,
  });

  appendFileTypeSelection(steps, { format: args.format });

  if (args.format !== "mp3" && args.dither === "none") {
    // Live's PCM dither dropdown defaults to Triangular. Clicking it opens the
    // persistent list (same Live-quirk as Datei-Typ). Without per-row anchors
    // captured in recon, we leave the row click as a screenshot prompt.
    steps.push({
      action: "left_click",
      coordinate: RENDER_DIALOG_ANCHORS.ditherDropdown,
      label: "open Dither dropdown",
    });
    steps.push({
      action: "screenshot",
      label: "pick Dither 'No Dither' via visible list row",
    });
    notes.push(
      "dither row click left to screenshot-driven follow-up (recon did not capture per-row y offsets)",
    );
  }

  if (args.format !== "mp3" && args.bitDepth != null) {
    // For now we open the dropdown header; downstream callers can adopt the
    // same persistent-dropdown click pattern as fileType. Without explicit
    // list-row anchors, we leave the row click as a screenshot prompt so the
    // caller's vision pass picks it up. This deliberate "human-in-the-loop"
    // escape hatch is documented in the spec under R3.
    steps.push({
      action: "left_click",
      coordinate: RENDER_DIALOG_ANCHORS.bitDepthDropdown,
      label: "open Bit-Tiefe dropdown",
    });
    steps.push({
      action: "screenshot",
      label: `pick Bit-Tiefe ${args.bitDepth} via visible list row`,
    });
    notes.push(
      "bitDepth row click left to screenshot-driven follow-up (recon did not capture per-row y offsets)",
    );
  }

  appendSaveDialog(steps, { destPath: args.destPath });

  steps.push({
    action: "wait",
    duration: BASE_RENDER_SECONDS,
    label: "wait for Live to finish the render",
  });
  steps.push({
    action: "screenshot",
    label: "anchor: render done / save dialog cleared",
  });

  return {
    steps,
    failModes: buildFailModes(args.format),
    verify: {
      destPath: args.destPath,
      expectedExtension: expectedExtensionForFormat(args.format),
      minBytes: 1024,
    },
    meta: {
      tool: "ppal-render-export",
      version: TOOL_VERSION,
      abletonLocale: args.abletonLocale ?? "unknown",
      estimatedSeconds: BASE_RENDER_SECONDS + 1,
      notes,
    },
  };
}

/**
 * Static fail-mode catalogue. Identical for every format - the recovery hints
 * are advisory and consumed by the caller's higher-level retry logic.
 * @param format - Selected output format.
 * @returns Array of fail-mode descriptors.
 */
function buildFailModes(format: "wav" | "aiff" | "flac" | "mp3"): FailMode[] {
  const failModes: FailMode[] = [
    {
      symptom: "dialog does not open",
      detect: "screenshot after step 2 lacks the export dialog title",
      recovery:
        "verify Live has focus, retry cmd+shift+r; if still missing, run ppal-connect to ensure Producer Pal is bound",
    },
    {
      symptom: "file-type dropdown stays open after row click",
      detect: "screenshot shows multi-row dropdown still expanded",
      recovery:
        "click the desired row again - never press Escape (Live ignores it for this dropdown)",
    },
    {
      symptom: "macOS save dialog never appears",
      detect: "no native file sheet within 1.5 s of Exportieren click",
      recovery:
        "render range may resolve to 0.0.0 - set renderLength explicitly or check Insert Marker / Loop bracket",
    },
    {
      symptom: "file-exists overwrite prompt",
      detect: "modal sheet between save dialog and render start",
      recovery:
        "abort run, rename destPath, restart ppal-render-export with a fresh filename",
    },
    {
      symptom: "Live beta render-engine warning",
      detect: "modal sheet titled 'Bounce engine' or similar",
      recovery:
        "do NOT auto-click; surface to user, this changes the render engine semantics",
    },
    {
      symptom: "parent directory does not exist",
      detect:
        "save dialog shows 'Pfad existiert nicht' / 'Path does not exist'",
      recovery:
        "create the directory out of band, then re-run; the recipe deliberately does not mkdir",
    },
    {
      symptom: "pixel anchors miss due to UI scaling",
      detect:
        "first dialog-open screenshot shows the dialog but click on Exportieren misses",
      recovery:
        "user is on a non-standard backbuffer; rerun with abletonLocale='unknown' and let caller re-target via screenshot",
    },
    {
      symptom: "render output silent or wrong duration",
      detect:
        "verify.minBytes passes but ffprobe reports 0 samples / wrong dur",
      recovery:
        "renderStart vs renderLength inconsistency; reopen Live set and rerun with explicit values",
    },
  ];

  if (format === "mp3") {
    failModes.push({
      symptom: "PCM file also created next to MP3",
      detect: "two files in destPath dir after render",
      recovery:
        "PCM-Encodierung toggle did not flip to Aus; rerun and verify the toggle step",
    });
  }

  return failModes;
}

/**
 * Map format enum to filename extension Live writes.
 * @param format - Selected output format.
 * @returns Lowercase extension without leading dot.
 */
function expectedExtensionForFormat(
  format: "wav" | "aiff" | "flac" | "mp3",
): string {
  return format === "aiff" ? "aif" : format;
}
