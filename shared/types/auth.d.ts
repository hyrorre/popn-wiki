declare module '#auth-utils' {
  interface User {
    id: number
    authVersion?: number
    email: string
    name: string
    avatar: string | null
    role: 'user' | 'admin'
  }
}
