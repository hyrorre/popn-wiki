export function selectNewestPage<T extends { path: string; revision: number }>(
  path: string,
  fetched: T | null | undefined,
  pending: T | null | undefined
) {
  const matchingFetched = fetched?.path === path ? fetched : undefined

  if (pending?.path === path && (!matchingFetched || pending.revision > matchingFetched.revision)) {
    return pending
  }

  return matchingFetched
}
