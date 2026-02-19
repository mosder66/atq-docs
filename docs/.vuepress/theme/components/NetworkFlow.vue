<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import * as THREE from 'three'
import { usePageFrontmatter } from 'vuepress/client'

const container = ref<HTMLElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let frameId: number

const frontmatter = usePageFrontmatter()
const isHome = computed(() => frontmatter.value.pageLayout === 'home')

// 节点配置 - 放大比例并增加间距
const nodes = [
  { name: 'User', x: -250, color: 0x00ffff, type: 'user' },
  { name: 'Gateway', x: -80, color: 0x00ffaa, type: 'gateway' },
  { name: 'Firewall', x: 80, color: 0xff0055, type: 'firewall' },
  { name: 'Server', x: 250, color: 0xffaa00, type: 'server' }
]

const packets: any[] = []
let particles: THREE.Points

// 塑造 3D 形象 - 尺寸扩大 5 倍
const createSpecialNode = (type: string, color: number) => {
  const group = new THREE.Group()
  
  if (type === 'user') {
    // 塑造用户: 头部球体 + 身体
    const head = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshLambertMaterial({ color }))
    const body = new THREE.Mesh(new THREE.ConeGeometry(15, 30, 32), new THREE.MeshLambertMaterial({ color }))
    body.position.y = -20
    group.add(head, body)
  } 
  else if (type === 'gateway') {
    // 塑造网关: 大圆环 + 核心
    const ring = new THREE.Mesh(new THREE.TorusGeometry(25, 2, 16, 100), new THREE.MeshLambertMaterial({ color, opacity: 0.6, transparent: true }))
    ring.rotation.x = Math.PI / 2
    const core = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 15), new THREE.MeshLambertMaterial({ color, wireframe: true }))
    group.add(ring, core)
  }
  else if (type === 'firewall') {
    // 塑造防火墙: 多层巨型盾牌
    for (let i = 0; i < 3; i++) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 40, 5), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.3 + i * 0.2 }))
        wall.position.z = i * 8 - 8
        group.add(wall)
    }
  }
  else if (type === 'server') {
    // 塑造服务器: 巨型机架
    const tower = new THREE.Mesh(new THREE.BoxGeometry(30, 60, 30), new THREE.MeshLambertMaterial({ color, wireframe: true }))
    for (let i = 0; i < 4; i++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(29, 5, 29), new THREE.MeshLambertMaterial({ color }))
        slab.position.y = i * 15 - 22.5
        group.add(slab)
    }
    group.add(tower)
  }

  return group
}

const initThree = () => {
  if (!container.value) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 5000)
  camera.position.z = 450 // 调远摄像机
  camera.position.y = 20

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // 更多星空粒子
  const partGeom = new THREE.BufferGeometry()
  const partCount = 5000
  const posArray = new Float32Array(partCount * 3)
  for (let i = 0; i < partCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1500
  }
  partGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  particles = new THREE.Points(partGeom, new THREE.PointsMaterial({ size: 1.2, color: 0x44aaff, transparent: true, opacity: 0.6 }))
  scene.add(particles)

  nodes.forEach(node => {
    const specialModel = createSpecialNode(node.type, node.color)
    specialModel.position.x = node.x
    specialModel.name = `node_${node.name}`
    scene.add(specialModel)

    // 强光效果
    const light = new THREE.PointLight(node.color, 12, 300)
    light.position.set(node.x, 0, 0)
    scene.add(light)
  })

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))

  const animate = () => {
    frameId = requestAnimationFrame(animate)
    particles.rotation.y += 0.0003
    
    scene.children.forEach(child => {
      if (child.name?.startsWith('node_')) {
        child.rotation.y += 0.012
        if (child.name.includes('Gateway')) child.rotation.x += 0.008
      }
    })

    if (Math.random() > 0.95 && isHome.value) createPacket()

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]
      const targetNode = nodes[p.targetIdx]
      
      if (p.mesh.position.x < targetNode.x) {
        p.mesh.position.x += p.speed
      } else {
        p.waitTime += 1
        if (p.waitTime > 20) {
           p.targetIdx += 1
           p.waitTime = 0
           const light = scene.children.find(c => c instanceof THREE.PointLight && c.position.x === targetNode.x) as THREE.PointLight
           if (light) light.intensity = 30
        }
      }

      scene.children.forEach(c => {
        if (c instanceof THREE.PointLight) c.intensity = Math.max(c.intensity * 0.95, 12)
      })
      
      p.mesh.position.y = Math.sin(Date.now() * 0.005 + p.mesh.position.x * 0.05) * 8

      if (p.targetIdx >= nodes.length) {
        scene.remove(p.mesh)
        packets.splice(i, 1)
      }
    }
    renderer.render(scene, camera)
  }
  animate()
}

const createPacket = () => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16), 
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 5 })
  )
  mesh.position.set(nodes[0].x, 0, 0)
  scene.add(mesh)
  packets.push({ mesh, speed: 4.0, targetIdx: 1, waitTime: 0 })
}

const handleResize = () => {
  if (!renderer || !camera) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  window.removeEventListener('resize', handleResize)
  if (renderer) renderer.dispose()
})
</script>

<template>
  <div v-show="isHome" ref="container" class="network-flow-container"></div>
</template>

<style scoped>
.network-flow-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(circle at center, #020512 0%, #000 100%);
  overflow: hidden;
}
</style>
