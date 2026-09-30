import assert from 'node:assert/strict'
import { test } from 'node:test'

import { liveBlogPostsWhere } from './blogPublishSchedule.ts'
import { buildWhereSearchParams } from './buildWhereParams.ts'

test('liveBlogPostsWhere serializes publishStatus and pubDate (not [object Object])', () => {
  const asOf = new Date('2026-06-18T12:00:00.000Z')
  const params = buildWhereSearchParams({
    ...liveBlogPostsWhere(asOf),
    tenant: { equals: '15' },
  })

  assert.equal(params.get('where[publishStatus][equals]'), 'published')
  assert.equal(params.get('where[pubDate][less_than_equal]'), asOf.toISOString())
  assert.equal(params.get('where[tenant][equals]'), '15')
  assert.equal(params.toString().includes('[object Object]'), false)
})

test('scheduled and draft statuses are excluded by publishStatus=published filter', () => {
  const params = buildWhereSearchParams(liveBlogPostsWhere())
  assert.equal(params.get('where[publishStatus][equals]'), 'published')
  assert.equal(params.get('where[publishStatus][not_equals]'), null)
})
