with a as (select sum(actual_net_sales) as v from {{ ref('mart_budget_variance') }}),
     b as (select sum(net_sales) as v from {{ ref('fct_sales') }})
select a.v, b.v from a, b where abs(a.v - b.v) > 1
