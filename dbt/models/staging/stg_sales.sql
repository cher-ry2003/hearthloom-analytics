select
    order_id || '-' || cast(line_number as varchar) as line_id,
    order_id,
    cast(line_number as integer) as line_number,
    cast(order_date as date) as order_date,
    store_id,
    customer_id,
    product_id,
    cast(quantity as integer) as quantity,
    cast(unit_list_price as double) as unit_list_price,
    cast(discount_pct as double) as discount_pct,
    cast(unit_cost as double) as unit_cost,
    round(quantity * unit_list_price, 2) as gross_sales,
    round(quantity * unit_list_price * discount_pct, 2) as discount_amount,
    round(quantity * unit_list_price * (1 - discount_pct), 2) as net_sales,
    round(quantity * unit_cost, 2) as cogs
from {{ source('raw', 'sales') }}
