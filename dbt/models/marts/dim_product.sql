select
    product_id, product_name, category, subcategory, supplier,
    launch_date, discontinue_date, base_list_price, base_unit_cost,
    round(1 - base_unit_cost / base_list_price, 4) as base_gross_margin_pct
from {{ ref('stg_products') }}
