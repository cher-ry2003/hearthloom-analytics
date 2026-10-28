select
    line_id, order_id, line_number, order_date, store_id, customer_id, product_id,
    region, channel, category,
    quantity, unit_list_price, discount_pct, unit_cost,
    gross_sales, discount_amount, net_sales, cogs,
    round(net_sales - cogs, 2) as gross_profit
from {{ ref('int_sales_enriched') }}
