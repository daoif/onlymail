import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import DashboardView from '../views/DashboardView.vue'
import AddressesView from '../views/AddressesView.vue'
import DomainsView from '../views/DomainsView.vue'
import LoginView from '../views/LoginView.vue'
import MailsView from '../views/MailsView.vue'
import SettingsView from '../views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/addresses', name: 'addresses', component: AddressesView, meta: { requiresAuth: true } },
    { path: '/mails', name: 'mails', component: MailsView, meta: { requiresAuth: true } },
    { path: '/domains', name: 'domains', component: DomainsView, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  authStore.hydrate()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})
