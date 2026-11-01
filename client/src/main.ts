import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { installAudioUnlock } from './sound'
import './style.css'

installAudioUnlock()

createApp(App).use(createPinia()).use(router).mount('#app')
