declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string
    avatar: string | null
    role: 'user' | 'admin'
  }
}
