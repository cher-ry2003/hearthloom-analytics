-- Net sales on any order line must be positive.
select line_id from {{ ref('fct_sales') }} where net_sales <= 0
