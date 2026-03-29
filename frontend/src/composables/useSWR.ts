/**
 * SWR (Stale-While-Revalidate) Composable
 *
 * 切换页面时先展示缓存中的旧数据，同时后台请求新数据。
 * 新数据返回后无缝替换，不闪白、不跳动。
 */

import { ref, shallowRef, onMounted, watch, type Ref, type WatchSource } from 'vue'

interface UseSWROptions<T> {
  /** 缓存 key */
  key: string | (() => string)
  /** 数据获取函数 */
  fetcher: () => Promise<T>
  /** 监听变化自动刷新 */
  watchSources?: WatchSource[]
  /** 是否立即加载（默认 true） */
  immediate?: boolean
}

interface UseSWRReturn<T> {
  data: Ref<T | null>
  error: Ref<string>
  isLoading: Ref<boolean>
  isValidating: Ref<boolean>
  mutate: () => Promise<void>
}

// 全局缓存
const cache = new Map<string, unknown>()

function resolveKey(key: string | (() => string)): string {
  return typeof key === 'function' ? key() : key
}

export function useSWR<T>(options: UseSWROptions<T>): UseSWRReturn<T> {
  const data = shallowRef<T | null>(null) as Ref<T | null>
  const error = ref('')
  const isLoading = ref(true)
  const isValidating = ref(false)

  // 从缓存恢复
  const cacheKey = resolveKey(options.key)
  const cached = cache.get(cacheKey) as T | undefined
  if (cached !== undefined) {
    data.value = cached
    isLoading.value = false
  }

  async function mutate() {
    const currentKey = resolveKey(options.key)
    isValidating.value = true

    try {
      const result = await options.fetcher()
      data.value = result
      cache.set(currentKey, result)
      error.value = ''
    } catch (err) {
      error.value = err instanceof Error ? err.message : '请求失败'
    } finally {
      isLoading.value = false
      isValidating.value = false
    }
  }

  if (options.immediate !== false) {
    onMounted(mutate)
  }

  if (options.watchSources?.length) {
    watch(options.watchSources, () => {
      // 清除旧缓存 key
      const newKey = resolveKey(options.key)
      if (!cache.has(newKey)) {
        isLoading.value = true
      }
      mutate()
    })
  }

  return { data, error, isLoading, isValidating, mutate }
}

/** 清除特定 key 或所有缓存 */
export function clearSWRCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
