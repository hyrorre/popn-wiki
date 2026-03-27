declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string | null
    avatar: string | null
  }
}

export {}
