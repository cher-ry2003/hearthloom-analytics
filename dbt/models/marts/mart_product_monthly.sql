with s as (
    select order_month as month, region, channel, product_id,
           sum(quantity) as units, sum(net_sales) as net_sales, sum(cogs) as cogs
    from {{ ref('int_sales_enriched') }} group by all
),
r as (
    select sale_month as month, region, channel, product_id,
           sum(quantity_returned) as units_returned, sum(refund_amount) as refunds
    from {{ ref('int_returns_enriched') }} group by all
)
select s.month, s.region, s.channel, s.product_id, s.units, s.net_sales, s.cogs,
       coalesce(r.units_returned, 0) as units_returned, coalesce(r.refunds, 0) as refunds
from s left join r using (month, region, channel, product_id)
