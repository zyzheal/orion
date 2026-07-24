import * as echarts from 'echarts/core';
import {
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  ScatterChart as ScatterChartModule,
  RadarChart as RadarChartModule,
  TreemapChart as TreemapChartModule,
  SankeyChart as SankeyChartModule,
  CustomChart as CustomChartModule,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
  RadarComponent,
  GraphicComponent,
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
  SankeyChartModule,
  CustomChartModule,
  RadarComponent,
  GraphicComponent,
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
