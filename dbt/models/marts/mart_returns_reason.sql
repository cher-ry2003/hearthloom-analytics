select sale_month as month, region, channel, category, return_reason,
       sum(quantity_returned) as units_returned, sum(refund_amount) as refunds
from {{ ref('int_returns_enriched') }}
group by all
