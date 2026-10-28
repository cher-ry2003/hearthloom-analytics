select
    store_id,
    store_name,
    city,
    state,
    region,
    format as store_format,
    cast(sq_ft as integer) as sq_ft,
    cast(open_date as date) as open_date,
    cast(close_date as date) as close_date,
    channel,
    close_date is null as is_open
from {{ source('raw', 'stores') }}
