-- Allocated marketing in the P&L must equal total marketing spend.
with a as (select sum(marketing_allocated) as v from {{ ref('mart_pnl_monthly') }}),
     b as (select sum(spend) as v from {{ ref('fct_marketing') }})
select a.v, b.v from a, b where abs(a.v - b.v) > 5
