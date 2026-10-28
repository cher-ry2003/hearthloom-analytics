select
    store_id, store_name, city, state, region, channel, store_format, sq_ft, open_date, close_date,
    case
        when channel = 'E-commerce' then 'Online'
        when close_date is not null then 'Closed'
        when open_date > date '2021-10-01' then 'New (opened in window)'
        else 'Mature'
    end as store_status
from {{ ref('stg_stores') }}
