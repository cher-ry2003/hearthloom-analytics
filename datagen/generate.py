"""Orchestrates the full data generation. Run: python -m datagen.generate --out data/raw"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from . import catalog, ops, planning, sales
from .config import Settings


def generate(settings: Settings, out: Path, verbose: bool = True) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(settings.seed)
    t0 = time.time()

    def log(msg):
        if verbose:
            print(f"[{time.time() - t0:6.1f}s] {msg}", flush=True)

    stores = catalog.build_stores(rng)
    products = catalog.build_products(rng)
    customers = catalog.build_customers(rng, settings.n_customers)
    log(f"catalog: {len(stores)} stores, {len(products)} products, {len(customers)} customers")
    s, returns, cells, weekly, meta, _ = sales.build_sales(settings, stores, products, customers, rng)
    log(f"sales: {len(s):,} lines, {meta['orders']:,} orders, {len(returns):,} returns")
    mkt, plan_weekly = ops.build_marketing(weekly, settings, rng)
    log(f"marketing: {len(mkt)} channel-weeks")
    inv = ops.build_inventory(s, products, stores, settings, rng)
    log(f"inventory: {len(inv):,} snapshots")
    budget, forecast = planning.build_budget_forecast(cells, rng)
    mkt_budget, mkt_forecast = planning.build_marketing_plan(plan_weekly, mkt, rng)

    # small tables -> CSV, big tables -> Parquet
    stores_out = stores.drop(columns=["size_factor"])
    stores_out.to_csv(out / "stores.csv", index=False)
    products.drop(columns=["popularity"]).to_csv(out / "products.csv", index=False)
    customers.to_csv(out / "customers.csv", index=False)
    budget.to_csv(out / "budget.csv", index=False)
    forecast.to_csv(out / "forecast.csv", index=False)
    mkt_budget.to_csv(out / "marketing_budget.csv", index=False)
    mkt_forecast.to_csv(out / "marketing_forecast.csv", index=False)
    mkt.to_csv(out / "marketing_spend.csv", index=False)
    s.to_parquet(out / "sales.parquet", index=False)
    returns.to_parquet(out / "returns.parquet", index=False)
    inv.to_parquet(out / "inventory.parquet", index=False)
    meta["seconds"] = round(time.time() - t0, 1)
    (out / "_generation_meta.json").write_text(json.dumps(meta, indent=2))
    log("done")
    return dict(stores=stores, products=products, customers=customers, sales=s, returns=returns, inventory=inv,
                marketing=mkt, budget=budget, forecast=forecast, meta=meta)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    generate(Settings(seed=a.seed, scale=a.scale), Path(a.out))


if __name__ == "__main__":
    main()
