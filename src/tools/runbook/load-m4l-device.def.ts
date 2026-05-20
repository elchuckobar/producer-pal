// Producer Pal
// Copyright (C) 2026 Adam Murray
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { z } from "zod";
import { defineTool } from "#src/tools/shared/tool-framework/define-tool.ts";

export const toolDefLoadM4lDevice = defineTool("ppal-load-m4l-device", {
  title: "Load Max-for-Live Device Runbook",
  description:
    "Generate a deterministic computer-use step plan to load a Max-for-Live device (.amxd) from Live's browser onto a track via drag-and-drop. Returns JSON only - the caller executes via mcp__computer-use__*. After load, use ppal-read-track to confirm and ppal-update-device for macros/params.",

  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  },

  inputSchema: {
    deviceName: z
      .string()
      .min(1)
      .describe(
        "exact device name as listed in Live's browser (e.g. 'Max Audio Effect', or a user-library .amxd name)",
      ),
    category: z
      .enum(["max-audio-effect", "max-instrument", "max-midi-effect", "user"])
      .describe(
        "browser sub-category - 'user' for User Library .amxd's, otherwise the built-in slot",
      ),
    dropX: z.coerce
      .number()
      .int()
      .optional()
      .describe(
        "explicit drop x coordinate; default targets the first regular track header anchor",
      ),
    dropY: z.coerce
      .number()
      .int()
      .optional()
      .describe(
        "explicit drop y coordinate; default targets the first regular track header anchor",
      ),
    useArrangementView: z
      .boolean()
      .optional()
      .describe(
        "switch to Arrangement view first; default leaves current view",
      ),
    abletonLocale: z
      .enum(["de", "en", "unknown"])
      .optional()
      .describe(
        "advisory hint for meta.abletonLocale; pixel anchors are locale-agnostic",
      ),
  },

  smallModelModeConfig: {
    excludeParams: ["dropX", "dropY", "abletonLocale"],
  },
});
