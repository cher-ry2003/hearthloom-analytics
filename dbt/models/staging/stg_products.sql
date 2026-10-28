select
    product_id,
    product_name,
    category,
    subcategory,
    supplier,
    cast(launch_date as date) as launch_date,
    cast(discontinue_date as date) as discontinue_date,
    cast(base_list_price as double) as base_list_price,
    cast(base_unit_cost as double) as base_unit_cost
from {{ source('raw', 'products') }}
