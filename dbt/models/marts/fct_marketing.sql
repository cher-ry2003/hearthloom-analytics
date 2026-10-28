select
    week_start,
    date_trunc('month', week_start)::date as month,
    channel,
    spend, impressions, clicks, attributed_orders, attributed_revenue,
    round(attributed_revenue / nullif(spend, 0), 3) as roas,
    round(spend / nullif(clicks, 0), 3) as cost_per_click,
    round(spend / nullif(attributed_orders, 0), 2) as cost_per_order
from {{ ref('stg_marketing_spend') }}
