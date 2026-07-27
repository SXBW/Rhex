import assert from "node:assert/strict"
import test from "node:test"

import {
  getDefaultSidebarCollapsed,
  getSidebarNavigationStorageKey,
} from "../src/lib/sidebar-navigation-preference"

test("docked sidebar modes use independent persisted preferences", () => {
  assert.notEqual(
    getSidebarNavigationStorageKey("DOCKED"),
    getSidebarNavigationStorageKey("DEFAULT"),
  )
  assert.notEqual(
    getSidebarNavigationStorageKey("DOCKED_OPEN"),
    getSidebarNavigationStorageKey("DOCKED"),
  )
})

test("docked mode defaults closed while docked-open defaults open", () => {
  assert.equal(getDefaultSidebarCollapsed("DOCKED"), true)
  assert.equal(getDefaultSidebarCollapsed("DOCKED_OPEN"), false)
  assert.equal(getDefaultSidebarCollapsed("DEFAULT"), false)
})
