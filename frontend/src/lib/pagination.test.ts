import { describe, expect, it } from 'vitest'

import { buildPaginationItems, clampPage } from './pagination'

describe('pagination helpers', () => {
  it('clampPage 会把页码限制在有效范围内', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(11, 10)).toBe(10)
    expect(clampPage(Number.NaN, 10)).toBe(1)
  })

  it('页数较少时展示全部页码', () => {
    expect(buildPaginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('页数较多时保留首页、当前页附近和末页', () => {
    expect(buildPaginationItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
  })

  it('当前页靠近开头时补齐相邻页码', () => {
    expect(buildPaginationItems(2, 20)).toEqual([1, 2, 3, 'ellipsis', 20])
  })

  it('当前页靠近结尾时补齐相邻页码', () => {
    expect(buildPaginationItems(19, 20)).toEqual([1, 'ellipsis', 18, 19, 20])
  })
})
