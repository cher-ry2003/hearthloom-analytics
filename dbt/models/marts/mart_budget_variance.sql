-- Actual vs budget vs quarterly forecast on net sales (before returns) and COGS.
with a as (
    select month, region, channel, category, net_sales as actual_net_sales, cogs as actual_cogs
    from {{ ref('int_monthly_actuals') }}
),
b as (select month, region, channel, category, budget_net_sales, budget_cogs from {{ ref('stg_budget') }}),
f as (select month, region, channel, category, forecast_net_sales, forecast_cogs, forecast_quarter from {{ ref('stg_forecast') }}),
j as (
    select
        coalesce(a.month, b.month, f.month) as month,
        coalesce(a.region, b.region, f.region) as region,
        coalesce(a.channel, b.channel, f.channel) as channel,
        coalesce(a.category, b.category, f.category) as category,
        coalesce(a.actual_net_sales, 0) as actual_net_sales,
        coalesce(a.actual_cogs, 0) as actual_cogs,
        coalesce(b.budget_net_sales, 0) as budget_net_sales,
        coalesce(b.budget_cogs, 0) as budget_cogs,
        coalesce(f.forecast_net_sales, 0) as forecast_net_sales,
        coalesce(f.forecast_cogs, 0) as forecast_cogs
    from a
    full outer join b using (month, region, channel, category)
    full outer join f using (month, region, channel, category)
)
select
    *,
    actual_net_sales - actual_cogs as actual_gross_profit,
    budget_net_sales - budget_cogs as budget_gross_profit,
    forecast_net_sales - forecast_cogs as forecast_gross_profit,
    actual_net_sales - budget_net_sales as net_sales_var_vs_budget,
    round((actual_net_sales - budget_net_sales) / nullif(budget_net_sales, 0), 4) as net_sales_var_pct_vs_budget,
    actual_net_sales - forecast_net_sales as net_sales_var_vs_forecast,
    round((actual_net_sales - forecast_net_sales) / nullif(forecast_net_sales, 0), 4) as net_sales_var_pct_vs_forecast
from j
