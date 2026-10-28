select
    cast(snapshot_date as date) as snapshot_date,
    store_id,
    product_id,
    units_on_hand,
    units_on_order,
    units_received,
    units_demanded,
    units_short,
    cast(unit_cost as double) as unit_cost,
    units_age_0_30,
    units_age_31_60,
    units_age_61_90,
    units_age_91_180,
    units_age_180_plus,
    stockout_flag
from {{ source('raw', 'inventory') }}
