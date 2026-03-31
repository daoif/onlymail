import assert from 'node:assert/strict'
import test from 'node:test'

import { extractDatabaseIdFromCreateOutput } from '../lib/d1-output'

test('extractDatabaseIdFromCreateOutput 能解析 wrangler 旧版等号输出', () => {
  const output = 'database_id = \"11111111-2222-3333-4444-555555555555\"'
  assert.equal(extractDatabaseIdFromCreateOutput(output), '11111111-2222-3333-4444-555555555555')
})

test('extractDatabaseIdFromCreateOutput 能解析 wrangler 新版 JSON 片段输出', () => {
  const output = `{
  \"d1_databases\": [
    {
      \"binding\": \"onlymail_db\",
      \"database_name\": \"onlymail-db\",
      \"database_id\": \"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\"
    }
  ]
}`
  assert.equal(extractDatabaseIdFromCreateOutput(output), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
})
