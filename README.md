<div align="center">

# Hearthloom Analytics

### A fake company with real problems to find.
Five years of retail data, a dbt + DuckDB warehouse, and a hand-built dashboard. Fully reproducible, one command to run.

[![Live dashboard](https://img.shields.io/badge/live-dashboard-4338ca?style=for-the-badge)](https://cher-ry2003.github.io/hearthloom-analytics/)
[![dbt docs](https://img.shields.io/badge/dbt-docs%20%26%20lineage-ff694b?style=for-the-badge&logo=dbt&logoColor=white)](https://cher-ry2003.github.io/hearthloom-analytics/dbt-docs/index.html)
[![Build](https://github.com/cher-ry2003/hearthloom-analytics/actions/workflows/deploy.yml/badge.svg)](https://github.com/cher-ry2003/hearthloom-analytics/actions/workflows/deploy.yml)
![dbt tests](https://img.shields.io/badge/dbt%20tests-103%20passing-2ea44f)
![License](https://img.shields.io/badge/license-MIT-blue)

![dbt](https://img.shields.io/badge/dbt-DuckDB-fff000?logo=duckdb&logoColor=black)
![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-149eca?logo=react&logoColor=white)
![ECharts](https://img.shields.io/badge/Apache-ECharts-aa344d)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss&logoColor=white)

**[Open the live dashboard](https://cher-ry2003.github.io/hearthloom-analytics/)**

<a href="https://cher-ry2003.github.io/hearthloom-analytics/"><img src="docs/screenshots/overview-light.png" alt="Hearthloom executive overview dashboard" width="860"></a>

</div>

## Why this exists

Most public datasets are clean, tiny, and have nothing hidden in them. Real analysis work is the opposite: a region
quietly misses plan, a channel stops paying back, a supplier raises costs and a margin slips. This project gives you a
believable business where those things have **already happened**, so you can practise finding them, from raw tables
through dbt models to a dashboard.

- **Practise variance analysis** on a budget, a quarterly forecast and five years of actuals.
- **Learn analytics engineering** from a complete, tested dbt project (staging, intermediate, marts, 103 tests).
- **Study dashboard design** in a hand-built React site, not a BI tool: light and dark themes, keyboard focus, AA contrast.
- **Reuse it**: the generator is seeded, so everyone sees the same numbers, and CI rebuilds the whole thing on every push.

> There are **8 hidden problems** in the data. The dashboard never mentions them. When you want to check your work,
> [`ANSWER_KEY.md`](ANSWER_KEY.md) lists each one with how to find it (spoilers).

## Try it in 60 seconds

```bash
git clone https://github.com/cher-ry2003/hearthloom-analytics.git
cd hearthloom-analytics
make setup   # virtualenv + Python and Node dependencies (once)
make all     # generate data -> DuckDB -> dbt build + tests -> JSON -> static site in dashboard/dist
make dev     # open the dashboard locally with hot reload
```

Or skip setup entirely and just [use the live dashboard](https://cher-ry2003.github.io/hearthloom-analytics/).

**Contents:** [The company](#the-company) · [Architecture](#architecture) · [Run locally](#run-everything-locally) ·
[dbt lineage](#dbt-model-lineage) · [Dashboard](#the-dashboard) · [Practice questions](#practice-questions) · [Layout](#repository-layout)

## The company

**Hearthloom Home Co.** is an invented mid-size US home-goods retailer.

| | |
|---|---|
| Footprint | 40 physical stores in 4 regions (Northeast, Southeast, Midwest, West) plus an e-commerce channel |
| Catalogue | 300 SKUs in 8 categories (Furniture, Bedding & Bath, Kitchen & Dining, Decor, Lighting, Storage & Organization, Outdoor & Garden, Rugs & Textiles), 12 suppliers |
| Customers | 50,000 synthetic customers (Faker) |
| History | Oct 2021 to Sep 2026 (60 months, about 4.0M order lines, about 2.2M orders), roughly $70M of net sales a year |
| Behaviour | Holiday and category seasonality, weekend lift, promo spikes that pull demand forward, steady e-commerce growth (about 9% to 23% of sales), three list-price increases, five store openings with ramp-up, one store closure with a liquidation sale |
| Planning | An annual budget and a quarterly re-forecast for net sales, COGS and marketing |

The data deliberately contains a handful of hidden problems to find. They are listed, with how to detect each one,
in [`ANSWER_KEY.md`](ANSWER_KEY.md) (spoilers; the dashboard never mentions them).

## Architecture

```mermaid
flowchart LR
    G["Python generator<br/>(seeded, Faker)"] -->|CSV + Parquet| R[("DuckDB<br/>schema raw")]
    R --> S["dbt staging<br/>views"]
    S --> I["dbt intermediate<br/>tables"]
    I --> M["dbt marts<br/>facts, dims, KPI marts"]
    M -->|export_marts.py| J["Compact columnar JSON"]
    J --> D["Vite + React + TypeScript<br/>Tailwind + ECharts"]
    D -->|static build| P["GitHub Pages"]
    M -->|dbt docs| DOC["dbt docs site"]
    DOC --> P
    CI["GitHub Actions"] -.->|"on every push to main"| G
```

No backend: the dashboard is a static site that fetches pre-aggregated JSON and does all filtering in the browser.
The raw data and the `.duckdb` file are not committed; CI regenerates everything on each push.

## Run everything locally

Requirements: Python 3.11+, Node 20.19+ or 22, `make`.

```bash
make setup   # one time: virtualenv, Python and Node dependencies
make all     # generate data -> DuckDB -> dbt build + tests -> JSON export -> static site in dashboard/dist
make dev     # optional: dashboard dev server with hot reload
make test    # pytest for the generator
```

Individual steps: `make data`, `make load`, `make dbt`, `make export`, `make dashboard`, `make screenshots`.
A full run takes about a minute. To explore the warehouse directly:

```bash
.venv/bin/python -c "import duckdb; duckdb.connect('warehouse/hearthloom.duckdb').sql('select * from marts.mart_pnl_monthly limit 5').show()"
```

## dbt model lineage

```mermaid
flowchart LR
    subgraph raw
      r1[sales]; r2[returns]; r3[inventory]; r4[marketing_spend]; r5[budget / forecast]; r6[stores / products / customers]
    end
    subgraph staging
      s1[stg_sales]; s2[stg_returns]; s3[stg_inventory]; s4[stg_marketing_*]; s5[stg_budget / stg_forecast]; s6[stg_stores / stg_products / stg_customers]
    end
    subgraph intermediate
      i1[int_sales_enriched]; i2[int_returns_enriched]; i3[int_monthly_actuals]; i4[int_inventory_valued]; i5[int_marketing_monthly]
    end
    subgraph marts
      f1[fct_sales]; f2[fct_returns]; f3[fct_inventory]; f4[fct_marketing]
      d1[dim_store]; d2[dim_product]; d3[dim_date]; d4[dim_customer]
      m1[mart_pnl_monthly]; m2[mart_budget_variance]; m3[mart_marketing_roi]; m4[mart_inventory_monthly]; m5[mart_stockout_weekly]; m6[mart_product_monthly]; m7[mart_returns_reason]
    end
    r1 --> s1; r2 --> s2; r3 --> s3; r4 --> s4; r5 --> s5; r6 --> s6
    s1 & s6 --> i1
    s2 & i1 --> i2
    i1 & i2 --> i3
    s3 & s6 --> i4
    s4 --> i5
    i1 --> f1; i2 --> f2; i4 --> f3; s4 --> f4
    s6 --> d1 & d2
    i3 & i5 --> m1
    i3 & s5 & s4 --> m2
    i5 & s4 --> m3
    f3 & i1 --> m4
    f3 --> m5
    i1 & i2 --> m6 & m7
```

Layers: **staging** (rename, cast, derive line amounts), **intermediate** (joins and attribution rules, such as
e-commerce sales belonging to the customer's region and returns attributed to the original sale month), **marts**
(facts, dimensions and the business-facing KPI tables). 103 tests cover uniqueness, not-null, relationships,
accepted values, and reconciliation (the P&L mart ties to `fct_sales`, allocated marketing ties to spend).

Business definitions worth knowing:

- **Net sales** = list price × quantity − discounts. **Net revenue** = net sales − refunds. **Gross profit** = net revenue − (COGS − COGS recovered on restockable returns).
- The budget and forecast are on **net sales before returns**, so the variance page works on a pre-returns margin.
- **ROAS** = attributed revenue ÷ spend. **Inventory turns** = annualised COGS ÷ average inventory at cost.

## The dashboard

Vite, React, TypeScript, Tailwind and Apache ECharts with a custom theme; fonts are self-hosted via Fontsource
(Instrument Serif for titles, Geist for UI, Geist Mono with tabular figures for numbers). Light and dark themes
(remembered), global date / region / channel filters, WCAG AA contrast, keyboard focus states and ARIA labels on charts.
Direction of change is always shown with an arrow and a sign, never by colour alone.

| Budget vs actual vs forecast (dark) | Marketing |
|---|---|
| ![Budget](docs/screenshots/budget-dark.png) | ![Marketing](docs/screenshots/marketing-light.png) |
| **Products and returns** | **Inventory (dark)** |
| ![Products](docs/screenshots/products-light.png) | ![Inventory](docs/screenshots/inventory-dark.png) |

## Practice questions

Variance and planning
1. Which region and category combinations missed budget the most over the last 24 months? Is each miss a volume problem, a price problem, or a margin problem?
2. The quarterly forecast always lags reality by a quarter. Quantify the forecast error by quarter versus the budget error. When is the forecast better, and when is it worse?
3. Rebuild the net-sales variance as a price / volume / mix bridge for one region and one year.
4. Which months show the largest swing between the budget and actual gross margin, and what explains each?

Marketing
5. Which channel's return on ad spend changed the most, and when? What would you have recommended at that point?
6. What is the marginal ROAS of each channel in holiday weeks versus the rest of the year?
7. Compare channel spend with the budget over time. Where did spending drift above plan, and did returns justify it?

Products and returns
8. Which categories have a return rate that differs most by channel? Is the gap constant over time?
9. Is there a product group whose returns jumped for a limited window? How would you prove it is tied to a supplier or a production period rather than demand?
10. How much margin is lost to defective returns, and how much would be recovered by restocking?

Inventory
11. Which categories have the lowest turns, and how much of their inventory is older than 90 days?
12. When did stock-outs spike, for which category, and what happened to sales in the same period?
13. Find a period where an inventory build was followed by heavy discounting. What did it do to margin?

Time, grain and structure
14. Which events pull demand forward, and how large is the following dip? Quantify it for each promotion.
15. Some problems are only visible at daily grain. Find one, and explain why monthly reporting hides it.
16. How do new stores ramp up compared with mature ones, and what did the store closure do to its region?
17. What share of returns falls in the last weeks of the data, and how should you adjust return rates for that lag?

## Repository layout

```
datagen/         seeded generator (catalog, sales + returns, marketing, inventory, budget + forecast)
tests/           pytest suite for the generator
scripts/         load_raw.py (CSV/Parquet -> DuckDB), export_marts.py (marts -> JSON)
dbt/             dbt Core project (dbt-duckdb): staging, intermediate, marts, tests
dashboard/       Vite + React + TypeScript site (+ Playwright screenshot script)
docs/screenshots dashboard screenshots used in this README
.github/         CI: test, generate, dbt build, export, build site, deploy to GitHub Pages
ANSWER_KEY.md    spoilers: planted anomalies and how to find them
```

Everything here is synthetic. Hearthloom Home Co. does not exist, and any resemblance to a real retailer is coincidental.
