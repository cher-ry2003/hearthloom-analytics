select
    forecast_quarter,
    cast(month as date) as month,
    region,
    channel,
    category,
    cast(forecast_net_sales as double) as forecast_net_sales,
    cast(forecast_cogs as double) as forecast_cogs
from {{ source('raw', 'forecast') }}
