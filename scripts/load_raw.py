"""Load the generated raw files into DuckDB (schema `raw`)."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DB = ROOT / "warehouse" / "hearthloom.duckdb"

TABLES = {
    "stores": "stores.csv", "products": "products.csv", "customers": "customers.csv",
    "sales": "sales.parquet", "returns": "returns.parquet", "inventory": "inventory.parquet",
    "marketing_spend": "marketing_spend.csv", "marketing_budget": "marketing_budget.csv",
    "marketing_forecast": "marketing_forecast.csv", "budget": "budget.csv", "forecast": "forecast.csv",
}


def main() -> None:
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    con = duckdb.connect(str(DB))
    con.execute("create schema raw")
    for name, fname in TABLES.items():
        path = RAW / fname
        if not path.exists():
            sys.exit(f"missing {path}; run `make data` first")
        reader = f"read_parquet('{path}')" if fname.endswith(".parquet") else f"read_csv('{path}', header=true, auto_detect=true)"
        con.execute(f"create table raw.{name} as select * from {reader}")
        n = con.execute(f"select count(*) from raw.{name}").fetchone()[0]
        print(f"raw.{name:<20} {n:>12,} rows")
    con.close()


if __name__ == "__main__":
    main()
