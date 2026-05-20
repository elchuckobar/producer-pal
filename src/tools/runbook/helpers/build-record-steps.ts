// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Atomic step in a computer-use runbook. Mirrors mcp__computer-use__* tool
 * names so the caller can dispatch them with no translation.
 */
export type RunbookStep =
  | { action: "key"; text: string; label: string }
  | { action: "wait"; duration: number; label: string }
  | { action: "left_click"; coordinate: [number, number]; label: string }
  | { action: "type"; text: string; label: string }
  | { action: "screenshot"; label: string };

/**
 * Live's transport-bar pixel anchors. Captured during the Welle-3 recon pass
 * on 2026-05-20 against a 1366x860 Live 12 backbuffer on macOS. The transport
 * bar layout does not shift between DE and EN, so these anchors are
 * locale-agnostic.
 */
export const TRANSPORT_BAR_ANCHORS = {
  // The record button sits between play (left) and stop (right) in the
  // transport bar. Clicking it arms arrangement-record-on-play.
  recordButton: [621, 63] as [number, number],
} as const;

interface RecordOptions {
  durationSeconds?: number;
  view?: "arrangement" | "session";
  homeBeforeRecord?: boolean;
  saveAfter?: "none" | "save" | "save-as";
  savePath?: string;
}

/**
 * Build the arrangement-record runbook step list. Mutates `steps` in place.
 * Pre-conditions (armed tracks, insert-marker position) are not the recipe's
 * responsibility - the caller provides them via ppal-update-track and
 * ppal-playback.
 * @param steps - Step array being built.
 * @param opts - Record options.
 */
export function appendRecordArrangementSteps(
  steps: RunbookStep[],
  opts: RecordOptions,
): void {
  const view = opts.view ?? "arrangement";

  if (view === "arrangement") {
    steps.push({
      action: "key",
      text: "Tab",
      label: "ensure Arrangement view",
    });
  }

  if (opts.homeBeforeRecord) {
    steps.push({
      action: "key",
      text: "Home",
      label: "reset Insert Marker to 1.1.1",
    });
  }

  steps.push({
    action: "left_click",
    coordinate: TRANSPORT_BAR_ANCHORS.recordButton,
    label: "click Record button",
  });
  steps.push({
    action: "wait",
    duration: 0.15,
    label: "settle record start",
  });
  steps.push({
    action: "screenshot",
    label: "anchor: record started (lamp should be red)",
  });

  if (opts.durationSeconds != null) {
    steps.push({
      action: "wait",
      duration: opts.durationSeconds,
      label: `record for ${opts.durationSeconds}s`,
    });
  }

  steps.push({
    action: "key",
    text: "space",
    label: "stop transport",
  });
  steps.push({
    action: "wait",
    duration: 0.2,
    label: "settle stop",
  });

  appendSaveStep(steps, opts);

  steps.push({
    action: "screenshot",
    label: "anchor: final state after record + save",
  });
}

/**
 * Split an absolute or relative .als path into parent dir + filename. No
 * filesystem access - pure string utility.
 * @param savePath - Full path including filename and extension.
 * @returns Object with dir and name.
 */
export function splitSavePath(savePath: string): {
  dir: string;
  name: string;
} {
  const lastSlash = savePath.lastIndexOf("/");

  if (lastSlash < 0) {
    return { dir: ".", name: savePath };
  }

  const dir = savePath.slice(0, lastSlash);
  const name = savePath.slice(lastSlash + 1);

  return { dir: dir.length === 0 ? "/" : dir, name };
}

/**
 * Append the save step matching the saveAfter mode. Falls back to a warn-
 * note path when save-as is requested without savePath.
 * @param steps - Step array being built.
 * @param opts - Record options (only saveAfter/savePath consulted).
 */
function appendSaveStep(steps: RunbookStep[], opts: RecordOptions): void {
  const saveAfter = opts.saveAfter ?? "none";

  if (saveAfter === "save") {
    steps.push({
      action: "key",
      text: "cmd+s",
      label: "Save Set (cmd+s)",
    });
    steps.push({
      action: "wait",
      duration: 0.4,
      label: "settle save",
    });

    return;
  }

  if (saveAfter === "save-as") {
    steps.push({
      action: "key",
      text: "cmd+shift+s",
      label: "Save Set As (cmd+shift+s)",
    });

    if (opts.savePath != null) {
      appendSaveDialogPathInput(steps, opts.savePath);
    }
  }
}

/**
 * Append the macOS save-dialog "Go To Folder" + filename overwrite sequence.
 * Used after a cmd+shift+s has been pressed.
 * @param steps - Step array being built.
 * @param savePath - Absolute or relative file path.
 */
function appendSaveDialogPathInput(
  steps: RunbookStep[],
  savePath: string,
): void {
  const { dir, name } = splitSavePath(savePath);

  steps.push({
    action: "wait",
    duration: 0.5,
    label: "wait for macOS save dialog",
  });
  steps.push({
    action: "key",
    text: "cmd+shift+g",
    label: "open Gehe zu Ordner",
  });
  steps.push({
    action: "wait",
    duration: 0.2,
    label: "wait for goto-folder sheet",
  });
  steps.push({
    action: "type",
    text: dir,
    label: `type parent directory ${dir}`,
  });
  steps.push({
    action: "key",
    text: "Return",
    label: "commit parent directory",
  });
  steps.push({
    action: "wait",
    duration: 0.3,
    label: "wait for save dialog focus return",
  });
  steps.push({
    action: "key",
    text: "cmd+a",
    label: "select existing filename",
  });
  steps.push({
    action: "type",
    text: name,
    label: `type filename ${name}`,
  });
  steps.push({
    action: "key",
    text: "Return",
    label: "save Set",
  });
}
