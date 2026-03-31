import { defineStore } from 'pinia'

const TOKEN_KEY = 'onlymail_admin_token'
const USERNAME_KEY = 'onlymail_admin_user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    username: '',
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    hydrate() {
      this.token = localStorage.getItem(TOKEN_KEY) ?? ''
      this.username = localStorage.getItem(USERNAME_KEY) ?? ''
    },
    setSession(token: string, username: string) {
      this.token = token
      this.username = username
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USERNAME_KEY, username)
    },
    clearSession() {
      this.token = ''
      this.username = ''
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
    },
  },
})
