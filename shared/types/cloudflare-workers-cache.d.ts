declare module 'cloudflare:workers' {
  export const cache: {
    purge(options: {
      tags?: string[]
      pathPrefixes?: string[]
      purgeEverything?: true
    }): Promise<{
      success: boolean
      errors?: { code?: number; message?: string }[]
    }>
  }
}
