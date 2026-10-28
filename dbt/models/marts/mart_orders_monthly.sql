select
    order_month as month, region, channel,
    count(distinct order_id) as orders,
    count(distinct customer_id) as customers
from {{ ref('int_sales_enriched') }}
group by all
