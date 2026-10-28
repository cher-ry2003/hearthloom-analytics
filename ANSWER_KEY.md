# ANSWER KEY: planted anomalies

> **Spoilers.** Hearthloom Home Co. is a synthetic business. The generator deliberately plants eight anomalies
> for variance-analysis practice. They are documented *only here*: the dashboard and the README don't mention them.
> Try to find each one yourself first (suggested starting points are in the "How to find it" column).

All figures below come from the default seed (`42`) and are reproducible with `make data`.
"Variance" means **actual net sales vs. budget** unless stated otherwise; margin means gross margin.

| # | Anomaly | Where / when | Magnitude | How to find it |
|---|---------|--------------|-----------|----------------|
| 1 | **West region misses budget for two quarters** | West region, both channels, 1 Jul to 31 Dec 2024 (Q3 and Q4) | Variance **-15.3 % (Q3)** and **-16.5 % (Q4)**, against -1 % to -3 % for every other region. Shortfall to budget of about **$1.5M** across the two quarters | `mart_budget_variance` by region x quarter; the region x category heatmap is red across *all* categories, so it is a region-wide demand shock rather than a product problem. Budget was not re-based. The quarterly forecast only catches up a quarter late. |
| 2 | **Social ROI collapses** | `social` channel, from week of 3 Mar 2025 | ROAS falls from **~3.0-3.4x to 0.7-0.9x** within 8 weeks and stays there, while spend is held **+43 % over budget** (spend ramps +45 % in four weeks) | `mart_marketing_roi`, ROAS trend by channel. Other channels are stable (email 11x, paid search 4.2x, promotions 3.5x, TV 1.8x). Marginal dollars into social destroy value. |
| 3 | **Supplier cost increase squeezes Kitchen & Dining margin** | Supplier *Ironvale Cookware Ltd* (about 60 % of Kitchen & Dining SKUs), unit cost **+16 %** from 1 Jan 2025. List prices for Kitchen & Dining were *also frozen* at the April 2025 company-wide price increase | Kitchen & Dining margin **43.9 % (Q3 2024) to ~35 % (Q2-Q3 2025)**, against a 44 % budget. Ironvale SKUs run **32.1 %** vs **45.1 %** for the other supplier (Apr-Sep 2025) | Gross margin by category over time, then drill to supplier in `dim_product`. Note Q4 2024 is also depressed by anomaly 6, so don't mistake that for the start of the squeeze. |
| 4 | **Returns spike from a bad product batch** | 8 Lighting SKUs from *Lumenco Lighting* (`SKU0177, 0185, 0188, 0190, 0191, 0193, 0196, 0202`), sold **1 Mar to 30 Jun 2024** | Lighting return rate jumps from **~4.4 % to 16-19 %** (batch SKUs about 38 %), then returns to ~4 % in July. ~92 % of batch returns are coded *Defective* | Return rate by category by sale month, then worst-offenders by SKU, then return reason. Returns are attributed to the **sale month**, so the spike lines up with the production window instead of lagging it. |
| 5 | **Port delay causes Outdoor & Garden stock-outs** | Outdoor & Garden, all locations; inbound receipts cut ~92 % for arrivals **13 Feb to 29 May 2023**; demand lost 6 Mar to 28 May | **30 %** of in-demand store-SKU cells out of stock in May 2023 (14.5 % April, normal < 1 %). Outdoor net sales **-29.5 % vs budget** for Mar-May 2023, in the peak season | Stock-out calendar heatmap (Outdoor row lights up in spring 2023); budget variance heatmap by category; inventory turns dip then spike. |
| 6 | **Early Black Friday pulls demand forward** | All locations, **1-27 Nov 2024** (extra 12 % off, demand +18 %), followed by a **December hangover** (1-20 Dec, demand -10 %) | Excluding West: Nov **+1.7 %** vs budget with margin **29.2 % vs 36.7 % budget**; Dec **-7.4 %**. Revenue was borrowed from December and bought with margin | Monthly variance excluding West (otherwise anomaly 1 masks it), month-by-month margin vs budget. The promo discount-depth distribution in `fct_sales` shows it too. |
| 7 | **Decor over-buy, then clearance** | Decor. Bulk receipt in weeks of **12-26 Feb 2024** (about 8 weeks of cover x 3 weeks); clearance **15 Jan to 31 Mar 2025** (demand x1.5, extra 20 % off) | Decor inventory value **$0.85M (Jan 2024) to $1.49M (Mar 2024)**; **95 %** of Decor stock is older than 90 days by June 2024. Q1 2025 Decor net sales **+16 % vs budget** but margin **44.9 % vs 54.9 % budget**. Turns collapse in between | Inventory ageing buckets by category over time; inventory turns by category; then Decor variance in Q1 2025: revenue beat, gross-profit miss. |
| 8 | **E-commerce platform outage** | E-commerce, all regions, **12-20 Aug 2025** (9 days) | Daily e-commerce net sales fall from **~$37k to ~$24k (-35 %)**, then rebound the day after | Daily e-commerce sales from `fct_sales` (not visible at monthly grain: August looks only mildly soft). A good lesson in grain. |

## Realistic behaviour baked in (not anomalies)

- **Seasonality:** category-specific monthly curves (Outdoor peaks Apr-Jun, Decor and Kitchen peak Nov-Dec, Storage peaks January);
  weekend lift in stores (Saturday about 1.45x the daily average); Thanksgiving and Christmas closures.
- **Promotions:** Presidents' Day, spring event, Memorial Day, July 4th, Labor Day, fall event, Black Friday/Cyber Week,
  year-end clearance. Each lifts demand and is followed by a two-week **pull-forward dip**.
- **Growth:** about 2 % comp growth; e-commerce share grows from about 9 % of net sales (2021) to about 23 % (2026 YTD).
- **Price increases:** list prices +5.0 % (Jul 2022), +3.5 % (Jul 2023), +3.0 % (Apr 2025), each followed by a small demand dip. Costs inflate 2.5 % per year.
- **Store lifecycle:** 5 new stores open during the window (Midwest Mar 2022; Northeast Apr 2023; West Sep 2023 and May 2024;
  Southeast Mar 2025) and ramp up over their first year. **One store closes** (S018 Hearthloom Nashville, 31 Jan 2025) after a four-week liquidation sale (2.5x volume, 35 % off).
- **Returns:** category base rates of 2.5-7 %, e-commerce 1.9x store rate; 3-45 day return lag (mean about 12.5 days),
  so the most recent weeks are slightly under-reported.
- **Budget and forecast:** the budget is built from the anomaly-free plan with a +1.5 % optimistic bias and noise, so a **small
  structural negative variance (-1 % to -3 %) is normal**. The quarterly forecast is the budget adjusted by 80 % of the prior
  quarter's attainment, so it always lags a sudden shift by one quarter.

## Other things to find

- Which month is the strongest and weakest for net sales in each year, and why?
- Do e-commerce return rates differ by category as much as by channel?
- Which stores underperform their size/format peers? (`mart_store_monthly`, `dim_store`)
- Which marketing channel has the best marginal efficiency in holiday weeks?
