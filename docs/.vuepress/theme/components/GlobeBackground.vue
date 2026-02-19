<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import * as THREE from 'three'
import { usePageFrontmatter } from 'vuepress/client'

const container = ref<HTMLElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let globe: THREE.Mesh
let frameId: number

const frontmatter = usePageFrontmatter()
const isHome = computed(() => frontmatter.value.pageLayout === 'home')

const initGlobe = () => {
  if (!container.value) return

  const width = window.innerWidth
  const height = window.innerHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000)
  camera.position.z = 250 // 调远一点适应全屏背景

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // 1. 地球主体
  const geometry = new THREE.SphereGeometry(70, 64, 64)
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x001122,
    wireframe: true,
    transparent: true,
    opacity: 0.2 // 稍微增加一点可见度
  })
  globe = new THREE.Mesh(geometry, material)
  scene.add(globe)

  // 2. 星空背景
  const partGeom = new THREE.BufferGeometry()
  const partCount = 4000
  const posArray = new Float32Array(partCount * 3)
  for (let i = 0; i < partCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1500
  }
  partGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  const particles = new THREE.Points(partGeom, new THREE.PointsMaterial({ 
    size: 1.2, 
    color: 0x44aaff, 
    transparent: true, 
    opacity: 0.5 
  }))
  scene.add(particles)

  // 3. 流光线条
  const createArc = () => {
    const points = []
    const startPhi = Math.random() * Math.PI * 2
    const startTheta = Math.random() * Math.PI
    const endPhi = startPhi + (Math.random() - 0.5) * Math.PI
    const endTheta = startTheta + (Math.random() - 0.5) * Math.PI

    for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const pPhi = startPhi + (endPhi - startPhi) * t
        const pTheta = startTheta + (endTheta - startTheta) * t
        const r = 72 + Math.sin(t * Math.PI) * 15 
        
        const x = r * Math.sin(pTheta) * Math.cos(pPhi)
        const y = r * Math.cos(pTheta)
        const z = r * Math.sin(pTheta) * Math.sin(pPhi)
        points.push(new THREE.Vector3(x, y, z))
    }

    const curve = new THREE.CatmullRomCurve3(points)
    const curveGeom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50))
    const curveMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 })
    const line = new THREE.Line(curveGeom, curveMat)
    
    const dotGeom = new THREE.SphereGeometry(1.2, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 })
    const dot = new THREE.Mesh(dotGeom, dotMat)
    scene.add(line, dot)

    return { line, dot, curve, t: Math.random() }
  }

  const arcs = Array.from({ length: 25 }, createArc)

  // 4. 光照
  const light = new THREE.PointLight(0x00ffff, 5, 1000)
  light.position.set(200, 200, 200)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))

  const animate = () => {
    frameId = requestAnimationFrame(animate)
    globe.rotation.y += 0.001
    scene.rotation.y += 0.0002 // 整体微转

    arcs.forEach(arc => {
      arc.t += 0.003
      if (arc.t > 1) arc.t = 0
      const pos = arc.curve.getPoint(arc.t)
      arc.dot.position.copy(pos)
    })

    renderer.render(scene, camera)
  }

  animate()
}

const handleResize = () => {
  if (!renderer || !camera || !container.value) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

watch(isHome, (val) => {
  if (val && !renderer) {
    setTimeout(initGlobe, 100)
  }
})

onMounted(() => {
  if (isHome.value) {
    initGlobe()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  window.removeEventListener('resize', handleResize)
  if (renderer) renderer.dispose()
})
</script>

<template>
  <div v-show="isHome" ref="container" class="globe-background-container"></div>
</template>

<style scoped>
.globe-background-container {
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
