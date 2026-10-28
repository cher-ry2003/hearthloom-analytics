"""Dimension tables: stores, products, customers."""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from faker import Faker

from . import config as C

SUBCATS = {
    "Furniture": [("Sofa", "Sofa"), ("Accent Chair", "Chair"), ("Coffee Table", "Table"), ("Bookcase", "Shelf")],
    "Bedding & Bath": [("Duvet Set", "Duvet"), ("Sheet Set", "Sheets"), ("Bath Towels", "Towels"), ("Shower Curtain", "Curtain")],
    "Kitchen & Dining": [("Cookware", "Skillet"), ("Dinnerware", "Dinner Set"), ("Glassware", "Tumblers"), ("Utensils", "Utensil Set")],
    "Decor": [("Wall Art", "Print"), ("Vases", "Vase"), ("Candles", "Candle"), ("Mirrors", "Mirror"), ("Frames", "Frame")],
    "Lighting": [("Table Lamp", "Lamp"), ("Floor Lamp", "Floor Lamp"), ("Pendant", "Pendant"), ("String Lights", "Lights")],
    "Storage & Organization": [("Baskets", "Basket"), ("Shelving", "Shelf Unit"), ("Closet", "Organizer"), ("Bins", "Bin Set")],
    "Outdoor & Garden": [("Planters", "Planter"), ("Patio Seating", "Lounger"), ("Grills & Fire", "Fire Bowl"), ("Garden Tools", "Tool Kit")],
    "Rugs & Textiles": [("Area Rug", "Rug"), ("Throw Blanket", "Throw"), ("Pillows", "Pillow"), ("Curtains", "Curtain Panel")],
}
ADJ = ["Linen", "Oak", "Brass", "Willow", "Slate", "Terra", "Birch", "Ivory", "Cedar", "Indigo", "Fern", "Amber",
       "Stone", "Walnut", "Sage", "Copper", "Cloud", "Harbor", "Meadow", "Ember", "Juniper", "Olive", "Pebble", "Dune"]


def build_stores(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    n = 0
    late = {r: list(d) for r, d in C.OPEN_AFTER_START.items()}
    for region in C.REGIONS:
        cities = list(C.CITIES[region])
        rng.shuffle(cities)
        for i in range(C.STORES_PER_REGION[region]):
            n += 1
            city, st = cities[i % len(cities)]
            suffix = "" if i < len(cities) else " East"
            open_date = C.START - timedelta(days=int(rng.integers(400, 4000)))
            if late.get(region):
                if i >= C.STORES_PER_REGION[region] - len(late[region]):
                    open_date = late[region].pop(0)
            fmt = rng.choice(["Flagship", "Standard", "Standard", "Outlet"])
            size = float(np.clip(rng.lognormal(0, 0.22), 0.6, 1.7))
            rows.append(dict(store_id=f"S{n:03d}", store_name=f"Hearthloom {city}{suffix}", city=city, state=st,
                             region=region, format=fmt, sq_ft=int(22000 * size), size_factor=round(size, 3),
                             open_date=open_date, close_date=None, channel="In-store"))
    df = pd.DataFrame(rows)
    # closing store: an original (not late-opened) Southeast store
    cand = df[(df.region == C.CLOSING_REGION) & (df.open_date < C.START)].index
    df.loc[cand[-1], "close_date"] = C.CLOSING_DATE
    ecom = dict(store_id="ECOM", store_name="Hearthloom.com", city="Columbus", state="OH", region="E-commerce",
                format="Online", sq_ft=0, size_factor=1.0, open_date=date(2015, 3, 1), close_date=None, channel="E-commerce")
    return pd.concat([df, pd.DataFrame([ecom])], ignore_index=True)


def build_products(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    n = 0
    used = set()
    for cat in C.CATEGORIES:
        subs = SUBCATS[cat]
        for i in range(C.SKU_COUNT[cat]):
            n += 1
            sub, noun = subs[i % len(subs)]
            while True:
                nm = f"{rng.choice(ADJ)} {noun}"
                if (cat, nm) not in used:
                    used.add((cat, nm)); break
                nm = f"{rng.choice(ADJ)} {rng.choice(ADJ)} {noun}"
                if (cat, nm) not in used:
                    used.add((cat, nm)); break
            mean = C.CAT_PRICE_MEAN[cat]
            price = float(np.clip(rng.lognormal(np.log(mean), 0.45), mean * 0.3, mean * 3.5))
            price = max(4.99, round(price) - 0.01)
            gm = float(np.clip(C.CAT_GROSS_MARGIN[cat] + rng.normal(0, 0.04), 0.2, 0.7))
            cost = round(price * (1 - gm), 2)
            supplier = C.SUPPLIERS[cat][0] if rng.random() < 0.6 else C.SUPPLIERS[cat][1]
            launch = C.START - timedelta(days=int(rng.integers(100, 1500)))
            disc = None
            r = rng.random()
            if r < 0.07:  # launched during window
                launch = C.START + timedelta(days=int(rng.integers(60, 1500)))
            elif r < 0.12:  # discontinued during window
                disc = C.START + timedelta(days=int(rng.integers(500, 1700)))
            rows.append(dict(product_id=f"SKU{n:04d}", product_name=nm, category=cat, subcategory=sub,
                             supplier=supplier, launch_date=launch, discontinue_date=disc,
                             base_list_price=price, base_unit_cost=cost,
                             popularity=round(float(rng.lognormal(0, 0.8)), 4)))
    return pd.DataFrame(rows)


def build_customers(rng: np.random.Generator, n: int) -> pd.DataFrame:
    fake = Faker("en_US")
    Faker.seed(int(rng.integers(0, 2**31)))
    regions = rng.choice(C.REGIONS, size=n, p=[0.27, 0.24, 0.20, 0.29])
    state_of = {r: [s for _, s in C.CITIES[r]] for r in C.REGIONS}
    states = [state_of[r][int(rng.integers(0, len(state_of[r])))] for r in regions]
    span = (C.END - C.START).days
    # 35% pre-existing customers, the rest signing up with a growing e-comm lean
    offs = np.where(rng.random(n) < 0.35, -rng.integers(1, 1500, n), (rng.beta(1.2, 1.0, n) * span).astype(int))
    signup = [C.START + timedelta(days=int(o)) for o in offs]
    first = [fake.first_name() for _ in range(n)]
    last = [fake.last_name() for _ in range(n)]
    email = [f"{f.lower()}.{l.lower()}{i % 97}@example.com" for i, (f, l) in enumerate(zip(first, last))]
    tier = rng.choice(["Bronze", "Silver", "Gold", "Platinum"], size=n, p=[0.55, 0.28, 0.13, 0.04])
    acq = rng.choice(["organic", "paid_search", "social", "email", "tv", "referral"], size=n, p=[0.3, 0.2, 0.15, 0.1, 0.1, 0.15])
    df = pd.DataFrame(dict(customer_id=[f"C{i + 1:06d}" for i in range(n)], first_name=first, last_name=last,
                           email=email, state=states, region=regions, signup_date=signup,
                           loyalty_tier=tier, acquisition_channel=acq))
    return df.sort_values("signup_date", kind="stable").reset_index(drop=True)
