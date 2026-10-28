select
    fiscal_year,
    cast(month as date) as month,
    region,
    channel,
    category,
    cast(budget_net_sales as double) as budget_net_sales,
    cast(budget_cogs as double) as budget_cogs
from {{ source('raw', 'budget') }}
