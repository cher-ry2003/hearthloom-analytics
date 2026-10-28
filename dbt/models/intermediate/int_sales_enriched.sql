-- One row per order line, enriched with store, product and the region the sale is attributed to.
-- E-commerce orders are attributed to the customer's (ship-to) region; store sales to the store's region.
select
    s.line_id,
    s.order_id,
    s.line_number,
    s.order_date,
    date_trunc('month', s.order_date)::date as order_month,
    s.store_id,
    s.customer_id,
    s.product_id,
    st.region as store_region,
    case when st.channel = 'E-commerce' then coalesce(c.region, 'Unknown') else st.region end as region,
    st.channel,
    p.category,
    p.subcategory,
    p.supplier,
    s.quantity,
    s.unit_list_price,
    s.discount_pct,
    s.unit_cost,
    s.gross_sales,
    s.discount_amount,
    s.net_sales,
    s.cogs
from {{ ref('stg_sales') }} s
join {{ ref('stg_stores') }} st on s.store_id = st.store_id
join {{ ref('stg_products') }} p on s.product_id = p.product_id
left join {{ ref('stg_customers') }} c on s.customer_id = c.customer_id
