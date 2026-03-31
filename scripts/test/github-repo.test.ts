import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeGithubRepoForTest } from '../lib/github-repo'

test('normalizeGithubRepoForTest 能解析 https remote', () => {
  assert.equal(normalizeGithubRepoForTest('https://github.com/daoif/onlymail-test.git'), 'daoif/onlymail-test')
})

test('normalizeGithubRepoForTest 能解析 ssh remote', () => {
  assert.equal(normalizeGithubRepoForTest('git@github.com:daoif/onlymail-test.git'), 'daoif/onlymail-test')
})

test('normalizeGithubRepoForTest 对非 github remote 返回空字符串', () => {
  assert.equal(normalizeGithubRepoForTest('https://example.com/daoif/onlymail-test.git'), '')
})
