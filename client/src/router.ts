import { createRouter, createWebHistory } from 'vue-router'
import { buscarModo } from './data'
import MenuView from './views/MenuView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'menu', component: MenuView },
    { path: '/modos', name: 'modos', component: () => import('./views/ModesView.vue') },
    {
      // Cualquier modo de src/data/modos.json; si no existe, la página 404 (con la misma URL)
      path: '/jugar/:modo',
      name: 'jugar',
      component: () => import('./views/GameView.vue'),
      beforeEnter: (to) =>
        buscarModo(to.params.modo) !== undefined || {
          name: 'no-encontrada',
          params: { pathMatch: to.path.slice(1).split('/') },
          query: to.query,
          hash: to.hash,
        },
    },
    { path: '/ranking', name: 'ranking', component: () => import('./views/RankingView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/:pathMatch(.*)*', name: 'no-encontrada', component: () => import('./views/NotFoundView.vue') },
  ],
})
