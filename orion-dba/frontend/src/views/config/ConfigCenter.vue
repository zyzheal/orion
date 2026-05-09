<template>
  <div class="config-center">
    <!-- 顶部统计卡片 -->
    <a-row :gutter="16" class="config-stats">
      <a-col :span="6">
        <a-card>
          <a-statistic title="配置域总数" :value="stats.totalDomains" suffix="个">
            <template #prefix>
              <SettingOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="配置参数" :value="stats.totalConfigs" suffix="项">
            <template #prefix>
              <AppstoreOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="今日变更" :value="stats.todayChanges" suffix="次">
            <template #prefix>
              <HistoryOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="健康状态" :value="stats.healthStatus" suffix="">
            <template #prefix>
              <CheckCircleOutlined v-if="stats.healthStatus === '正常'" style="color: #52c41a" />
              <WarningOutlined v-else style="color: #faad14" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 搜索栏 -->
    <a-card class="search-card">
      <a-input-search
        v-model:value="searchQuery"
        placeholder="搜索配置域、配置项..."
        enter-button="搜索"
        size="large"
        @search="handleSearch"
      >
        <template #prefix>
          <SearchOutlined />
        </template>
      </a-input-search>
      <div class="search-tags">
        <a-tag v-for="tag in popularTags" :key="tag" color="blue" @click="handleTagClick(tag)">
          {{ tag }}
        </a-tag>
      </div>
    </a-card>

    <!-- 配置域列表 -->
    <a-row :gutter="16" class="domain-list">
      <a-col :span="24">
        <a-card title="配置域分类" :bordered="false">
          <a-tabs v-model:activeKey="activeCategory" @change="handleCategoryChange">
            <a-tab-pane key="all" tab="全部">
              <div class="domain-grid">
                <div
                  v-for="domain in filteredDomains"
                  :key="domain.name"
                  class="domain-card"
                  :class="{ active: selectedDomain === domain.name }"
                  @click="handleDomainSelect(domain)"
                >
                  <div class="domain-icon" :style="{ backgroundColor: domain.color }">
                    <component :is="domain.icon" />
                  </div>
                  <div class="domain-info">
                    <div class="domain-name">{{ domain.name }}</div>
                    <div class="domain-desc">{{ domain.description }}</div>
                    <div class="domain-count">{{ domain.configCount }} 项配置</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane key="core" tab="核心基础设施">
              <div class="domain-grid">
                <div v-for="domain in coreDomains" :key="domain.name" class="domain-card" @click="handleDomainSelect(domain)">
                  <div class="domain-icon" :style="{ backgroundColor: domain.color }">
                    <component :is="domain.icon" />
                  </div>
                  <div class="domain-info">
                    <div class="domain-name">{{ domain.name }}</div>
                    <div class="domain-desc">{{ domain.description }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane key="devops" tab="DevOps 管道">
              <div class="domain-grid">
                <div v-for="domain in devopsDomains" :key="domain.name" class="domain-card" @click="handleDomainSelect(domain)">
                  <div class="domain-icon" :style="{ backgroundColor: domain.color }">
                    <component :is="domain.icon" />
                  </div>
                  <div class="domain-info">
                    <div class="domain-name">{{ domain.name }}</div>
                    <div class="domain-desc">{{ domain.description }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane key="ops" tab="运维能力">
              <div class="domain-grid">
                <div v-for="domain in opsDomains" :key="domain.name" class="domain-card" @click="handleDomainSelect(domain)">
                  <div class="domain-icon" :style="{ backgroundColor: domain.color }">
                    <component :is="domain.icon" />
                  </div>
                  <div class="domain-info">
                    <div class="domain-name">{{ domain.name }}</div>
                    <div class="domain-desc">{{ domain.description }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane key="security" tab="安全合规">
              <div class="domain-grid">
                <div v-for="domain in securityDomains" :key="domain.name" class="domain-card" @click="handleDomainSelect(domain)">
                  <div class="domain-icon" :style="{ backgroundColor: domain.color }">
                    <component :is="domain.icon" />
                  </div>
                  <div class="domain-info">
                    <div class="domain-name">{{ domain.name }}</div>
                    <div class="domain-desc">{{ domain.description }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </a-col>
    </a-row>

    <!-- 配置详情面板 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="`${selectedDomainConfig?.name} 配置详情`"
      width="600"
      placement="right"
    >
      <template v-if="selectedDomainConfig">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="配置域">{{ selectedDomainConfig.name }}</a-descriptions-item>
          <a-descriptions-item label="描述">{{ selectedDomainConfig.description }}</a-descriptions-item>
          <a-descriptions-item label="配置数量">{{ selectedDomainConfig.configCount }}</a-descriptions-item>
          <a-descriptions-item label="敏感度">
            <a-tag :color="getSensitivityColor(selectedDomainConfig.sensitivity)">
              {{ selectedDomainConfig.sensitivity }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <a-divider>配置项列表</a-divider>
        
        <a-table
          :columns="configColumns"
          :data-source="selectedDomainConfig.configs"
          :pagination="false"
          size="small"
          :row-key="(record) => record.key"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'key'">
              <a-tag>{{ record.key }}</a-tag>
            </template>
            <template v-else-if="column.key === 'type'">
              <a-tag color="purple">{{ record.type }}</a-tag>
            </template>
            <template v-else-if="column.key === 'value'">
              <code>{{ record.defaultValue }}</code>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button type="link" size="small" @click="handleEditConfig(record)">
                  <EditOutlined />
                </a-button>
                <a-button type="link" size="small" @click="handleViewHistory(record)">
                  <HistoryOutlined />
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  SettingOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SearchOutlined,
  EditOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  SafetyOutlined,
  MonitorOutlined,
  RocketOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue';

// 统计数据
const stats = ref({
  totalDomains: 71,
  totalConfigs: 700,
  todayChanges: 12,
  healthStatus: '正常',
});

// 搜索
const searchQuery = ref('');
const activeCategory = ref('all');
const selectedDomain = ref('');
const drawerVisible = ref(false);

// 热门标签
const popularTags = ['pipeline', 'deploy', 'alert', 'security', 'monitoring', 'redis'];

// 配置域列表
const domains = ref([
  { name: 'app', description: '应用运行配置', icon: 'SettingOutlined', color: '#1890ff', configCount: 4, sensitivity: 'public' },
  { name: 'database', description: '数据库连接配置', icon: 'DatabaseOutlined', color: '#52c41a', configCount: 6, sensitivity: 'secret' },
  { name: 'redis', description: 'Redis 缓存配置', icon: 'ClusterOutlined', color: '#faad14', configCount: 4, sensitivity: 'confidential' },
  { name: 'pipeline', description: '流水线编排配置', icon: 'RocketOutlined', color: '#722ed1', configCount: 9, sensitivity: 'internal' },
  { name: 'deploy', description: '部署策略配置', icon: 'CloudServerOutlined', color: '#13c2c2', configCount: 8, sensitivity: 'internal' },
  { name: 'alert', description: '告警管理配置', icon: 'WarningOutlined', color: '#f5222d', configCount: 7, sensitivity: 'internal' },
  { name: 'monitoring', description: '监控指标配置', icon: 'MonitorOutlined', color: '#2f54eb', configCount: 5, sensitivity: 'internal' },
  { name: 'security', description: '安全认证配置', icon: 'SafetyOutlined', color: '#fa541c', configCount: 12, sensitivity: 'secret' },
  { name: 'chaos', description: '混沌工程配置', icon: 'ToolOutlined', color: '#eb2f96', configCount: 6, sensitivity: 'internal' },
]);

// 表格列定义
const configColumns = [
  { title: '配置项', key: 'key', width: 180 },
  { title: '类型', key: 'type', width: 100 },
  { title: '默认值', key: 'value' },
  { title: '操作', key: 'action', width: 120 },
];

// 过滤后的配置域
const filteredDomains = computed(() => {
  if (!searchQuery.value) return domains.value;
  return domains.value.filter(d => 
    d.name.includes(searchQuery.value) || 
    d.description.includes(searchQuery.value)
  );
});

// 按分类
const coreDomains = computed(() => domains.value.slice(0, 3));
const devopsDomains = computed(() => domains.value.slice(3, 5));
const opsDomains = computed(() => domains.value.slice(5, 8));
const securityDomains = computed(() => domains.value.slice(8));

// 选中的配置详情
const selectedDomainConfig = ref(null);

// 方法
const handleSearch = () => {
  console.log('Search:', searchQuery.value);
};

const handleTagClick = (tag: string) => {
  searchQuery.value = tag;
};

const handleCategoryChange = () => {
  selectedDomain.value = '';
};

const handleDomainSelect = (domain: any) => {
  selectedDomain.value = domain.name;
  selectedDomainConfig.value = {
    ...domain,
    configs: [
      { key: 'timeout', type: 'number', defaultValue: 120 },
      { key: 'retry', type: 'number', defaultValue: 3 },
      { key: 'enabled', type: 'boolean', defaultValue: true },
    ]
  };
  drawerVisible.value = true;
};

const getSensitivityColor = (sensitivity: string) => {
  const colors: Record<string, string> = {
    public: 'green',
    internal: 'blue',
    confidential: 'orange',
    secret: 'red',
  };
  return colors[sensitivity] || 'default';
};

const handleEditConfig = (config: any) => {
  console.log('Edit config:', config);
};

const handleViewHistory = (config: any) => {
  console.log('View history:', config);
};

onMounted(() => {
  // 加载统计数据
});
</script>

<style scoped>
.config-center {
  padding: 24px;
}

.config-stats {
  margin-bottom: 24px;
}

.search-card {
  margin-bottom: 24px;
}

.search-tags {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.domain-list {
  margin-bottom: 24px;
}

.domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.domain-card {
  display: flex;
  padding: 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.domain-card:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

.domain-card.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.domain-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 24px;
  color: white;
  margin-right: 16px;
}

.domain-info {
  flex: 1;
}

.domain-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.domain-desc {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.domain-count {
  font-size: 12px;
  color: #1890ff;
}
</style>