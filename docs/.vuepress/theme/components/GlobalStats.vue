<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import * as THREE from 'three'
import { usePageFrontmatter } from 'vuepress/client'

const container = ref<HTMLElement | null>(null) // 改名为 container 保持一致性
const globeContainer = ref<HTMLElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let globe: THREE.Mesh
let frameId: number

const frontmatter = usePageFrontmatter()
const isHome = computed(() => frontmatter.value.pageLayout === 'home')

const initGlobe = () => {
  if (!globeContainer.value) return

  const width = globeContainer.value.clientWidth
  const height = globeContainer.value.clientHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.z = 150

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  globeContainer.value.appendChild(renderer.domElement)

  // 1. 地球主体 (简约发光球体)
  const geometry = new THREE.SphereGeometry(50, 64, 64)
  const material = new THREE.MeshPhongMaterial({
    color: 0x112244,
    emissive: 0x001122,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  })
  globe = new THREE.Mesh(geometry, material)
  scene.add(globe)

  // 2. 环境光
  const light = new THREE.PointLight(0x00ffff, 2, 500)
  light.position.set(100, 100, 100)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  // 3. 模拟“流光线条”环绕
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
        const r = 52 + Math.sin(t * Math.PI) * 10 // 弧线高度
        
        const x = r * Math.sin(pTheta) * Math.cos(pPhi)
        const y = r * Math.cos(pTheta)
        const z = r * Math.sin(pTheta) * Math.sin(pPhi)
        points.push(new THREE.Vector3(x, y, z))
    }

    const curve = new THREE.CatmullRomCurve3(points)
    const curveGeom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50))
    const curveMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 })
    const line = new THREE.Line(curveGeom, curveMat)
    
    // 增加一个流动的点
    const dotGeom = new THREE.SphereGeometry(0.5, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ffff })
    const dot = new THREE.Mesh(dotGeom, dotMat)
    scene.add(line, dot)

    return { line, dot, curve, t: Math.random() }
  }

  const arcs = Array.from({ length: 15 }, createArc)

  const animate = () => {
    frameId = requestAnimationFrame(animate)
    globe.rotation.y += 0.002

    arcs.forEach(arc => {
      arc.t += 0.005
      if (arc.t > 1) arc.t = 0
      const pos = arc.curve.getPoint(arc.t)
      arc.dot.position.copy(pos)
    })

    renderer.render(scene, camera)
  }

  animate()
}

const handleResize = () => {
  if (!renderer || !camera || !globeContainer.value) return
  const width = globeContainer.value.clientWidth
  const height = globeContainer.value.clientHeight
  if (width === 0 || height === 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
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
  <section v-show="isHome" class="global-stats-section">
    <div class="content-wrapper">
      <div ref="globeContainer" class="globe-column"></div>
      <div class="text-column">
        <h2 class="title">全球安全网络实时监测</h2>
        <p class="desc">
          基于 ATQ Verify 的云验证矩阵，我们正在为全球数以万计的节点提供实时安全保障。
          流光线条代表每秒钟数百万次的授权请求与合规性校验。
        </p>
        <div class="stat-grid">
          <div class="stat-item">
            <span class="value">99.99%</span>
            <span class="label">可用性</span>
          </div>
          <div class="stat-item">
            <span class="value">100ms</span>
            <span class="label">平均响应</span>
          </div>
          <div class="stat-item">
            <span class="value">10M+</span>
            <span class="label">每日验证</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.global-stats-section {
  position: relative;
  min-height: 80vh;
  margin-top: 100px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 255, 255, 0.1);
  padding: 60px 20px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 40px;
}

.globe-column {
  height: 500px;
  width: 100%;
}

.text-column {
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
}

.title {
  font-size: 2.5rem;
  margin-bottom: 20px;
  background: linear-gradient(to right, #00ffff, #00ffaa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.desc {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #fff;
  opacity: 1; /* 提升亮度 */
  margin-bottom: 40px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-item .value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #00ffff;
}

.stat-item .label {
  font-size: 0.9rem;
  opacity: 0.6;
}

@media (max-width: 960px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }
  .globe-column {
    height: 300px;
  }
  .text-column {
    text-align: center;
    align-items: center;
  }
}
</style>
