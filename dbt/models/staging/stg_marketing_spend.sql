select
    cast(week_start as date) as week_start,
    channel,
    cast(spend as double) as spend,
    impressions,
    clicks,
    attributed_orders,
    cast(attributed_revenue as double) as attributed_revenue
from {{ source('raw', 'marketing_spend') }}
