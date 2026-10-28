select forecast_quarter, cast(month as date) as month, channel, cast(forecast_spend as double) as forecast_spend
from {{ source('raw', 'marketing_forecast') }}
