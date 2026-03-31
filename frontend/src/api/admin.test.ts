import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('./client', () => ({
  apiRequest,
}))

import {
  batchDeleteDomains,
  bootstrapDomain,
  createSubdomain,
  getDomains,
  removePagesDomain,
} from './admin'

describe('admin api helpers', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('getDomains 会正确序列化查询参数', () => {
    getDomains('token-1', { type: 'root', limit: 20 })

    expect(apiRequest).toHaveBeenCalledWith('/api/domains?type=root&limit=20', {}, 'token-1')
  })

  it('bootstrapDomain 会发送 rootDomain body', () => {
    bootstrapDomain('token-2', 'example.com')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/domains/bootstrap',
      {
        method: 'POST',
        body: JSON.stringify({ rootDomain: 'example.com' }),
      },
      'token-2',
    )
  })

  it('createSubdomain 只发送完整域名', () => {
    createSubdomain('token-3', 'mail.example.com')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/domains',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'mail.example.com' }),
      },
      'token-3',
    )
  })

  it('batchDeleteDomains 会发送 names 数组', () => {
    batchDeleteDomains('token-5', ['m1.example.com', 'm2.example.com'])

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/domains/batch-delete',
      {
        method: 'POST',
        body: JSON.stringify({ names: ['m1.example.com', 'm2.example.com'] }),
      },
      'token-5',
    )
  })

  it('removePagesDomain 会编码域名参数', () => {
    removePagesDomain('token-4', 'onlymail.example.com')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/settings/pages-domains/onlymail.example.com',
      { method: 'DELETE' },
      'token-4',
    )
  })
})
