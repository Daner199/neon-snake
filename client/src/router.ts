import { createRouter, createWebHistory } from 'vue-router'
import MenuView from './views/MenuView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'menu', component: MenuView },
    { path: '/modos', name: 'modos', component: () => import('./views/ModesView.vue') },
    { path: '/jugar/:modo', name: 'jugar', component: () => import('./views/GameView.vue') },
    { path: '/ranking', name: 'ranking', component: () => import('./views/RankingView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  ],
})
