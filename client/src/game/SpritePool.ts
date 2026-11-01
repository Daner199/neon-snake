import Phaser from 'phaser'

// Imágenes reutilizables: se crean una sola vez y en cada fotograma solo se colocan.
// El orden de uso es el orden de dibujo (lo último que se pide queda encima).
export class SpritePool {
  private readonly scene: Phaser.Scene
  private readonly texture: string
  private readonly depth: number
  private readonly additive: boolean
  private readonly items: Phaser.GameObjects.Image[] = []
  private used = 0

  constructor(scene: Phaser.Scene, texture: string, depth: number, additive = false) {
    this.scene = scene
    this.texture = texture
    this.depth = depth
    this.additive = additive
  }

  begin() {
    this.used = 0
  }

  next(): Phaser.GameObjects.Image {
    let img = this.items[this.used]
    if (!img) {
      img = this.scene.add.image(0, 0, this.texture).setDepth(this.depth)
      if (this.additive) img.setBlendMode(Phaser.BlendModes.ADD)
      this.items.push(img)
    }
    this.used++
    return img.setVisible(true).setAlpha(1)
  }

  // Oculta las imágenes que no se usaron en este fotograma
  end() {
    for (let i = this.used; i < this.items.length; i++) {
      if (this.items[i].visible) this.items[i].setVisible(false)
    }
  }
}
