import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveAiSuggestionNeeds,
  shouldContinueAfterAiSuggestionError,
} from "../src/components/post/use-create-post-ai-assist"

test("AI tag extraction failures remain optional when board selection is manual", () => {
  const tagOnlyNeeds = resolveAiSuggestionNeeds({
    canUseAutoBoardSelection: false,
    canUseAiTagExtraction: true,
    boardSelectionMode: "manual",
  })

  assert.deepEqual(tagOnlyNeeds, {
    needBoard: false,
    needTags: true,
  })
  assert.equal(shouldContinueAfterAiSuggestionError(tagOnlyNeeds), true)
})

test("AI board selection failures still block until a board is available", () => {
  const boardNeeds = resolveAiSuggestionNeeds({
    canUseAutoBoardSelection: true,
    canUseAiTagExtraction: true,
    boardSelectionMode: "auto",
  })

  assert.deepEqual(boardNeeds, {
    needBoard: true,
    needTags: true,
  })
  assert.equal(shouldContinueAfterAiSuggestionError(boardNeeds), false)
})

test("manual fallback skips AI entirely when board auto-selection is available", () => {
  assert.deepEqual(resolveAiSuggestionNeeds({
    canUseAutoBoardSelection: true,
    canUseAiTagExtraction: true,
    boardSelectionMode: "manual",
  }), {
    needBoard: false,
    needTags: false,
  })
})
