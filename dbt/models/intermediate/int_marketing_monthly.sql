select
    date_trunc('month', week_start)::date as month,
    channel,
    sum(spend) as spend,
    sum(impressions) as impressions,
    sum(clicks) as clicks,
    sum(attributed_orders) as attributed_orders,
    sum(attributed_revenue) as attributed_revenue
from {{ ref('stg_marketing_spend') }}
group by all
