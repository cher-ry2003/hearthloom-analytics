-- P&L by month x region x channel x category. Marketing (national, by channel) is allocated to rows by
-- share of the month's net sales, so it re-aggregates cleanly under any dashboard filter.
with a as (
    select *, sum(net_sales) over (partition by month) as month_net_sales
    from {{ ref('int_monthly_actuals') }}
),
m as (
    select month, sum(spend) as marketing_spend from {{ ref('int_marketing_monthly') }} group by 1
)
select
    a.month, a.region, a.channel, a.category,
    a.lines, a.units, a.gross_sales, a.discounts, a.net_sales,
    a.return_lines, a.units_returned, a.refunds,
    round(a.net_sales - a.refunds, 2) as net_revenue,
    a.cogs, a.cogs_recovered,
    round(a.cogs - a.cogs_recovered, 2) as net_cogs,
    round(a.net_sales - a.refunds - (a.cogs - a.cogs_recovered), 2) as gross_profit,
    round((a.net_sales - a.refunds - (a.cogs - a.cogs_recovered)) / nullif(a.net_sales - a.refunds, 0), 4) as gross_margin_pct,
    round(m.marketing_spend * a.net_sales / a.month_net_sales, 2) as marketing_allocated,
    round(a.net_sales - a.refunds - (a.cogs - a.cogs_recovered) - m.marketing_spend * a.net_sales / a.month_net_sales, 2) as contribution
from a
left join m using (month)
