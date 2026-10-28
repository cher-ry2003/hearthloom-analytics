select order_month as month, store_id, sum(net_sales) as net_sales, sum(cogs) as cogs,
       count(distinct order_id) as orders, sum(quantity) as units
from {{ ref('int_sales_enriched') }}
group by all
