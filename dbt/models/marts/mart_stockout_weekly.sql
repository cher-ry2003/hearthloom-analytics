select
    week_start, region, channel, category,
    sum(case when units_demanded > 0 then 1 else 0 end) as demand_cells,
    sum(case when units_demanded > 0 and units_short > 0 then 1 else 0 end) as stockout_cells
from {{ ref('fct_inventory') }}
group by all
