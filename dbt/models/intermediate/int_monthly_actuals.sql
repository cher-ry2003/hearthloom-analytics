-- Actuals at the grain used by P&L and budget variance: month x region x channel x category.
with sales as (
    select
        order_month as month, region, channel, category,
        count(*) as lines,
        sum(quantity) as units,
        sum(gross_sales) as gross_sales,
        sum(discount_amount) as discounts,
        sum(net_sales) as net_sales,
        sum(cogs) as cogs
    from {{ ref('int_sales_enriched') }}
    group by all
),
rets as (
    select
        sale_month as month, region, channel, category,
        count(*) as return_lines,
        sum(quantity_returned) as units_returned,
        sum(refund_amount) as refunds,
        sum(cogs_recovered) as cogs_recovered
    from {{ ref('int_returns_enriched') }}
    group by all
)
select
    s.month, s.region, s.channel, s.category,
    s.lines, s.units, s.gross_sales, s.discounts, s.net_sales, s.cogs,
    coalesce(r.return_lines, 0) as return_lines,
    coalesce(r.units_returned, 0) as units_returned,
    coalesce(r.refunds, 0) as refunds,
    coalesce(r.cogs_recovered, 0) as cogs_recovered
from sales s
left join rets r using (month, region, channel, category)
