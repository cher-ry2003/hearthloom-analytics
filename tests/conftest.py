import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datagen.config import Settings  # noqa: E402
from datagen.generate import generate  # noqa: E402


@pytest.fixture(scope="session")
def data(tmp_path_factory):
    """Reduced-volume, full-period dataset (30% of normal line volume) for reasonably fast tests."""
    out = tmp_path_factory.mktemp("raw")
    return generate(Settings(scale=0.3, n_customers=10_000), out, verbose=False) | {"out": out}
