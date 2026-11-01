<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type Phaser from 'phaser'
import { createGame } from '../game/config'

const props = defineProps<{ mode: string }>()
let game: Phaser.Game | null = null

onMounted(() => {
  game = createGame('game-container', props.mode)
})

onBeforeUnmount(() => {
  game?.destroy(true)
  game = null
})
</script>

<template>
  <div id="game-container" class="game-container"></div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100%;
}
</style>
