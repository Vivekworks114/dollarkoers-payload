import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { quoteYamlScalar } from './yamlQuote.ts'

describe('quoteYamlScalar', () => {
  it('quotes pure numeric strings so YAML keeps them as strings', () => {
    assert.equal(quoteYamlScalar('123'), '"123"')
    assert.equal(quoteYamlScalar('2024'), '"2024"')
  })

  it('leaves true/false unquoted for Astro boolean schemas (e.g. draft)', () => {
    assert.equal(quoteYamlScalar('true'), 'true')
    assert.equal(quoteYamlScalar('false'), 'false')
  })

  it('quotes null-like and dates', () => {
    assert.equal(quoteYamlScalar('null'), '"null"')
    assert.equal(quoteYamlScalar('2024-09-23'), '"2024-09-23"')
  })

  it('leaves normal slugs unquoted', () => {
    assert.equal(
      quoteYamlScalar('de-kernprincipes-van-een-wealth-mindset'),
      'de-kernprincipes-van-een-wealth-mindset',
    )
  })
})
