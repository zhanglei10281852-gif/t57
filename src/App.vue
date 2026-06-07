<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🚢 集装箱堆场3D可视化调度系统</h1>
      <div class="header-stats">
        <span class="stat-item">总箱量: {{ stats.totalCount }} / {{ stats.totalCapacity }}</span>
        <span class="stat-item">占用率: {{ stats.occupancyRate }}%</span>
        <span class="stat-item">平均堆高: {{ stats.avgHeight }} 层</span>
      </div>
    </header>

    <div class="main-content">
      <div class="left-panel">
        <div class="control-bar">
          <div class="view-buttons">
            <button @click="setView('top')" :class="{ active: currentView === 'top' }">俯视</button>
            <button @click="setView('side')" :class="{ active: currentView === 'side' }">侧视</button>
            <button @click="setView('bird')" :class="{ active: currentView === 'bird' }">45°鸟瞰</button>
          </div>
          
          <div class="search-box">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="输入箱号搜索..."
              @keyup.enter="searchContainer"
            />
            <button @click="searchContainer">搜索</button>
          </div>

          <button 
            class="heatmap-btn" 
            :class="{ active: heatmapMode }"
            @click="toggleHeatmap"
          >
            {{ heatmapMode ? '退出热力图' : '热力图模式' }}
          </button>
        </div>

        <div class="scene-wrapper" ref="sceneWrapper">
          <canvas ref="canvasRef" class="scene-canvas"></canvas>
          
          <div 
            v-if="hoveredContainer"
            class="tooltip"
            :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
          >
            <div class="tooltip-title">{{ hoveredContainer.containerNo }}</div>
            <div class="tooltip-row">
              <span class="label">状态:</span>
              <span 
                class="status-tag"
                :style="{ backgroundColor: STATUS_COLORS[hoveredContainer.status] }"
              >
                {{ STATUS_LABELS[hoveredContainer.status] }}
              </span>
            </div>
            <div class="tooltip-row">
              <span class="label">货主:</span>
              <span>{{ hoveredContainer.owner }}</span>
            </div>
            <div class="tooltip-row">
              <span class="label">位置:</span>
              <span>{{ hoveredContainer.position.col + 1 }}列 - {{ hoveredContainer.position.row + 1 }}排 - {{ hoveredContainer.position.tier + 1 }}层</span>
            </div>
          </div>

          <div v-if="isAnimating" class="animation-overlay">
            <div class="animation-info">
              <div class="loading-spinner"></div>
              <span>调度模拟中... 翻箱次数: {{ rehandleCount }}</span>
            </div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-title">图例</div>
          <div class="legend-items">
            <div v-for="(label, key) in STATUS_LABELS" :key="key" class="legend-item">
              <span class="legend-color" :style="{ backgroundColor: STATUS_COLORS[key as ContainerStatus] }"></span>
              <span>{{ label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div v-if="selectedContainer" class="detail-panel">
          <div class="panel-title">📦 集装箱详情</div>
          
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">箱号</span>
              <span class="detail-value highlight">{{ selectedContainer.containerNo }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">箱型</span>
              <span class="detail-value">{{ selectedContainer.type }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">状态</span>
              <span 
                class="detail-value status-tag large"
                :style="{ backgroundColor: STATUS_COLORS[selectedContainer.status] }"
              >
                {{ STATUS_LABELS[selectedContainer.status] }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">货主</span>
              <span class="detail-value">{{ selectedContainer.owner }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">堆存位置</span>
              <span class="detail-value">
                {{ selectedContainer.position.col + 1 }}列 
                {{ selectedContainer.position.row + 1 }}排 
                {{ selectedContainer.position.tier + 1 }}层
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">到港日期</span>
              <span class="detail-value">{{ selectedContainer.arrivalDate }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">预计离港</span>
              <span class="detail-value">{{ selectedContainer.departureDate }}</span>
            </div>
          </div>

          <button 
            class="discharge-btn"
            :disabled="isAnimating"
            @click="handleDischarge"
          >
            🚛 执行出箱
          </button>
        </div>

        <div v-else class="detail-panel empty">
          <div class="empty-text">
            <div class="empty-icon">👆</div>
            <div>点击集装箱查看详情</div>
          </div>
        </div>

        <div class="stats-panel">
          <div class="panel-title">📊 统计信息</div>
          
          <div class="chart-section">
            <div class="chart-title">状态分布</div>
            <div ref="pieChartRef" class="chart pie-chart"></div>
          </div>

          <div class="chart-section">
            <div class="chart-title">各列占用率</div>
            <div ref="barChartRef" class="chart bar-chart"></div>
          </div>

          <div class="chart-section">
            <div class="chart-title">即将离港 (3天内)</div>
            <div class="soon-departing-list">
              <div 
                v-for="item in stats.soonDeparting" 
                :key="item.id"
                class="departing-item"
                @click="selectContainer(item)"
              >
                <span class="departing-no">{{ item.containerNo }}</span>
                <span class="departing-date">{{ item.departureDate }}</span>
                <span 
                  class="status-tag small"
                  :style="{ backgroundColor: STATUS_COLORS[item.status] }"
                >
                  {{ STATUS_LABELS[item.status] }}
                </span>
              </div>
              <div v-if="stats.soonDeparting.length === 0" class="empty-list">
                暂无即将离港的箱子
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { Container, ContainerStatus } from './types/container'
import { STATUS_COLORS, STATUS_LABELS } from './types/container'
import { generateMockContainers, getStatistics } from './data/mockData'
import { YardScene } from './utils/YardScene'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const sceneWrapper = ref<HTMLDivElement | null>(null)
const pieChartRef = ref<HTMLDivElement | null>(null)
const barChartRef = ref<HTMLDivElement | null>(null)

let yardScene: YardScene | null = null
let pieChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null

const containers = ref<Container[]>([])
const selectedContainer = ref<Container | null>(null)
const hoveredContainer = ref<Container | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })
const searchQuery = ref('')
const heatmapMode = ref(false)
const currentView = ref<'top' | 'side' | 'bird'>('bird')
const isAnimating = ref(false)
const rehandleCount = ref(0)

const stats = computed(() => getStatistics(containers.value))

function initScene() {
  if (!canvasRef.value) return
  
  yardScene = new YardScene(canvasRef.value)
  yardScene.loadContainers(containers.value)
  
  yardScene.setOnContainerHover((container, event) => {
    hoveredContainer.value = container
    if (container && sceneWrapper.value) {
      const rect = sceneWrapper.value.getBoundingClientRect()
      tooltipPos.value = {
        x: event.clientX - rect.left + 15,
        y: event.clientY - rect.top + 15
      }
    }
  })

  yardScene.setOnContainerClick((container) => {
    selectedContainer.value = container
  })
}

function initCharts() {
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
    updatePieChart()
  }
  
  if (barChartRef.value) {
    barChart = echarts.init(barChartRef.value)
    updateBarChart()
  }
}

function updatePieChart() {
  if (!pieChart) return
  
  const data = Object.entries(stats.value.statusCounts).map(([key, value]) => ({
    name: STATUS_LABELS[key as ContainerStatus],
    value,
    itemStyle: { color: STATUS_COLORS[key as ContainerStatus] }
  }))

  pieChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#1a1a2e',
        borderWidth: 2
      },
      label: {
        show: true,
        color: '#fff',
        fontSize: 11
      },
      data
    }]
  })
}

function updateBarChart() {
  if (!barChart) return
  
  const data = stats.value.colOccupancy
  
  barChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const item = params[0]
        return `第${item.name}列<br/>箱量: ${item.data.count}个<br/>占用率: ${item.data.rate}%`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.col),
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0' }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { lineStyle: { color: '#4a5568' } },
      splitLine: { lineStyle: { color: '#2d3748' } },
      axisLabel: { color: '#a0aec0', formatter: '{value}%' }
    },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: parseFloat(d.rate),
        count: d.count,
        rate: d.rate
      })),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#4fd1c5' },
          { offset: 1, color: '#319795' }
        ]),
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: '60%'
    }]
  })
}

function setView(view: 'top' | 'side' | 'bird') {
  currentView.value = view
  if (yardScene) {
    yardScene.setViewPreset(view)
  }
}

function toggleHeatmap() {
  heatmapMode.value = !heatmapMode.value
  if (yardScene) {
    yardScene.setHeatmapMode(heatmapMode.value, containers.value)
  }
}

function searchContainer() {
  const query = searchQuery.value.trim().toUpperCase()
  if (!query) return
  
  const found = containers.value.find(c => 
    c.containerNo.toUpperCase().includes(query)
  )
  
  if (found) {
    selectedContainer.value = found
    if (yardScene) {
      if (heatmapMode.value) {
        heatmapMode.value = false
        yardScene.setHeatmapMode(false, containers.value)
      }
      yardScene.flyToContainer(found.id)
    }
  } else {
    alert('未找到该箱号的集装箱')
  }
}

function selectContainer(container: Container) {
  selectedContainer.value = container
  if (yardScene) {
    if (heatmapMode.value) {
      heatmapMode.value = false
      yardScene.setHeatmapMode(false, containers.value)
    }
    yardScene.flyToContainer(container.id)
  }
}

async function handleDischarge() {
  if (!selectedContainer.value || !yardScene || isAnimating.value) return
  
  isAnimating.value = true
  rehandleCount.value = 0
  
  try {
    const count = await yardScene.performDischargeAnimation(
      selectedContainer.value,
      containers.value
    )
    rehandleCount.value = count
    
    containers.value = containers.value.filter(c => c.id !== selectedContainer.value!.id)
    
    setTimeout(() => {
      selectedContainer.value = null
      isAnimating.value = false
    }, 500)
  } catch (e) {
    console.error(e)
    isAnimating.value = false
  }
}

watch(() => containers.value.length, () => {
  nextTick(() => {
    updatePieChart()
    updateBarChart()
  })
})

const resizeObserver = new ResizeObserver(() => {
  if (pieChart) pieChart.resize()
  if (barChart) barChart.resize()
})

onMounted(() => {
  containers.value = generateMockContainers(600)
  
  nextTick(() => {
    initScene()
    initCharts()
    
    if (pieChartRef.value) resizeObserver.observe(pieChartRef.value)
    if (barChartRef.value) resizeObserver.observe(barChartRef.value)
  })
})

onUnmounted(() => {
  if (yardScene) yardScene.dispose()
  if (pieChart) pieChart.dispose()
  if (barChart) barChart.dispose()
  resizeObserver.disconnect()
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.app-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-header h1 {
  font-size: 20px;
  font-weight: 600;
  background: linear-gradient(135deg, #4fd1c5, #63b3ed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  font-size: 14px;
  color: #a0aec0;
}

.stat-item {
  font-weight: 600;
  color: #4fd1c5;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
}

.control-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.view-buttons {
  display: flex;
  gap: 4px;
}

.view-buttons button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.view-buttons button:hover {
  background: rgba(79, 209, 197, 0.2);
  border-color: #4fd1c5;
}

.view-buttons button.active {
  background: #4fd1c5;
  border-color: #4fd1c5;
  color: #1a202c;
  font-weight: 600;
}

.search-box {
  flex: 1;
  display: flex;
  gap: 8px;
  max-width: 300px;
}

.search-box input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.search-box input::placeholder {
  color: #718096;
}

.search-box input:focus {
  border-color: #4fd1c5;
}

.search-box button {
  padding: 8px 16px;
  background: #4fd1c5;
  border: none;
  color: #1a202c;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.search-box button:hover {
  background: #38b2ac;
}

.heatmap-btn {
  padding: 8px 16px;
  background: rgba(237, 137, 54, 0.2);
  border: 1px solid #ed8936;
  color: #ed8936;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.heatmap-btn:hover {
  background: rgba(237, 137, 54, 0.3);
}

.heatmap-btn.active {
  background: #ed8936;
  color: #fff;
}

.scene-wrapper {
  flex: 1;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #0d1117;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.scene-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.tooltip {
  position: absolute;
  background: rgba(26, 32, 44, 0.95);
  border: 1px solid rgba(79, 209, 197, 0.5);
  border-radius: 8px;
  padding: 12px;
  pointer-events: none;
  z-index: 100;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  color: #4fd1c5;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 4px;
}

.tooltip-row .label {
  color: #a0aec0;
}

.tooltip-row > span:last-child {
  color: #e2e8f0;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
  font-weight: 500;
}

.status-tag.small {
  font-size: 10px;
  padding: 1px 6px;
}

.status-tag.large {
  padding: 4px 12px;
  font-size: 13px;
}

.animation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.animation-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(26, 32, 44, 0.9);
  border-radius: 8px;
  border: 1px solid #4fd1c5;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(79, 209, 197, 0.3);
  border-top-color: #4fd1c5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.legend {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 8px;
}

.legend-items {
  display: flex;
  gap: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a0aec0;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.right-panel {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 16px 0;
}

.detail-panel,
.stats-panel {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #718096;
}

.detail-value {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 500;
}

.detail-value.highlight {
  color: #4fd1c5;
  font-size: 15px;
  font-weight: 600;
}

.discharge-btn {
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  background: linear-gradient(135deg, #ed8936, #dd6b20);
  border: none;
  color: #fff;
  cursor: pointer;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;
}

.discharge-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(237, 137, 54, 0.4);
}

.discharge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.detail-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.empty-text {
  text-align: center;
  color: #718096;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.stats-panel {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.chart-section {
  margin-bottom: 20px;
}

.chart-title {
  font-size: 13px;
  font-weight: 600;
  color: #a0aec0;
  margin-bottom: 10px;
}

.chart {
  width: 100%;
}

.pie-chart {
  height: 180px;
}

.bar-chart {
  height: 160px;
}

.soon-departing-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.departing-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.departing-item:hover {
  background: rgba(79, 209, 197, 0.15);
}

.departing-no {
  flex: 1;
  font-size: 12px;
  color: #4fd1c5;
  font-weight: 500;
}

.departing-date {
  font-size: 11px;
  color: #a0aec0;
}

.empty-list {
  text-align: center;
  color: #718096;
  font-size: 12px;
  padding: 20px;
}
</style>
