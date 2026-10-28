import datetime as dt

import numpy as np
import pandas as pd

from datagen import config as C
from datagen.generate import generate
from datagen.config import Settings


def test_catalog_sizes(data):
    stores, products = data["stores"], data["products"]
    assert (stores.channel == "In-store").sum() == 40
    assert (stores.channel == "E-commerce").sum() == 1
    assert set(stores[stores.channel == "In-store"].region) == set(C.REGIONS)
    assert len(products) == 300
    assert products.category.nunique() == 8
    assert len(data["customers"]) == 10_000


def test_store_lifecycle(data):
    stores = data["stores"]
    assert stores.close_date.notna().sum() == 1
    assert (pd.to_datetime(stores.open_date) > pd.Timestamp(C.START)).sum() == 5
    closed = stores[stores.close_date.notna()].iloc[0]
    s = data["sales"]
    after = s[(s.store_id == closed.store_id) & (s.order_date > pd.Timestamp(closed.close_date))]
    assert after.empty, "closed store must not trade after its close date"


def test_prices_and_costs_positive(data):
    s, p = data["sales"], data["products"]
    assert (s.unit_list_price > 0).all() and (s.unit_cost > 0).all()
    assert (p.base_list_price > 0).all() and (p.base_unit_cost > 0).all()
    assert (p.base_unit_cost < p.base_list_price).all(), "every SKU should have positive gross margin"
    assert (s.quantity >= 1).all()
    assert s.discount_pct.between(0, 0.8).all()


def test_dates_in_range(data):
    s, r, inv = data["sales"], data["returns"], data["inventory"]
    assert s.order_date.min() >= pd.Timestamp(C.START) and s.order_date.max() <= pd.Timestamp(C.END)
    assert r.return_date.max() <= pd.Timestamp(C.ASOF)
    assert inv.snapshot_date.min() >= pd.Timestamp(C.START) and inv.snapshot_date.max() <= pd.Timestamp(C.END)
    assert (inv.snapshot_date.dt.day_of_week == 6).all(), "snapshots are taken on Sundays"


def test_referential_integrity(data):
    s, r = data["sales"], data["returns"]
    assert set(s.store_id) <= set(data["stores"].store_id)
    assert set(s.product_id) <= set(data["products"].product_id)
    assert set(s.customer_id.dropna()) <= set(data["customers"].customer_id)
    keys = s[["order_id", "line_number"]].drop_duplicates()
    assert len(keys) == len(s), "(order_id, line_number) must be unique"
    assert len(r.merge(keys, on=["order_id", "line_number"])) == len(r)
    assert (r.quantity_returned >= 1).all() and (r.refund_amount > 0).all()


def test_returns_after_sale_and_ecom_higher(data):
    s, r, p = data["sales"], data["returns"], data["products"]
    m = r.merge(s[["order_id", "line_number", "order_date", "quantity"]], on=["order_id", "line_number"])
    assert (m.return_date > m.order_date).all()
    assert (m.quantity_returned <= m.quantity).all()
    s = s.assign(ecom=s.store_id == "ECOM")
    rr = r.merge(s[["order_id", "line_number", "ecom"]], on=["order_id", "line_number"]).groupby("ecom").size()
    base = s.groupby("ecom").size()
    assert rr[True] / base[True] > 1.4 * rr[False] / base[False]


def test_seasonality_present(data):
    s = data["sales"]
    rev = (s.quantity * s.unit_list_price * (1 - s.discount_pct)).groupby(s.order_date.dt.to_period("M")).sum()
    by_month = rev[rev.index.year == 2023]  # a year without a planted Dec anomaly
    assert by_month[by_month.index.month == 12].iloc[0] > 1.25 * by_month[by_month.index.month == 2].iloc[0]
    assert by_month[by_month.index.month == 11].iloc[0] > by_month[by_month.index.month == 9].iloc[0]


def test_weekend_lift_in_stores(data):
    s = data["sales"]
    st = s[s.store_id != "ECOM"]
    daily = st.groupby("order_date").size()
    dow = daily.groupby(daily.index.day_of_week).mean()
    assert dow[5] > 1.3 * dow[1]


def test_ecommerce_share_grows(data):
    s = data["sales"].assign(rev=lambda d: d.quantity * d.unit_list_price * (1 - d.discount_pct))
    share = s.groupby(s.order_date.dt.year).apply(lambda d: d.rev[d.store_id == "ECOM"].sum() / d.rev.sum())
    assert share.loc[2025] > share.loc[2022] + 0.05


def test_price_increases_land(data):
    s = data["sales"]
    sku = s.product_id.value_counts().index[0]
    x = s[s.product_id == sku].set_index("order_date").unit_list_price.resample("MS").median().dropna()
    assert x.loc["2022-08":"2022-09"].mean() > x.loc["2022-05":"2022-06"].mean()


def test_promo_pull_forward(data):
    s = data["sales"]
    d = s[s.store_id != "ECOM"].groupby("order_date").quantity.sum()
    bf = d.loc["2023-11-24"]
    assert bf > 1.5 * d.loc["2023-11-06":"2023-11-12"].mean()


def test_planted_anomalies_visible(data):
    s, r, p, inv, mkt = data["sales"], data["returns"], data["products"], data["inventory"], data["marketing"]
    # A4 bad Lighting batch
    bad = data["meta"]["bad_batch_skus"]
    win = s[s.product_id.isin(bad) & s.order_date.between("2024-03-01", "2024-06-30")]
    rr = r.merge(win[["order_id", "line_number"]], on=["order_id", "line_number"]).quantity_returned.sum() / win.quantity.sum()
    assert rr > 0.2
    # A2 social ROAS collapse
    soc = mkt[mkt.channel == "social"].assign(w=lambda d: pd.to_datetime(d.week_start))
    before = soc[soc.w < "2025-03-01"]; after = soc[soc.w > "2025-06-01"]
    assert after.attributed_revenue.sum() / after.spend.sum() < 0.4 * before.attributed_revenue.sum() / before.spend.sum()
    # A5 outdoor stock-outs
    out = inv.merge(p[["product_id", "category"]], on="product_id")
    out = out[(out.category == "Outdoor & Garden") & (out.units_demanded > 0)]
    spring = out[out.snapshot_date.between("2023-04-15", "2023-05-31")].stockout_flag.mean()
    normal = out[out.snapshot_date.between("2024-04-15", "2024-05-31")].stockout_flag.mean()
    assert spring > normal + 0.15


def test_budget_and_forecast_shape(data):
    b, f = data["budget"], data["forecast"]
    n_months = 60
    assert b.month.nunique() == n_months
    assert len(b) >= 0.98 * n_months * 4 * 2 * 8  # every region x channel x category x month cell is planned
    assert (b.budget_net_sales > 0).all() and (b.budget_cogs > 0).all()
    assert f.forecast_quarter.nunique() == 20
    assert (b.budget_cogs < b.budget_net_sales).all()


def test_reproducible(tmp_path):
    a = generate(Settings(scale=0.01, n_customers=500, seed=7), tmp_path / "a", verbose=False)
    b = generate(Settings(scale=0.01, n_customers=500, seed=7), tmp_path / "b", verbose=False)
    pd.testing.assert_frame_equal(a["sales"], b["sales"])
    pd.testing.assert_frame_equal(a["returns"], b["returns"])
