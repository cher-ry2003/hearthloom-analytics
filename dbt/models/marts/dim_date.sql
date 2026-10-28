with d as (
    select cast(d as date) as date_day
    from generate_series(date '2021-10-01', date '2026-12-31', interval 1 day) t(d)
)
select
    cast(strftime(date_day, '%Y%m%d') as integer) as date_key,
    date_day,
    year(date_day) as year,
    quarter(date_day) as quarter,
    year(date_day) || '-Q' || quarter(date_day) as year_quarter,
    month(date_day) as month_num,
    strftime(date_day, '%b') as month_name,
    date_trunc('month', date_day)::date as month_start,
    date_trunc('week', date_day)::date as week_start,
    isodow(date_day) as day_of_week,
    isodow(date_day) >= 6 as is_weekend,
    month(date_day) in (11, 12) as is_peak_season,
    year(date_day) as fiscal_year
from d
