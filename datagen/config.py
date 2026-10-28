"""Static configuration for the fictional company. Everything is seeded for reproducibility."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

COMPANY = "Hearthloom Home Co."
SEED = 42

START = date(2021, 10, 1)
END = date(2026, 9, 30)  # "last month" relative to the 2026-10-27 as-of date
ASOF = date(2026, 10, 27)  # returns can land after END, up to this cut-off

REGIONS = ["Northeast", "Southeast", "Midwest", "West"]
REGION_BASE = {"Northeast": 1.06, "Southeast": 0.95, "Midwest": 0.90, "West": 1.10}
# share of e-commerce demand shipped to each region
ECOM_REGION_SHARE = {"Northeast": 0.24, "Southeast": 0.25, "Midwest": 0.20, "West": 0.31}

CATEGORIES = [
    "Furniture", "Bedding & Bath", "Kitchen & Dining", "Decor",
    "Lighting", "Storage & Organization", "Outdoor & Garden", "Rugs & Textiles",
]
# SKUs per category (sums to 300)
SKU_COUNT = {"Furniture": 40, "Bedding & Bath": 40, "Kitchen & Dining": 45, "Decor": 50,
             "Lighting": 30, "Storage & Organization": 35, "Outdoor & Garden": 30, "Rugs & Textiles": 30}
# share of line items and typical list price / gross margin
CAT_LINE_SHARE = {"Furniture": 0.06, "Bedding & Bath": 0.15, "Kitchen & Dining": 0.17, "Decor": 0.20,
                  "Lighting": 0.09, "Storage & Organization": 0.13, "Outdoor & Garden": 0.09, "Rugs & Textiles": 0.11}
CAT_PRICE_MEAN = {"Furniture": 380, "Bedding & Bath": 42, "Kitchen & Dining": 28, "Decor": 22,
                  "Lighting": 55, "Storage & Organization": 24, "Outdoor & Garden": 65, "Rugs & Textiles": 70}
CAT_GROSS_MARGIN = {"Furniture": 0.38, "Bedding & Bath": 0.47, "Kitchen & Dining": 0.45, "Decor": 0.55,
                    "Lighting": 0.46, "Storage & Organization": 0.42, "Outdoor & Garden": 0.40, "Rugs & Textiles": 0.48}
CAT_QTY_LAMBDA = {"Furniture": 0.05, "Bedding & Bath": 0.30, "Kitchen & Dining": 0.45, "Decor": 0.50,
                  "Lighting": 0.25, "Storage & Organization": 0.50, "Outdoor & Garden": 0.30, "Rugs & Textiles": 0.15}
# monthly seasonality index by category (Jan..Dec), normalised at runtime
CAT_SEASON = {
    "Furniture": [0.90, 0.90, 1.00, 1.00, 1.05, 1.00, 0.95, 1.00, 1.00, 1.00, 1.15, 1.10],
    "Bedding & Bath": [1.30, 0.95, 0.90, 0.90, 0.90, 0.85, 0.85, 1.00, 1.00, 0.95, 1.20, 1.30],
    "Kitchen & Dining": [0.85, 0.85, 0.90, 0.95, 1.00, 0.95, 0.90, 0.90, 0.95, 1.05, 1.60, 1.60],
    "Decor": [0.75, 0.80, 0.90, 0.95, 1.00, 0.90, 0.85, 0.85, 0.95, 1.15, 1.60, 1.70],
    "Lighting": [1.05, 1.00, 0.95, 0.90, 0.90, 0.85, 0.85, 0.95, 1.05, 1.15, 1.20, 1.15],
    "Storage & Organization": [1.40, 1.05, 0.95, 0.90, 0.85, 0.85, 0.95, 1.20, 1.15, 0.95, 0.90, 0.90],
    "Outdoor & Garden": [0.50, 0.60, 1.20, 1.70, 1.90, 1.70, 1.40, 1.00, 0.70, 0.60, 0.50, 0.40],
    "Rugs & Textiles": [0.90, 0.90, 1.10, 1.15, 1.10, 0.95, 0.85, 0.90, 1.00, 1.05, 1.10, 1.10],
}
# base planned return rate by category; e-commerce multiplier applied on top
CAT_RETURN_RATE = {"Furniture": 0.070, "Bedding & Bath": 0.035, "Kitchen & Dining": 0.030, "Decor": 0.050,
                   "Lighting": 0.045, "Storage & Organization": 0.025, "Outdoor & Garden": 0.055, "Rugs & Textiles": 0.060}
ECOM_RETURN_MULT = 1.9

# list-price index steps (applied to all categories unless noted)
PRICE_STEPS = [(date(2022, 7, 1), 0.050), (date(2023, 7, 1), 0.035), (date(2025, 4, 1), 0.030)]
COST_INFLATION_ANNUAL = 0.025

CHANNELS = ["paid_search", "social", "email", "tv", "promotions"]

# store openings / closures (store_no -> date)
OPEN_AFTER_START = {  # region -> list of open dates for the 5 late openers
    "Midwest": [date(2022, 3, 12)],
    "Northeast": [date(2023, 4, 15)],
    "West": [date(2023, 9, 9), date(2024, 5, 18)],
    "Southeast": [date(2025, 3, 8)],
}
CLOSING_REGION = "Southeast"
CLOSING_DATE = date(2025, 1, 31)

# physical store count per region (40 total)
STORES_PER_REGION = {"Northeast": 10, "Southeast": 9, "Midwest": 10, "West": 11}

CITIES = {
    "Northeast": [("Boston", "MA"), ("Hartford", "CT"), ("Providence", "RI"), ("Albany", "NY"), ("Buffalo", "NY"),
                  ("Philadelphia", "PA"), ("Pittsburgh", "PA"), ("Newark", "NJ"), ("Portland", "ME"), ("Burlington", "VT"),
                  ("Manchester", "NH"), ("Syracuse", "NY")],
    "Southeast": [("Atlanta", "GA"), ("Charlotte", "NC"), ("Raleigh", "NC"), ("Nashville", "TN"), ("Orlando", "FL"),
                  ("Tampa", "FL"), ("Richmond", "VA"), ("Charleston", "SC"), ("Birmingham", "AL"), ("Jacksonville", "FL"),
                  ("Louisville", "KY")],
    "Midwest": [("Chicago", "IL"), ("Columbus", "OH"), ("Indianapolis", "IN"), ("Minneapolis", "MN"), ("Milwaukee", "WI"),
                ("Detroit", "MI"), ("Kansas City", "MO"), ("St. Louis", "MO"), ("Omaha", "NE"), ("Cleveland", "OH"),
                ("Des Moines", "IA"), ("Madison", "WI")],
    "West": [("Seattle", "WA"), ("Portland", "OR"), ("San Francisco", "CA"), ("San Diego", "CA"), ("Los Angeles", "CA"),
             ("Sacramento", "CA"), ("Denver", "CO"), ("Phoenix", "AZ"), ("Salt Lake City", "UT"), ("Las Vegas", "NV"),
             ("Boise", "ID"), ("Austin", "TX"), ("Albuquerque", "NM")],
}

SUPPLIERS = {
    "Furniture": ["Northgrain Furniture Works", "Casa Verde Millworks"],
    "Bedding & Bath": ["Softfold Textiles", "Cobalt Mills"],
    "Kitchen & Dining": ["Ironvale Cookware Ltd", "Tablecraft Imports"],
    "Decor": ["Marigold Studio Goods", "Pennywhistle Decor"],
    "Lighting": ["Lumenco Lighting", "Brightwater Fixtures"],
    "Storage & Organization": ["Tidy Harbor Supply", "Cubix Home"],
    "Outdoor & Garden": ["Fernhill Outdoor", "Sunbaked Patio Co."],
    "Rugs & Textiles": ["Loomhouse Rugs", "Weft & Warp"],
}


@dataclass
class Settings:
    seed: int = SEED
    scale: float = 1.0  # multiplies line-item volume (tests use a small value)
    n_customers: int = 50_000
    start: date = START
    end: date = END
    asof: date = ASOF
