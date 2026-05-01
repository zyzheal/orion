import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, GaugeChart, HeatmapChart, ScatterChart as ScatterChartModule, RadarChart as RadarChartModule, TreemapChart as TreemapChartModule } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  ScatterChartModule,
  RadarChartModule,
  TreemapChartModule,
  RadarComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
  CanvasRenderer,
]);

export default echarts;
