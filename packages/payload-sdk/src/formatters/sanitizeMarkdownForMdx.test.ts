import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sanitizeMarkdownForMdx } from './sanitizeMarkdownForMdx.ts'

describe('sanitizeMarkdownForMdx', () => {
  it('removes WordPress block comments', () => {
    const input = `<!-- wp:paragraph -->
<p>Hello world</p>
<!-- /wp:paragraph -->`
    const out = sanitizeMarkdownForMdx(input)
    assert.match(out, /<p>Hello world<\/p>/)
    assert.doesNotMatch(out, /<!--/)
  })

  it('escapes stray less-than signs', () => {
    const out = sanitizeMarkdownForMdx('Use < 18 mg per day')
    assert.match(out, /&lt; 18 mg/)
  })

  it('keeps valid HTML tags', () => {
    const out = sanitizeMarkdownForMdx('<p><strong>Bold</strong> text</p>')
    assert.match(out, /<p><strong>Bold<\/strong> text<\/p>/)
  })
})
