select
    return_id,
    order_id || '-' || cast(line_number as varchar) as line_id,
    order_id,
    cast(line_number as integer) as line_number,
    product_id,
    store_id,
    cast(return_date as date) as return_date,
    cast(quantity_returned as integer) as quantity_returned,
    cast(refund_amount as double) as refund_amount,
    return_reason,
    cast(restockable as boolean) as restockable
from {{ source('raw', 'returns') }}
