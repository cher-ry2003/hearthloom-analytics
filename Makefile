# One command does everything:  make all
# Individual steps:             make data | warehouse | dbt | export | dashboard | test
PY      ?= .venv/bin/python
DBT     ?= .venv/bin/dbt
NPM     ?= npm

.PHONY: all setup data load dbt docs export dashboard dev test screenshots clean

all: data load dbt export dashboard   ## full pipeline: generate -> warehouse -> dbt -> JSON -> static site

setup:                                ## create venv + install Python and Node deps
	python3.11 -m venv .venv || python3 -m venv .venv
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -r requirements.txt
	cd dashboard && $(NPM) ci

data:                                 ## generate raw CSV / Parquet (seeded, ~10 s)
	$(PY) -m datagen.generate --out data/raw

load:                                 ## load raw files into DuckDB
	$(PY) scripts/load_raw.py

dbt:                                  ## dbt build (models + tests) and docs
	cd dbt && $(DBT) build --profiles-dir .
	cd dbt && $(DBT) docs generate --static --profiles-dir .

export:                               ## marts -> compact JSON for the dashboard
	$(PY) scripts/export_marts.py

dashboard:                            ## build the static site into dashboard/dist
	cd dashboard && $(NPM) run build
	mkdir -p dashboard/dist/dbt-docs && cp dbt/target/static_index.html dashboard/dist/dbt-docs/index.html

dev:                                  ## run the dashboard dev server
	cd dashboard && $(NPM) run dev

test:                                 ## pytest for the generator
	$(PY) -m pytest -q

screenshots:                          ## Playwright screenshots (light + dark) into docs/screenshots
	cd dashboard && $(NPM) run screenshots

clean:
	rm -rf data/raw warehouse/*.duckdb dbt/target dashboard/dist dashboard/public/data
