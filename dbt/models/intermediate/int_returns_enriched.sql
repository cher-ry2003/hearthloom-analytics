-- Returns joined back to the original sale line. Returns are attributed to the month of the ORIGINAL sale,
-- which keeps return rates comparable across periods (cohort view).
select
    r.return_id,
    r.line_id,
    r.order_id,
    r.product_id,
    r.store_id,
    r.return_date,
    s.order_date as sale_date,
    s.order_month as sale_month,
    date_diff('day', s.order_date, r.return_date) as days_to_return,
    s.region,
    s.channel,
    s.category,
    s.subcategory,
    s.supplier,
    r.quantity_returned,
    r.refund_amount,
    r.return_reason,
    r.restockable,
    case when r.restockable then round(r.quantity_returned * s.unit_cost, 2) else 0 end as cogs_recovered
from {{ ref('stg_returns') }} r
join {{ ref('int_sales_enriched') }} s on r.line_id = s.line_id
