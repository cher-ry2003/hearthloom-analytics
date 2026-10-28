-- The P&L mart must tie to the line-level fact to within a cent per thousand rows.
with a as (select sum(net_sales) as v from {{ ref('mart_pnl_monthly') }}),
     b as (select sum(net_sales) as v from {{ ref('fct_sales') }})
select a.v, b.v from a, b where abs(a.v - b.v) > 1
