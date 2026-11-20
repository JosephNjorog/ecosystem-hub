import { test } from 'vitest'
import assert from 'node:assert/strict'
import { eventVisibility } from '@/app/(site)/events/_lib/status'

test('eventVisibility: the event status decides listing', () => {
  assert.equal(eventVisibility('published', null), 'listed')
  assert.equal(eventVisibility('unlisted', null), 'link')
  assert.equal(eventVisibility('draft', null), 'hidden')
  assert.equal(eventVisibility('archived', null), 'hidden')
})

test('eventVisibility: a published hackathon keeps its event reachable by link, whatever the event status', () => {
  // Before the fix a draft/archived event 404'd while join/submit kept working.
  assert.equal(eventVisibility('draft', 'published'), 'link')
  assert.equal(eventVisibility('archived', 'published'), 'link')
  assert.equal(eventVisibility('unlisted', 'published'), 'link')
  assert.equal(eventVisibility('published', 'published'), 'listed')
})

test('eventVisibility: a draft hackathon never makes a hidden event reachable', () => {
  assert.equal(eventVisibility('draft', 'draft'), 'hidden')
  assert.equal(eventVisibility('archived', 'draft'), 'hidden')
  assert.equal(eventVisibility('unlisted', 'draft'), 'link')
})
