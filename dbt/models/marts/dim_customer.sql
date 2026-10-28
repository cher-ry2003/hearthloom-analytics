with orders as (
    select customer_id, count(distinct order_id) as lifetime_orders, sum(net_sales) as lifetime_net_sales,
           min(order_date) as first_order_date, max(order_date) as last_order_date
    from {{ ref('int_sales_enriched') }}
    where customer_id is not null
    group by 1
)
select c.*, coalesce(o.lifetime_orders, 0) as lifetime_orders, coalesce(o.lifetime_net_sales, 0) as lifetime_net_sales,
       o.first_order_date, o.last_order_date
from {{ ref('stg_customers') }} c
left join orders o using (customer_id)
