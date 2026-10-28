"""Marketing spend and weekly inventory simulation."""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from . import config as C

BASE_SHARE = {"paid_search": 0.30, "social": 0.20, "email": 0.08, "tv": 0.22, "promotions": 0.20}
BASE_ROAS = {"paid_search": 4.2, "social": 3.0, "email": 11.0, "tv": 1.8, "promotions": 3.5}
CPC = {"paid_search": 1.40, "social": 0.95, "email": 0.0, "tv": 0.0, "promotions": 0.0}
CPM = {"paid_search": 0.0, "social": 9.0, "email": 4.0, "tv": 18.0, "promotions": 12.0}
CTR = {"paid_search": 0.045, "social": 0.011, "email": 0.028, "tv": 0.0, "promotions": 0.006}
SOCIAL_BREAK = date(2025, 3, 3)  # A2


def build_marketing(weekly: pd.DataFrame, settings, rng: np.random.Generator):
    """Returns (actual weekly marketing, clean/planned weekly spend). Marketing starts on the first full Monday."""
    weekly = weekly[pd.to_datetime(weekly.week_start) >= pd.Timestamp(settings.start)].reset_index(drop=True)
    ws = pd.to_datetime(weekly.week_start)
    promo_week = np.clip(ws.dt.month.isin([11, 12]).astype(float) * 0.6 + ((ws.dt.month == 7).astype(float) * 0.3), 0, 1)
    rev = weekly.rev_clean.to_numpy()
    total = 0.058 * rev * (1 + 0.30 * promo_week.to_numpy()) * rng.lognormal(0, 0.05, len(rev))
    rows, plan = [], []
    for ch in C.CHANNELS:
        tilt = {"tv": 0.10, "promotions": 0.08, "email": 0.02}.get(ch, -0.05)
        share = BASE_SHARE[ch] * (1 + tilt * promo_week.to_numpy() * 3)
        clean = total * share / 1.0
        spend = clean * rng.lognormal(0, 0.05, len(rev))
        weeks_since = ((ws - pd.Timestamp(SOCIAL_BREAK)).dt.days / 7).to_numpy()
        roas_mult = np.ones(len(rev))
        if ch == "social":
            spend = spend * np.where(weeks_since >= 0, np.minimum(1.45, 1 + 0.45 * np.clip(weeks_since / 4, 0, 1)), 1.0)
            roas_mult = np.where(weeks_since >= 0, np.maximum(0.28, 1 - 0.72 * np.clip(weeks_since / 8, 0, 1)), 1.0)
        seas = 1 + 0.15 * np.sin((ws.dt.month.to_numpy() - 9) / 12 * 2 * np.pi)
        avg_spend = np.mean(clean)
        dim_returns = (np.maximum(spend, 1) / avg_spend) ** -0.12
        attributed = spend * BASE_ROAS[ch] * seas * roas_mult * dim_returns * rng.lognormal(0, 0.10, len(rev))
        imps = (spend / CPM[ch] * 1000) if CPM[ch] else (spend / CPC[ch] / CTR[ch])
        clicks = imps * CTR[ch]
        aov = 118 * rng.lognormal(0, 0.05, len(rev))
        rows.append(pd.DataFrame({"week_start": weekly.week_start, "channel": ch, "spend": spend.round(2),
                                  "impressions": imps.round(0).astype(np.int64), "clicks": clicks.round(0).astype(np.int64),
                                  "attributed_orders": (attributed / aov).round(0).astype(int),
                                  "attributed_revenue": attributed.round(2)}))
        plan.append(pd.DataFrame({"week_start": weekly.week_start, "channel": ch, "clean_spend": clean}))
    return pd.concat(rows, ignore_index=True), pd.concat(plan, ignore_index=True)


def build_inventory(sales: pd.DataFrame, products: pd.DataFrame, stores: pd.DataFrame, settings, rng: np.random.Generator):
    """Weekly (Sunday) snapshot per open location x SKU with FIFO ageing, stock-outs and over-stock."""
    start = pd.Timestamp(settings.start)
    wk0 = start + pd.Timedelta(days=(7 - start.day_of_week) % 7)  # first Monday inside the window
    n_weeks = int((pd.Timestamp(settings.end) - wk0).days + 1) // 7
    loc_ids = stores.store_id.tolist()
    loc_ix = {s: i for i, s in enumerate(loc_ids)}
    sku_ix = {p: i for i, p in enumerate(products.product_id)}
    L, K = len(loc_ids), len(products)

    wk = ((sales.order_date.to_numpy() - wk0.to_datetime64()) // np.timedelta64(7, "D")).astype(int)
    ok = (wk >= 0) & (wk < n_weeks)
    li = sales.store_id.map(loc_ix).to_numpy()[ok]; ki = sales.product_id.map(sku_ix).to_numpy()[ok]
    dem = np.zeros((L, K, n_weeks), np.float32)
    np.add.at(dem, (li, ki, wk[ok]), sales.quantity.to_numpy()[ok])
    dem = dem.reshape(L * K, n_weeks)
    P = L * K
    pl, pk = np.divmod(np.arange(P), K)

    wk_start = np.array([wk0 + pd.Timedelta(days=7 * w) for w in range(n_weeks)])
    wk_end = wk_start + pd.Timedelta(days=6)
    opn = pd.to_datetime(stores.open_date).to_numpy(); cls = pd.to_datetime(stores.close_date).to_numpy()
    active = np.zeros((P, n_weeks), bool)
    for i in range(L):
        a = (opn[i] <= wk_end.astype("datetime64[ns]")) & (np.isnat(cls[i]) | (cls[i] >= wk_start.astype("datetime64[ns]")))
        active[i * K:(i + 1) * K, :] = a[None, :]
    launch = pd.to_datetime(products.launch_date).to_numpy(); disc = pd.to_datetime(products.discontinue_date).to_numpy()
    for k in range(K):
        sk = (launch[k] <= wk_end.astype("datetime64[ns]")) & (np.isnat(disc[k]) | (disc[k] >= wk_start.astype("datetime64[ns]")))
        active[k::K, :] &= sk[None, :]
    cat = products.category.to_numpy()[pk]
    cover = rng.choice([8.0, 10.0, 12.0, 14.0], size=P)  # weeks of cover -> roughly 4-5 inventory turns
    LEAD = 2
    A = 28
    coh = np.zeros((P, A), np.float32)
    fc = np.zeros(P, np.float32)
    orders = np.zeros((P, n_weeks), np.float32)
    # first-active week & initial forecast
    first_wk = np.where(active.any(1), active.argmax(1), 0)
    init_f = np.array([dem[p, first_wk[p]:first_wk[p] + 6].mean() if active[p].any() else 0 for p in range(P)], np.float32)

    out = {k: np.zeros((P, n_weeks), np.float32) for k in ("onhand", "recv", "short", "b0", "b1", "b2", "b3", "b4")}
    week_start_ts = pd.DatetimeIndex(wk_start)
    outdoor = cat == "Outdoor & Garden"; decor = cat == "Decor"
    dis_w = (week_start_ts >= pd.Timestamp(2023, 2, 13)) & (week_start_ts <= pd.Timestamp(2023, 5, 29))  # A5
    bulk_w = (week_start_ts >= pd.Timestamp(2024, 2, 12)) & (week_start_ts <= pd.Timestamp(2024, 2, 26))  # A6
    started = np.zeros(P, bool)
    for w in range(n_weeks):
        act = active[:, w]
        new = act & ~started
        if new.any():
            fc[new] = init_f[new]; coh[new, 0] = np.ceil(init_f[new] * 6); started |= new
            out["recv"][new, w] = coh[new, 0]
        # age cohorts
        old = coh.copy(); coh[:, 1:A - 1] = old[:, :A - 2]; coh[:, A - 1] = old[:, A - 2] + old[:, A - 1]; coh[:, 0] = 0
        arrive = np.zeros(P, np.float32)
        if w >= LEAD:
            arrive = orders[:, w - LEAD].copy()
            if dis_w[w]:
                arrive = np.where(outdoor, arrive * 0.08, arrive)
        if bulk_w[w]:
            arrive = arrive + np.where(decor, np.ceil(fc * 8), 0)  # A6 spring-collection over-buy
        arrive = np.where(act, arrive, 0)
        coh[:, 0] += arrive
        out["recv"][:, w] += arrive
        D = dem[:, w] * act
        avail = coh.sum(1)
        sold = np.minimum(D, avail)
        rev = coh[:, ::-1]
        cum = np.cumsum(rev, axis=1)
        take = np.clip(sold[:, None] - (cum - rev), 0, rev)
        coh = (rev - take)[:, ::-1].copy()
        out["short"][:, w] = D - sold
        onhand = coh.sum(1)
        out["onhand"][:, w] = onhand * act
        out["b0"][:, w] = coh[:, :5].sum(1); out["b1"][:, w] = coh[:, 5:9].sum(1); out["b2"][:, w] = coh[:, 9:14].sum(1)
        out["b3"][:, w] = coh[:, 14:27].sum(1); out["b4"][:, w] = coh[:, 27:].sum(1)
        fc = np.where(act, 0.7 * fc + 0.3 * D, fc)
        pipe = orders[:, w - 1] if w >= 1 else 0
        target = cover * fc
        o = np.maximum(0, target - onhand - pipe)
        o = np.where(o > 0, np.ceil(o / 4) * 4, 0) * act
        orders[:, w] = o
        if w == n_weeks - 1:
            pass
    # assemble long table for active (loc, sku, week)
    pi, wi = np.nonzero(active)
    cost_base = products.base_unit_cost.to_numpy()[pk[pi]]
    yrs = (wk_end.astype("datetime64[D]")[wi] - np.datetime64(settings.start)).astype(float) / 365.25
    unit_cost = np.round(cost_base * (1 + C.COST_INFLATION_ANNUAL) ** yrs, 2)
    ironv = (products.supplier.to_numpy()[pk[pi]] == "Ironvale Cookware Ltd") & (wk_end.astype("datetime64[D]")[wi] >= np.datetime64("2025-01-01"))
    unit_cost = np.where(ironv, np.round(unit_cost * 1.16, 2), unit_cost)
    inv = pd.DataFrame({
        "snapshot_date": wk_end.astype("datetime64[D]")[wi].astype("datetime64[ns]"),
        "store_id": np.array(loc_ids)[pl[pi]], "product_id": products.product_id.to_numpy()[pk[pi]],
        "units_on_hand": out["onhand"][pi, wi].astype(np.int32),
        "units_on_order": (orders[pi, wi] + np.where(wi >= 1, orders[pi, np.maximum(wi - 1, 0)], 0)).astype(np.int32),
        "units_received": out["recv"][pi, wi].astype(np.int32),
        "units_demanded": dem[pi, wi].astype(np.int32),
        "units_short": out["short"][pi, wi].astype(np.int32),
        "unit_cost": unit_cost,
        "units_age_0_30": out["b0"][pi, wi].astype(np.int32), "units_age_31_60": out["b1"][pi, wi].astype(np.int32),
        "units_age_61_90": out["b2"][pi, wi].astype(np.int32), "units_age_91_180": out["b3"][pi, wi].astype(np.int32),
        "units_age_180_plus": out["b4"][pi, wi].astype(np.int32),
    })
    inv["stockout_flag"] = (inv.units_short > 0).astype(np.int8)
    return inv
