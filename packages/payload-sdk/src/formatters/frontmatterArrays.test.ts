import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  coerceFrontmatterStringArray,
  normalizeFrontmatterArrayFields,
} from './frontmatterArrays.ts'

describe('frontmatterArrays', () => {
  it('coerces a single cssLinks string to an array', () => {
    assert.deepEqual(coerceFrontmatterStringArray('/assets/post.css'), ['/assets/post.css'])
  })

  it('coerces comma-separated cssLinks', () => {
    assert.deepEqual(coerceFrontmatterStringArray('/a.css, /b.css'), ['/a.css', '/b.css'])
  })

  it('normalizes cssLinks on a frontmatter object', () => {
    const data = { cssLinks: '/assets/post.css', title: 'Hello' }
    normalizeFrontmatterArrayFields(data)
    assert.deepEqual(data.cssLinks, ['/assets/post.css'])
    assert.equal(data.title, 'Hello')
  })
})
