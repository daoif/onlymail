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
  checkVersionState,
  createSubdomain,
  dismissVersionUpdateOnce,
  getDomainLifecycleSettings,
  getDomains,
  getVersionState,
  logout,
  removePagesDomain,
  setVersionNotifications,
  updateDomainLifecycleSettings,
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

  it('createSubdomain 默认创建长期子域名', () => {
    createSubdomain('token-3', 'mail.example.com')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/domains',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'mail.example.com', subdomainType: 'permanent' }),
      },
      'token-3',
    )
  })

  it('createSubdomain 支持创建临时子域名', () => {
    createSubdomain('token-11', 'tmp.example.com', 'temporary')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/domains',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'tmp.example.com', subdomainType: 'temporary' }),
      },
      'token-11',
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

  it('getVersionState 会请求设置页版本状态', () => {
    getVersionState('token-6')

    expect(apiRequest).toHaveBeenCalledWith('/api/settings/version', {}, 'token-6')
  })

  it('checkVersionState 会手动触发检查', () => {
    checkVersionState('token-7')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/settings/version/check',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      'token-7',
    )
  })

  it('dismissVersionUpdateOnce 会提交当前关闭的版本号', () => {
    dismissVersionUpdateOnce('token-8', '0.2.0')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/settings/version/dismiss-once',
      {
        method: 'POST',
        body: JSON.stringify({ version: '0.2.0' }),
      },
      'token-8',
    )
  })

  it('setVersionNotifications 会提交永久关闭开关', () => {
    setVersionNotifications('token-9', true)

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/settings/version/notifications',
      {
        method: 'POST',
        body: JSON.stringify({ disabled: true }),
      },
      'token-9',
    )
  })

  it('getDomainLifecycleSettings 会请求域名生命周期设置', () => {
    getDomainLifecycleSettings('token-12')

    expect(apiRequest).toHaveBeenCalledWith('/api/settings/domain-lifecycle', {}, 'token-12')
  })

  it('updateDomainLifecycleSettings 会保存轮换总数', () => {
    updateDomainLifecycleSettings('token-13', 8)

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/settings/domain-lifecycle',
      {
        method: 'PUT',
        body: JSON.stringify({ subdomainRotationLimit: 8 }),
      },
      'token-13',
    )
  })

  it('logout 会带当前管理员会话 token 请求退出接口', () => {
    logout('token-10')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/logout',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      'token-10',
    )
  })
})
