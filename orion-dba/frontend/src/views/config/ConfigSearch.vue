<template>
  <div class="config-search">
    <!-- 搜索头部 -->
    <div class="search-header">
      <a-input-search
        v-model:value="searchText"
        placeholder="搜索配置域、配置项、描述..."
        size="large"
        enter-button
        allow-clear
        @search="handleSearch"
        @change="handleChange"
      >
        <template #prefix>
          <SearchOutlined />
        </template>
      </a-input-search>
      
      <div class="search-filters">
        <a-select
          v-model:value="filterDomain"
          placeholder="按配置域筛选"
          style="width: 200px"
          allow-clear
        >
          <a-select-option v-for="domain in domains" :key="domain" :value="domain">
            {{ domain }}
          </a-select-option>
        </a-select>
        
        <a-select
          v-model:value="filterSensitivity"
          placeholder="按敏感度筛选"
          style="width: 150px"
          allow-clear
        >
          <a-select-option value="public">公开</a-select-option>
          <a-select-option value="internal">内部</a-select-option>
          <a-select-option value="confidential">机密</a-select-option>
          <a-select-option value="secret">最高机密</a-select-option>
        </a-select>
        
        <a-checkbox v-model:checked="showOnlyModified">
          仅显示已修改
        </a-checkbox>
      </div>
    </div>
    
    <!-- 搜索建议 -->
    <div v-if="suggestions.length > 0" class="suggestions">
      <div class="suggestions-title">建议:</div>
      <a-tag
        v-for="suggestion in suggestions"
        :key="suggestion"
        color="blue"
        @click="handleSuggestionClick(suggestion)"
      >
        {{ suggestion }}
      </a-tag>
    </div>
    
    <!-- 搜索结果 -->
    <div class="search-results">
      <a-empty v-if="loading" description="搜索中..." />
      <a-empty v-else-if="results.length === 0 && searchText" description="未找到匹配的配置" />
      <template v-else>
        <div class="results-header">
          <span>找到 {{ results.length }} 个结果</span>
          <a-radio-group v-model:value="viewMode" size="small">
            <a-radio-button value="list">列表</a-radio-button>
            <a-radio-button value="card">卡片</a-radio-button>
          </a-radio-group>
        </div>
        
        <!-- 列表视图 -->
        <template v-if="viewMode === 'list'">
          <a-table
            :columns="columns"
            :data-source="results"
            :pagination="{ pageSize: 20 }"
            :row-key="(record) => `${record.domain}.${record.key}`"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'domain'">
                <a-tag :color="getDomainColor(record.domain)">
                  {{ record.domain }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'key'">
                <code>{{ record.key }}</code>
              </template>
              <template v-else-if="column.key === 'value'">
                <a-tooltip :title="record.defaultValue">
                  <span class="config-value">{{ record.defaultValue }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.key === 'sensitivity'">
                <a-tag :color="getSensitivityColor(record.sensitivity)">
                  {{ record.sensitivity }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space>
                  <a-tooltip title="查看详情">
                    <a-button type="link" size="small" @click="handleViewDetail(record)">
                      <EyeOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="编辑">
                    <a-button type="link" size="small" @click="handleEdit(record)">
                      <EditOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="查看历史">
                    <a-button type="link" size="small" @click="handleViewHistory(record)">
                      <HistoryOutlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </template>
        
        <!-- 卡片视图 -->
        <template v-else>
          <a-row :gutter="16">
            <a-col :span="8" v-for="result in results" :key="`${result.domain}.${result.key}`">
              <a-card size="small" hoverable @click="handleViewDetail(result)">
                <template #title>
                  <a-tag :color="getDomainColor(result.domain)">
                    {{ result.domain }}
                  </a-tag>
                  <code>{{ result.key }}</code>
                </template>
                <p>{{ result.description || '无描述' }}</p>
                <div class="card-footer">
                  <a-tag :color="getSensitivityColor(result.sensitivity)">
                    {{ result.sensitivity }}
                  </a-tag>
                  <span class="card-value">{{ result.defaultValue }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </template>
      </template>
    </div>
    
    <!-- 搜索历史 -->
    <div v-if="searchHistory.length > 0" class="search-history">
      <div class="history-title">
        <span>搜索历史</span>
        <a-button type="link" size="small" @click="clearHistory">清除</a-button>
      </div>
      <div class="history-items">
        <a-tag
          v-for="item in searchHistory"
          :key="item"
          closable
          @close="removeHistoryItem(item)"
          @click="searchText = item; handleSearch()"
        >
          {{ item }}
        </a-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  HistoryOutlined,
} from '@ant-design/icons-vue';

// 搜索文本
const searchText = ref('');
const loading = ref(false);
const viewMode = ref('list');

// 筛选条件
const filterDomain = ref<string>();
const filterSensitivity = ref<string>();
const showOnlyModified = ref(false);

// 建议
const suggestions = ref<string[]>([]);

// 历史记录
const searchHistory = ref<string[]>(['pipeline', 'deploy', 'security']);

// 配置域列表
const domains = ref([
  'app', 'database', 'redis', 'nats', 'pipeline', 'build', 'deploy', 'artifact',
  'alert', 'monitoring', 'security', 'chatops', 'chaos', 'canary', 'cmdb', 'plugin'
]);

// 表格列
const columns = [
  { title: '配置域', key: 'domain', width: 120 },
  { title: '配置项', key: 'key', width: 200 },
  { title: '类型', key: 'type', width: 80 },
  { title: '默认值', key: 'value', ellipsis: true },
  { title: '敏感度', key: 'sensitivity', width: 100 },
  { title: '操作', key: 'action', width: 120 },
];

// 模拟搜索结果
const results = ref<any[]>([]);

// 方法
const handleSearch = () => {
  loading.value = true;
  setTimeout(() => {
    results.value = [
      { domain: 'pipeline', key: 'maxConcurrentRuns', type: 'number', defaultValue: 50, sensitivity: 'internal', description: '最大并发流水线运行数' },
      { domain: 'pipeline', key: 'defaultTimeoutMinutes', type: 'number', defaultValue: 120, sensitivity: 'internal', description: '流水线默认超时时间' },
      { domain: 'deploy', key: 'defaultStrategy', type: 'string', defaultValue: 'rolling', sensitivity: 'internal', description: '默认部署策略' },
      { domain: 'security', key: 'jwtSecret', type: 'string', defaultValue: '***', sensitivity: 'secret', description: 'JWT 签名密钥' },
    ];
    loading.value = false;
    
    if (searchText.value && !searchHistory.value.includes(searchText.value)) {
      searchHistory.value.unshift(searchText.value);
      if (searchHistory.value.length > 10) {
        searchHistory.value.pop();
      }
    }
  }, 300);
};

const handleChange = () => {
  // 模拟自动补全
  if (searchText.value.length > 1) {
    suggestions.value = domains.value
      .filter(d => d.includes(searchText.value))
      .slice(0, 5);
  } else {
    suggestions.value = [];
  }
};

const handleSuggestionClick = (suggestion: string) => {
  searchText.value = suggestion;
  handleSearch();
};

const handleViewDetail = (record: any) => {
  console.log('View detail:', record);
};

const handleEdit = (record: any) => {
  console.log('Edit:', record);
};

const handleViewHistory = (record: any) => {
  console.log('View history:', record);
};

const clearHistory = () => {
  searchHistory.value = [];
};

const removeHistoryItem = (item: string) => {
  const index = searchHistory.value.indexOf(item);
  if (index > -1) {
    searchHistory.value.splice(index, 1);
  }
};

const getDomainColor = (domain: string) => {
  const colors: Record<string, string> = {
    pipeline: 'purple',
    deploy: 'cyan',
    alert: 'red',
    monitoring: 'blue',
    security: 'orange',
  };
  return colors[domain] || 'default';
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
</script>

<style scoped>
.config-search {
  padding: 24px;
}

.search-header {
  margin-bottom: 24px;
}

.search-filters {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  align-items: center;
}

.suggestions {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestions-title {
  color: #8c8c8c;
}

.search-results {
  min-height: 400px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: #8c8c8c;
}

.config-value {
  font-family: monospace;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.card-value {
  font-family: monospace;
  font-size: 12px;
  color: #1890ff;
}

.search-history {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.history-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: #8c8c8c;
}

.history-items {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>