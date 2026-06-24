export type PaginationItem = number | 'ellipsis'

export function clampPage(page: number, totalPages: number) {
  const safeTotalPages = Math.max(1, Math.floor(totalPages))
  if (!Number.isFinite(page)) {
    return 1
  }

  return Math.min(Math.max(1, Math.floor(page)), safeTotalPages)
}

export function buildPaginationItems(currentPage: number, totalPages: number, siblingCount = 1): PaginationItem[] {
  const safeTotalPages = Math.max(1, Math.floor(totalPages))
  const safeCurrentPage = clampPage(currentPage, safeTotalPages)
  const safeSiblingCount = Math.max(0, Math.floor(siblingCount))

  if (safeTotalPages <= 2 * safeSiblingCount + 5) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1)
  }

  const pageSet = new Set<number>([1, safeTotalPages])
  for (let page = safeCurrentPage - safeSiblingCount; page <= safeCurrentPage + safeSiblingCount; page += 1) {
    if (page > 1 && page < safeTotalPages) {
      pageSet.add(page)
    }
  }

  const pages = Array.from(pageSet).sort((a, b) => a - b)
  const items: PaginationItem[] = []

  for (const page of pages) {
    const previous = items[items.length - 1]
    if (typeof previous === 'number') {
      const gap = page - previous
      if (gap === 2) {
        items.push(previous + 1)
      } else if (gap > 2) {
        items.push('ellipsis')
      }
    }

    items.push(page)
  }

  return items
}
