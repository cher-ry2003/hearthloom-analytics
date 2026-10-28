"""Line-item sales and returns, driven by a demand model with planted anomalies.

Demand is modelled as Poisson counts of line items per (day, location, category), where the Poisson mean is the
product of: store/e-com base volume, growth, seasonality, day-of-week, holiday/promo effects (with pull-forward
dips) and *anomaly multipliers*. The anomaly multipliers are remembered so that a "clean" counterfactual
(what management planned for) can be reconstructed for the budget.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from . import config as C

RETURN_REASONS = ["Defective", "Not as described", "Changed mind", "Wrong size/color", "Damaged in shipping", "Arrived late"]


def nth_weekday(y: int, m: int, wd: int, n: int) -> date:
    first = date(y, m, 1)
    return first + timedelta(days=(wd - first.weekday()) % 7 + 7 * (n - 1))


def last_weekday(y: int, m: int, wd: int) -> date:
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    d = nxt - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - wd) % 7)


def promo_calendar(years):
    """(start, end, discount depth, intensity weight)."""
    out = []
    for y in years:
        pres = nth_weekday(y, 2, 0, 3)
        mem = last_weekday(y, 5, 0)
        lab = nth_weekday(y, 9, 0, 1)
        tg = nth_weekday(y, 11, 3, 4)
        out += [
            (pres - timedelta(days=3), pres, 0.20, 0.50),
            (date(y, 4, 10), date(y, 4, 20), 0.15, 0.35),
            (mem - timedelta(days=3), mem, 0.20, 0.50),
            (date(y, 7, 1), date(y, 7, 5), 0.20, 0.45),
            (lab - timedelta(days=3), lab, 0.20, 0.50),
            (date(y, 10, 8), date(y, 10, 14), 0.15, 0.30),
            (date(y, 11, 20), tg + timedelta(days=4), 0.30, 1.00),
            (date(y, 12, 26), date(y, 12, 31), 0.25, 0.60),
        ]
    return out


def _daymask(days: pd.DatetimeIndex, a: date, b: date) -> np.ndarray:
    return (days >= pd.Timestamp(a)) & (days <= pd.Timestamp(b))


def month_index(days: pd.DatetimeIndex, start: date) -> np.ndarray:
    return (days.year - start.year) * 12 + days.month - start.month


def price_cost_tables(products: pd.DataFrame, n_months: int, start: date):
    """Return (list_price_clean, list_price_actual, cost_clean, cost_actual) as [product, month] arrays."""
    months = pd.date_range(pd.Timestamp(start.year, start.month, 1), periods=n_months, freq="MS")
    pid = len(products)
    base_p = products.base_list_price.to_numpy()[:, None]
    base_c = products.base_unit_cost.to_numpy()[:, None]
    kitchen = (products.category == "Kitchen & Dining").to_numpy()[:, None]
    ironvale = (products.supplier == "Ironvale Cookware Ltd").to_numpy()[:, None]
    idx_clean = np.ones((pid, n_months))
    idx_act = np.ones((pid, n_months))
    for i, m in enumerate(months):
        for d, step in C.PRICE_STEPS:
            if m.date() >= d:
                idx_clean[:, i] *= 1 + step
                # Kitchen & Dining price freeze on the April 2025 increase (anomaly 3)
                if d == date(2025, 4, 1):
                    idx_act[:, i] *= np.where(kitchen[:, 0], 1.0, 1 + step)
                else:
                    idx_act[:, i] *= 1 + step
    price_clean = np.round(base_p * idx_clean) - 0.01
    price_act = np.round(base_p * idx_act) - 0.01
    yrs = np.array([(m.date() - start).days / 365.25 for m in months])[None, :]
    cost_clean = base_c * (1 + C.COST_INFLATION_ANNUAL) ** yrs
    shock = np.where(ironvale & (months >= pd.Timestamp(2025, 1, 1))[None, :], 1.16, 1.0)  # anomaly 3
    cost_act = cost_clean * shock
    return price_clean, price_act, np.round(cost_clean, 2), np.round(cost_act, 2)


def build_sales(settings, stores: pd.DataFrame, products: pd.DataFrame, customers: pd.DataFrame, rng: np.random.Generator):
    S = settings
    days = pd.date_range(S.start, S.end, freq="D")
    D = len(days)
    t_years = ((days - pd.Timestamp(S.start)).days.to_numpy()) / 365.25
    t_frac = t_years / t_years[-1]
    mi = month_index(days, S.start)
    n_months = int(mi[-1]) + 1
    dow = days.day_of_week.to_numpy()
    cats = C.CATEGORIES
    nC = len(cats)

    # ---------------- locations (physical stores + 4 virtual e-com ship-to regions) ----------------
    locs = []
    for _, s in stores[stores.channel == "In-store"].iterrows():
        locs.append(dict(store_id=s.store_id, region=s.region, ecom=False,
                         base=45 * s.size_factor * C.REGION_BASE[s.region],
                         open=pd.Timestamp(s.open_date), close=pd.Timestamp(s.close_date) if pd.notna(s.close_date) else None))
    for r in C.REGIONS:
        locs.append(dict(store_id="ECOM", region=r, ecom=True, base=C.ECOM_REGION_SHARE[r], open=pd.Timestamp(2015, 3, 1), close=None))
    L = len(locs)
    loc_region = np.array([l["region"] for l in locs])
    loc_ecom = np.array([l["ecom"] for l in locs])
    loc_store = np.array([l["store_id"] for l in locs])

    # ---------------- day-level multipliers ----------------
    years = range(S.start.year - 1, S.end.year + 2)
    P = np.zeros(D)
    depth = np.zeros(D)
    for a, b, dep, w in promo_calendar(years):
        m = _daymask(days, a, b)
        P[m] = np.maximum(P[m], w)
        depth[m] = np.maximum(depth[m], dep)
    lag = np.convolve(P, np.r_[0, np.ones(14) / 14])[:D]
    promo_lift = 1 + 0.5 * P - 0.2 * lag  # pull-forward: part of the promo gain is borrowed from the next 2 weeks

    price_shock = np.ones(D)
    for d, _ in C.PRICE_STEPS:
        price_shock[_daymask(days, d, d + timedelta(days=42))] *= 0.97

    dow_store = np.array([0.85, 0.80, 0.85, 0.90, 1.10, 1.45, 1.20]); dow_store /= dow_store.mean()
    dow_ecom = np.array([1.05, 1.00, 0.95, 0.95, 0.95, 0.95, 1.10]); dow_ecom /= dow_ecom.mean()
    ev_store = np.ones(D); ev_ecom = np.ones(D)
    for y in years:
        tg = pd.Timestamp(nth_weekday(y, 11, 3, 4))
        bf = tg + pd.Timedelta(days=1); cm = tg + pd.Timedelta(days=4)
        for arr, vals in ((ev_store, dict(tg=0.0, xmas=0.0, bf=1.9, cm=1.0, eve=0.7, ny=0.5)),
                          (ev_ecom, dict(tg=0.5, xmas=0.35, bf=1.7, cm=2.0, eve=0.9, ny=0.9))):
            for key, ts in (("tg", tg), ("bf", bf), ("cm", cm), ("xmas", pd.Timestamp(y, 12, 25)),
                            ("eve", pd.Timestamp(y, 12, 24)), ("ny", pd.Timestamp(y, 1, 1))):
                arr[days == ts] = vals[key]

    # ---------------- per-location base (D x L) ----------------
    B = np.zeros((D, L))
    comp = 1.02 ** t_years
    ecom_total = 150 * (650 / 150) ** t_frac
    liq_mult = np.ones((D, L)); liq_flag = np.zeros((D, L), bool)
    for j, l in enumerate(locs):
        if l["ecom"]:
            B[:, j] = ecom_total * l["base"] * dow_ecom[dow] * ev_ecom
        else:
            months_open = np.maximum(0, (days - l["open"]).days.to_numpy()) / 30.4
            ramp = np.where(l["open"] > pd.Timestamp(S.start), np.minimum(1, 0.55 + 0.45 * months_open / 12), 1.0)
            open_m = (days >= l["open"]) & ((days <= l["close"]) if l["close"] is not None else True)
            B[:, j] = l["base"] * comp * ramp * open_m * dow_store[dow] * ev_store
            if l["close"] is not None:  # known closure: liquidation sale in the last four weeks
                lm = (days > l["close"] - pd.Timedelta(days=28)) & (days <= l["close"])
                liq_mult[lm, j] = 2.5; liq_flag[lm, j] = True
    B *= (promo_lift * price_shock)[:, None] * liq_mult
    B *= rng.lognormal(0, 0.07, size=(D, L))

    # ---------------- category weights (D x C) ----------------
    share = np.array([C.CAT_LINE_SHARE[c] for c in cats]); share /= share.sum()
    season = np.array([C.CAT_SEASON[c] for c in cats]); season /= season.mean(axis=1, keepdims=True); season = season.T  # [month, category]
    catw = share[None, :] * season[days.month.to_numpy() - 1]

    # ---------------- planted anomaly multipliers (D x L x C) ----------------
    anom = np.ones((D, L, nC))
    west = loc_region == "West"
    anom[np.ix_(_daymask(days, date(2024, 7, 1), date(2024, 12, 31)), west, range(nC))] *= 0.86  # A1 West misses budget Q3-Q4 2024
    c_out = cats.index("Outdoor & Garden")
    anom[_daymask(days, date(2023, 3, 6), date(2023, 5, 28)), :, c_out] *= 0.70  # A5 port delay stock-outs
    anom[_daymask(days, date(2024, 11, 1), date(2024, 11, 27))] *= 1.18  # A6 early Black Friday
    anom[_daymask(days, date(2024, 12, 1), date(2024, 12, 20))] *= 0.90  # ... December hangover
    c_dec = cats.index("Decor")
    anom[_daymask(days, date(2025, 1, 15), date(2025, 3, 31)), :, c_dec] *= 1.5  # A7 Decor clearance
    anom[np.ix_(_daymask(days, date(2025, 8, 12), date(2025, 8, 20)), loc_ecom, range(nC))] *= 0.60  # A8 e-com outage

    extra_disc_day = np.zeros(D); extra_disc_day[_daymask(days, date(2024, 11, 1), date(2024, 11, 27))] = 0.12
    clear_day = _daymask(days, date(2025, 1, 15), date(2025, 3, 31))

    mass = B[:, :, None] * catw[:, None, :] * anom * S.scale
    counts = rng.poisson(mass)
    flat = np.flatnonzero(counts)
    cell = np.repeat(flat, counts.ravel()[flat])
    del mass, counts
    d_i, l_i, c_i = np.unravel_index(cell, (D, L, nC))
    N = len(cell)

    # order lines within (day, location) randomly so orders mix categories
    key = d_i.astype(np.int64) * L + l_i + rng.random(N) * 0.999
    perm = np.argsort(key, kind="stable")
    d_i, l_i, c_i, cell = d_i[perm], l_i[perm], c_i[perm], cell[perm]
    dl = d_i.astype(np.int64) * L + l_i
    first = np.ones(N, bool); first[1:] = dl[1:] != dl[:-1]
    new_order = first | (rng.random(N) < 0.55)
    order_no = np.cumsum(new_order)
    order_start = np.flatnonzero(new_order)
    line_no = np.arange(N) - order_start[order_no - 1] + 1

    # ---------------- SKU sampling per (month, category) ----------------
    m_i = mi[d_i]
    month_starts = pd.date_range(pd.Timestamp(S.start.year, S.start.month, 1), periods=n_months, freq="MS")
    month_ends = month_starts + pd.offsets.MonthEnd(0)
    launch = pd.to_datetime(products.launch_date).to_numpy()
    disc_d = pd.to_datetime(products.discontinue_date).to_numpy()
    pop = products.popularity.to_numpy()
    pcat = products.category.to_numpy()
    sku = np.zeros(N, np.int32)
    gkey = m_i.astype(np.int64) * nC + c_i
    gorder = np.argsort(gkey, kind="stable")
    gs = gkey[gorder]
    bounds = np.flatnonzero(np.r_[True, gs[1:] != gs[:-1], True])
    for a, b in zip(bounds[:-1], bounds[1:]):
        g = gs[a]; m, c = divmod(int(g), nC)
        ok = (pcat == cats[c]) & (launch <= month_ends[m].to_datetime64()) & (np.isnat(disc_d) | (disc_d > month_starts[m].to_datetime64()))
        ids = np.flatnonzero(ok)
        w = np.cumsum(pop[ids]); w /= w[-1]
        sku[gorder[a:b]] = ids[np.searchsorted(w, rng.random(b - a))]

    qty = 1 + rng.poisson(np.array([C.CAT_QTY_LAMBDA[c] for c in cats])[c_i])
    price_clean, price_act, cost_clean, cost_act = price_cost_tables(products, n_months, S.start)
    list_act = price_act[sku, m_i]; list_clean = price_clean[sku, m_i]
    cost_a = cost_act[sku, m_i]; cost_c = cost_clean[sku, m_i]

    # ---------------- discounts ----------------
    dep = depth[d_i]
    promo_hit = (dep > 0) & (rng.random(N) < 0.85)
    jitter = rng.choice([-0.05, 0.0, 0.0, 0.05], size=N)
    disc_clean = np.where(promo_hit, np.clip(dep + jitter, 0.05, 0.5), np.where(rng.random(N) < 0.06, 0.10, 0.0))
    disc_clean = np.where(liq_flag[d_i, l_i], np.maximum(disc_clean, 0.35), disc_clean)
    extra = extra_disc_day[d_i] + np.where(clear_day[d_i] & (c_i == c_dec), 0.20, 0.0)
    disc = 1 - (1 - disc_clean) * (1 - extra)

    # ---------------- customers ----------------
    n_orders = int(order_no[-1])
    o_loc = l_i[order_start]; o_day = d_i[order_start]
    o_ecom = loc_ecom[o_loc]
    has_cust = o_ecom | (rng.random(n_orders) < 0.55)
    cust_idx = np.full(n_orders, -1, np.int64)
    cust_ids = customers.customer_id.to_numpy()
    cust_signup = pd.to_datetime(customers.signup_date).to_numpy()
    for r in C.REGIONS:
        pool = np.flatnonzero((customers.region == r).to_numpy())  # already sorted by signup_date
        sdates = cust_signup[pool]
        sel = np.flatnonzero(has_cust & (loc_region[o_loc] == r))
        n_elig = np.searchsorted(sdates, days.to_numpy()[o_day[sel]], side="right")
        u = rng.random(len(sel)) ** 1.5
        pick = np.minimum((u * n_elig).astype(int), np.maximum(n_elig - 1, 0))
        cust_idx[sel] = pool[pick]
    cust_line = cust_idx[order_no - 1]

    order_id = np.char.add("O", np.char.zfill(order_no.astype(str), 8))
    net_unit = np.round(list_act * (1 - disc), 2)
    sales = pd.DataFrame({
        "order_id": order_id,
        "line_number": line_no.astype(np.int16),
        "order_date": days.to_numpy()[d_i],
        "store_id": loc_store[l_i],
        "customer_id": np.where(cust_line >= 0, cust_ids[np.maximum(cust_line, 0)], None),
        "product_id": products.product_id.to_numpy()[sku],
        "quantity": qty.astype(np.int16),
        "unit_list_price": list_act,
        "discount_pct": np.round(disc, 4),
        "unit_cost": cost_a,
    })

    # ---------------- returns ----------------
    sku_noise = rng.lognormal(0, 0.2, size=len(products))
    base_rate = np.array([C.CAT_RETURN_RATE[c] for c in cats])[c_i] * sku_noise[sku]
    base_rate = base_rate * np.where(loc_ecom[l_i], C.ECOM_RETURN_MULT, 1.0)
    # A4: bad Lighting batch (supplier Lumenco) sold Mar-Jun 2024
    lum = products[(products.category == "Lighting") & (products.supplier == "Lumenco Lighting")].sort_values("popularity", ascending=False)
    bad_skus = lum.head(8).index.to_numpy()
    in_batch = np.isin(sku, bad_skus) & _daymask(days, date(2024, 3, 1), date(2024, 6, 30))[d_i]
    p_ret = np.where(in_batch, 0.38, base_rate)
    ret = rng.random(N) < p_ret
    ri = np.flatnonzero(ret)
    lagd = np.clip(3 + rng.gamma(2.0, 5.0, size=len(ri)), 3, 45).astype(int)
    rdate = days.to_numpy()[d_i[ri]] + lagd.astype("timedelta64[D]")
    keep = rdate <= np.datetime64(S.asof)
    ri, rdate = ri[keep], rdate[keep]
    ecom_r = loc_ecom[l_i[ri]]
    pr_store = np.array([0.25, 0.20, 0.30, 0.25, 0, 0]); pr_ecom = np.array([0.20, 0.17, 0.20, 0.15, 0.18, 0.10])
    u = rng.random(len(ri))
    cum_s, cum_e = np.cumsum(pr_store), np.cumsum(pr_ecom)
    reason_i = np.where(ecom_r, np.searchsorted(cum_e, u), np.searchsorted(cum_s, u)).clip(0, 5)
    reason_i = np.where(in_batch[ri] & (rng.random(len(ri)) < 0.92), 0, reason_i)
    restock = np.isin(reason_i, [1, 2, 3]) & (rng.random(len(ri)) < 0.85)
    q_ret = 1 + (rng.random(len(ri)) * qty[ri]).astype(int).clip(0, qty[ri] - 1)
    returns = pd.DataFrame({
        "return_id": np.char.add("R", np.char.zfill(np.arange(1, len(ri) + 1).astype(str), 7)),
        "order_id": order_id[ri], "line_number": line_no[ri].astype(np.int16),
        "product_id": products.product_id.to_numpy()[sku[ri]], "store_id": loc_store[l_i[ri]],
        "return_date": rdate, "quantity_returned": q_ret.astype(np.int16),
        "refund_amount": np.round(q_ret * net_unit[ri], 2),
        "return_reason": np.array(RETURN_REASONS)[reason_i], "restockable": restock,
    })

    # ---------------- clean (planned) vs actual aggregates for budget / forecast ----------------
    a_cell = anom.reshape(-1)[cell]
    rev_act = qty * net_unit
    cogs_act = qty * cost_a
    rev_clean = qty * np.round(list_clean * (1 - disc_clean), 2) / a_cell
    cogs_clean = qty * cost_c / a_cell
    agg = pd.DataFrame({"m": m_i, "region": loc_region[l_i], "channel": np.where(loc_ecom[l_i], "E-commerce", "In-store"),
                        "category": np.array(cats)[c_i], "rev_act": rev_act, "cogs_act": cogs_act,
                        "rev_clean": rev_clean, "cogs_clean": cogs_clean})
    cells = agg.groupby(["m", "region", "channel", "category"], as_index=False).sum()
    cells["month"] = [month_starts[i].date() for i in cells.m]
    wk0 = pd.Timestamp(S.start) - pd.Timedelta(days=pd.Timestamp(S.start).day_of_week)
    wk = ((days.to_numpy()[d_i] - wk0.to_datetime64()) // np.timedelta64(7, "D")).astype(int)
    weekly = pd.DataFrame({"wk": wk, "rev_clean": rev_clean, "rev_act": rev_act}).groupby("wk", as_index=False).sum()
    weekly["week_start"] = [(wk0 + pd.Timedelta(days=7 * int(w))).date() for w in weekly.wk]
    meta = dict(bad_batch_skus=[products.product_id[i] for i in bad_skus], lines=int(N), orders=n_orders)
    return sales, returns, cells.drop(columns="m"), weekly.drop(columns="wk"), meta, P
