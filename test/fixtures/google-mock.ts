import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin(() => {
  const originalFetch = globalThis.fetch
  const mockedFetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url === 'https://oauth2.googleapis.com/token') {
      const params = new URLSearchParams(String(init?.body ?? ''))
      return Response.json({ access_token: params.get('code'), token_type: 'Bearer' })
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
      const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '')
      return Response.json({
        email: token === 'verified' ? 'google-pending@example.com' : 'google-unverified@example.com',
        name: 'Google user',
        ...(token === 'missing' ? {} : { email_verified: token === 'verified' })
      })
    }
    return originalFetch(...args)
  }
  globalThis.fetch = Object.assign(mockedFetch, { preconnect: originalFetch.preconnect })
})
