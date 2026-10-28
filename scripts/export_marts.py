"""Export dbt marts from DuckDB to compact columnar JSON for the static dashboard.

Format per file: {"cols": [...], "rows": [[...], ...]} where string columns are dictionary-encoded as integer
indices into meta.json -> dicts[<col>], and months / weeks are indices into meta.json -> months / weeks.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "warehouse" / "hearthloom.duckdb"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dashboard" / "public" / "data"

REGIONS = ["Northeast", "Southeast", "Midwest", "West", "E-commerce"]
CHANNELS = ["In-store", "E-commerce"]
CATEGORIES = ["Furniture", "Bedding & Bath", "Kitchen & Dining", "Decor", "Lighting",
              "Storage & Organization", "Outdoor & Garden", "Rugs & Textiles"]
MKT = ["paid_search", "social", "email", "tv", "promotions"]
REASONS = ["Defective", "Not as described", "Changed mind", "Wrong size/color", "Damaged in shipping", "Arrived late"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB), read_only=True)
    months = [r[0] for r in con.execute("select distinct month from marts.mart_pnl_monthly order by 1").fetchall()]
    weeks = [r[0] for r in con.execute("select distinct week_start from marts.mart_stockout_weekly order by 1").fetchall()]
    mw = [r[0] for r in con.execute("select distinct week_start from marts.fct_marketing order by 1").fetchall()]
    products = con.execute("select product_id, product_name, category, subcategory, supplier from marts.dim_product order by 1").fetchall()
    stores = con.execute("select store_id, store_name, region, store_status, open_date, close_date from marts.dim_store order by 1").fetchall()
    dicts = {
        "region": REGIONS, "channel": CHANNELS, "category": CATEGORIES, "mkt_channel": MKT, "reason": REASONS,
        "product": [p[0] for p in products], "store": [s[0] for s in stores],
    }
    m_ix = {m: i for i, m in enumerate(months)}
    w_ix = {w: i for i, w in enumerate(weeks)}
    mw_ix = {w: i for i, w in enumerate(mw)}

    def dump(name, sql, enc, num_round=0):
        """enc maps column -> one of 'm','w','mw' or a dict name; other columns are numeric."""
        cur = con.execute(sql)
        cols = [d[0] for d in cur.description]
        lookups = {}
        for c, kind in enc.items():
            lookups[c] = {"m": m_ix, "w": w_ix, "mw": mw_ix}.get(kind) or {v: i for i, v in enumerate(dicts[kind])}
        rows = []
        for r in cur.fetchall():
            out = []
            for c, v in zip(cols, r):
                if c in lookups:
                    out.append(lookups[c][v])
                elif v is None:
                    out.append(None)
                elif isinstance(v, float):
                    out.append(round(v, num_round) if num_round else int(round(v)))
                else:
                    out.append(int(v) if isinstance(v, (int, bool)) else v)
            rows.append(out)
        (OUT / f"{name}.json").write_text(json.dumps({"cols": cols, "rows": rows}, separators=(",", ":")))
        print(f"{name:<18} {len(rows):>7,} rows  {(OUT / f'{name}.json').stat().st_size / 1024:>8,.0f} KB")

    dump("pnl", """select month, region, channel, category, lines, units, gross_sales, discounts, net_sales,
                   units_returned, refunds, cogs, cogs_recovered, marketing_allocated
                   from marts.mart_pnl_monthly order by 1,2,3,4""",
         {"month": "m", "region": "region", "channel": "channel", "category": "category"})
    dump("orders", "select month, region, channel, orders, customers from marts.mart_orders_monthly order by 1,2,3",
         {"month": "m", "region": "region", "channel": "channel"})
    dump("variance", """select month, region, channel, category, actual_net_sales, budget_net_sales, forecast_net_sales,
                        actual_cogs, budget_cogs, forecast_cogs from marts.mart_budget_variance order by 1,2,3,4""",
         {"month": "m", "region": "region", "channel": "channel", "category": "category"})
    dump("marketing", """select month, channel, spend, impressions, clicks, attributed_orders, attributed_revenue,
                         budget_spend, forecast_spend from marts.mart_marketing_roi order by 1,2""",
         {"month": "m", "channel": "mkt_channel"})
    dump("marketing_weekly", "select week_start, channel, spend, attributed_revenue from marts.fct_marketing order by 1,2",
         {"week_start": "mw", "channel": "mkt_channel"})
    dump("inventory", """select month, region, channel, category, cogs, avg_inv_value, snapshots, ending_inv_value,
                         aged_0_30, aged_31_60, aged_61_90, aged_91_180, aged_180_plus, demand_cells, stockout_cells
                         from marts.mart_inventory_monthly order by 1,2,3,4""",
         {"month": "m", "region": "region", "channel": "channel", "category": "category"})
    dump("stockouts", "select week_start, region, channel, category, demand_cells, stockout_cells from marts.mart_stockout_weekly order by 1,2,3,4",
         {"week_start": "w", "region": "region", "channel": "channel", "category": "category"})
    dump("product_monthly", """select month, region, channel, product_id, units, net_sales, cogs, units_returned, refunds
                               from marts.mart_product_monthly order by 1,2,3,4""",
         {"month": "m", "region": "region", "channel": "channel", "product_id": "product"})
    dump("returns_reason", """select month, region, channel, category, return_reason, units_returned, refunds
                              from marts.mart_returns_reason order by 1,2,3,4,5""",
         {"month": "m", "region": "region", "channel": "channel", "category": "category", "return_reason": "reason"})
    dump("store_monthly", "select month, store_id, net_sales, cogs, orders, units from marts.mart_store_monthly order by 1,2",
         {"month": "m", "store_id": "store"})

    first, last = months[0], months[-1]
    meta = {
        "company": "Hearthloom Home Co.",
        "first_month": str(first), "last_month": str(last),
        "months": [str(m) for m in months], "weeks": [str(w) for w in weeks], "marketing_weeks": [str(w) for w in mw],
        "dicts": dicts,
        "products": [{"id": p[0], "name": p[1], "category": p[2], "subcategory": p[3], "supplier": p[4]} for p in products],
        "stores": [{"id": s[0], "name": s[1], "region": s[2], "status": s[3], "open": str(s[4]), "close": str(s[5]) if s[5] else None} for s in stores],
    }
    (OUT / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    total = sum(f.stat().st_size for f in OUT.glob("*.json")) / 1024
    print(f"meta.json written; total {total:,.0f} KB across {len(list(OUT.glob('*.json')))} files")


if __name__ == "__main__":
    main()
