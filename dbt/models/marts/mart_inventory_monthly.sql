-- Month x region x channel x category. Additive measures so any filter combination re-aggregates correctly:
--   avg_inv_value is additive across cells; annualised turns = (sum cogs over N months) * 12 / N / mean monthly (sum avg_inv_value)
with snap as (
    select snapshot_month as month, snapshot_date, region, channel, category,
           sum(inventory_value) as inv_value,
           sum(units_on_hand) as units_on_hand,
           sum(value_age_0_30) as v0, sum(value_age_31_60) as v1, sum(value_age_61_90) as v2,
           sum(value_age_91_180) as v3, sum(value_age_180_plus) as v4,
           sum(case when units_demanded > 0 then 1 else 0 end) as demand_cells,
           sum(case when units_demanded > 0 and units_short > 0 then 1 else 0 end) as stockout_cells
    from {{ ref('fct_inventory') }}
    group by all
),
monthly as (
    select month, region, channel, category,
           sum(inv_value) as inv_value_weeksum,
           count(distinct snapshot_date) as snapshots,
           sum(demand_cells) as demand_cells,
           sum(stockout_cells) as stockout_cells
    from snap group by all
),
last_snap as (
    select * from snap
    qualify snapshot_date = max(snapshot_date) over (partition by month, region, channel, category)
),
cogs as (
    select order_month as month, store_region as region, channel, category, sum(cogs) as cogs
    from {{ ref('int_sales_enriched') }}
    group by all
)
select
    m.month, m.region, m.channel, m.category,
    coalesce(c.cogs, 0) as cogs,
    round(m.inv_value_weeksum / m.snapshots, 2) as avg_inv_value,
    m.snapshots,
    l.inv_value as ending_inv_value, l.units_on_hand as ending_units,
    l.v0 as aged_0_30, l.v1 as aged_31_60, l.v2 as aged_61_90, l.v3 as aged_91_180, l.v4 as aged_180_plus,
    m.demand_cells, m.stockout_cells
from monthly m
left join last_snap l using (month, region, channel, category)
left join cogs c using (month, region, channel, category)
