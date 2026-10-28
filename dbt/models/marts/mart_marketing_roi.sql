with a as (select * from {{ ref('int_marketing_monthly') }}),
b as (select month, channel, budget_spend from {{ ref('stg_marketing_budget') }}),
f as (select month, channel, forecast_spend from {{ ref('stg_marketing_forecast') }})
select
    month, channel,
    a.spend, a.impressions, a.clicks, a.attributed_orders, a.attributed_revenue,
    round(a.attributed_revenue / nullif(a.spend, 0), 3) as roas,
    round(a.attributed_revenue - a.spend, 2) as net_return,
    round(a.spend / nullif(a.attributed_orders, 0), 2) as cost_per_order,
    b.budget_spend, f.forecast_spend,
    round(a.spend - b.budget_spend, 2) as spend_var_vs_budget
from a
left join b using (month, channel)
left join f using (month, channel)
