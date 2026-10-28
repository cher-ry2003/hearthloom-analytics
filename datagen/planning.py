"""Annual budget and quarterly re-forecast, derived from the *planned* (anomaly-free) view of the business."""
from __future__ import annotations

import numpy as np
import pandas as pd

BIAS = 1.015  # management is mildly optimistic


def build_budget_forecast(cells: pd.DataFrame, rng: np.random.Generator):
    c = cells.copy()
    c["month"] = pd.to_datetime(c["month"])
    noise = rng.lognormal(0, 0.03, len(c))
    c["budget_net_sales"] = (c.rev_clean * BIAS * noise).round(2)
    c["budget_cogs"] = (c.cogs_clean * BIAS * noise).round(2)
    c["fiscal_year"] = c.month.dt.year
    budget = c[["fiscal_year", "month", "region", "channel", "category", "budget_net_sales", "budget_cogs"]].copy()

    c["q"] = c.month.dt.to_period("Q")
    keys = ["region", "channel", "category"]
    qsum = c.groupby(keys + ["q"], as_index=False)[["rev_act", "cogs_act", "budget_net_sales", "budget_cogs"]].sum()
    qsum["rev_ratio"] = qsum.rev_act / qsum.budget_net_sales
    qsum["cogs_ratio"] = qsum.cogs_act / qsum.budget_cogs
    qsum["q_next"] = qsum.q + 1
    f = c.merge(qsum[keys + ["q_next", "rev_ratio", "cogs_ratio"]], left_on=keys + ["q"], right_on=keys + ["q_next"], how="left")
    f["rev_ratio"] = f.rev_ratio.fillna(1.0); f["cogs_ratio"] = f.cogs_ratio.fillna(1.0)
    f["forecast_net_sales"] = (f.budget_net_sales * (1 + 0.8 * (f.rev_ratio - 1))).round(2)
    f["forecast_cogs"] = (f.budget_cogs * (1 + 0.8 * (f.cogs_ratio - 1))).round(2)
    f["forecast_quarter"] = f.q.astype(str)
    forecast = f[["forecast_quarter", "month", "region", "channel", "category", "forecast_net_sales", "forecast_cogs"]]
    return budget, forecast


def build_marketing_plan(plan_weekly: pd.DataFrame, actual_weekly: pd.DataFrame, rng: np.random.Generator):
    p = plan_weekly.copy()
    p["month"] = pd.to_datetime(p.week_start).dt.to_period("M").dt.to_timestamp()
    m = p.groupby(["month", "channel"], as_index=False).clean_spend.sum()
    m["budget_spend"] = (m.clean_spend * rng.lognormal(0, 0.03, len(m))).round(2)
    m["fiscal_year"] = m.month.dt.year
    budget = m[["fiscal_year", "month", "channel", "budget_spend"]]
    a = actual_weekly.copy()
    a["month"] = pd.to_datetime(a.week_start).dt.to_period("M").dt.to_timestamp()
    am = a.groupby(["month", "channel"], as_index=False).spend.sum()
    am["q"] = am.month.dt.to_period("Q")
    bm = budget.copy(); bm["q"] = bm.month.dt.to_period("Q")
    qs = am.groupby(["channel", "q"], as_index=False).spend.sum().merge(
        bm.groupby(["channel", "q"], as_index=False).budget_spend.sum(), on=["channel", "q"])
    qs["ratio"] = qs.spend / qs.budget_spend; qs["q_next"] = qs.q + 1
    f = bm.merge(qs[["channel", "q_next", "ratio"]], left_on=["channel", "q"], right_on=["channel", "q_next"], how="left")
    f["ratio"] = f.ratio.fillna(1.0)
    f["forecast_spend"] = (f.budget_spend * (1 + 0.8 * (f.ratio - 1))).round(2)
    f["forecast_quarter"] = f.q.astype(str)
    return budget, f[["forecast_quarter", "month", "channel", "forecast_spend"]]
