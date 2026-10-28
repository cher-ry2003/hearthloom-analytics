select
    return_id, line_id, order_id, product_id, store_id, return_date, sale_date, sale_month, days_to_return,
    region, channel, category, supplier, quantity_returned, refund_amount, return_reason, restockable, cogs_recovered
from {{ ref('int_returns_enriched') }}
