import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, GaugeChart, HeatmapChart, ScatterChart as ScatterChartModule } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  ScatterChartModule,
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
