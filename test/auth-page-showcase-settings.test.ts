import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeAuthPageShowcaseSettings,
  resolveAuthPageShowcaseSettings,
} from "../src/lib/site-settings-app-state.registration"

test("auth page showcase settings persist independent display text", () => {
  const appStateJson = mergeAuthPageShowcaseSettings(null, {
    enabled: false,
    text: "  Community Focus  ",
  })

  assert.deepEqual(resolveAuthPageShowcaseSettings({ appStateJson }), {
    enabled: false,
    text: "Community Focus",
  })
})

test("auth page showcase text supports legacy state and remains bounded", () => {
  const legacyState = JSON.stringify({ authPageShowcase: { enabled: true } })
  assert.deepEqual(resolveAuthPageShowcaseSettings({
    appStateJson: legacyState,
    textFallback: "Site Name",
  }), {
    enabled: true,
    text: "Site Name",
  })

  const longText = "x".repeat(160)
  const appStateJson = mergeAuthPageShowcaseSettings(null, {
    enabled: true,
    text: longText,
  })
  assert.equal(resolveAuthPageShowcaseSettings({ appStateJson }).text, "x".repeat(120))
})
