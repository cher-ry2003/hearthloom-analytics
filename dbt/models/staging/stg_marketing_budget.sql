select fiscal_year, cast(month as date) as month, channel, cast(budget_spend as double) as budget_spend
from {{ source('raw', 'marketing_budget') }}
