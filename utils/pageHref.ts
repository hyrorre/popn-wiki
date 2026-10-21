// Wiki paths are stored without a leading slash, except the top page which is '/'.
export const pageHref = (path: string) => (path === '/' ? '/' : `/${path}`)
