-- Weekly snapshot per location x SKU with value and dimensions attached.
select
    i.snapshot_date,
    date_trunc('month', i.snapshot_date)::date as snapshot_month,
    i.snapshot_date - 6 as week_start,
    i.store_id,
    st.region,
    st.channel,
    i.product_id,
    p.category,
    i.units_on_hand,
    i.units_on_order,
    i.units_received,
    i.units_demanded,
    i.units_short,
    i.stockout_flag,
    i.unit_cost,
    round(i.units_on_hand * i.unit_cost, 2) as inventory_value,
    round(i.units_age_0_30 * i.unit_cost, 2) as value_age_0_30,
    round(i.units_age_31_60 * i.unit_cost, 2) as value_age_31_60,
    round(i.units_age_61_90 * i.unit_cost, 2) as value_age_61_90,
    round(i.units_age_91_180 * i.unit_cost, 2) as value_age_91_180,
    round(i.units_age_180_plus * i.unit_cost, 2) as value_age_180_plus
from {{ ref('stg_inventory') }} i
join {{ ref('stg_stores') }} st on i.store_id = st.store_id
join {{ ref('stg_products') }} p on i.product_id = p.product_id
