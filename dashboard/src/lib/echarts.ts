import { BarChart, HeatmapChart, LineChart, TreemapChart, CustomChart } from 'echarts/charts'
import { AriaComponent, GridComponent, MarkLineComponent, TooltipComponent, VisualMapComponent, GraphicComponent, MarkAreaComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([BarChart, LineChart, HeatmapChart, TreemapChart, CustomChart, GridComponent, TooltipComponent, VisualMapComponent,
  MarkLineComponent, MarkAreaComponent, AriaComponent, GraphicComponent, SVGRenderer])

export { echarts }
