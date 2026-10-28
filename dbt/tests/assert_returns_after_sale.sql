select return_id from {{ ref('fct_returns') }} where days_to_return <= 0
