import { appendFileSync } from 'node:fs'
import { defineNitroPlugin } from 'nitropack/runtime'

const RESEND_API_ORIGIN = 'https://api.resend.com'

export default defineNitroPlugin(() => {
  const originalFetch = globalThis.fetch

  const mockedFetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith(RESEND_API_ORIGIN)) {
      return originalFetch(...args)
    }

    const capturePath = process.env.NUXT_TEST_EMAIL_CAPTURE_PATH
    if (!capturePath) {
      throw new Error('NUXT_TEST_EMAIL_CAPTURE_PATH is required by the Resend test mock')
    }

    const payload = JSON.parse(String(init?.body ?? '{}')) as { to?: string | string[] }
    appendFileSync(capturePath, `${JSON.stringify({ url, payload })}\n`)

    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]
    if (recipients.includes('delivery-failure@example.com')) {
      return Response.json(
        { name: 'application_error', message: 'Simulated delivery failure', statusCode: 500 },
        { status: 500 }
      )
    }

    return Response.json({ id: `test-email-${Date.now()}` })
  }

  globalThis.fetch = Object.assign(mockedFetch, { preconnect: originalFetch.preconnect })
})
