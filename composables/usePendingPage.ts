import type { Page } from '~/shared/types'

export const usePendingPage = () => useState<Page | null>('pending-page', () => null)
