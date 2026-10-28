select
    customer_id,
    first_name || ' ' || last_name as full_name,
    email,
    state,
    region,
    cast(signup_date as date) as signup_date,
    loyalty_tier,
    acquisition_channel
from {{ source('raw', 'customers') }}
