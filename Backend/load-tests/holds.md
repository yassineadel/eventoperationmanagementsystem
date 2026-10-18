# Inventory hold load tests (FR-TKT-11, NFR-04, NFR-05)

## 2026-10-06T21:34:06.903Z — PASS

Database: ***.c-6.eu-central-1.aws.neon.tech

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 200 buyers vs 100 places | 200 | 100 | 100 | held_count 100, hold rows 100 | 5181 ms | 2603 ms | 5178 ms | {"Not enough tickets left in this category":87,"Please make sure your database server is running at `ep-wild-wildflower-b23i0sb8.c-6.eu-central-1.aw":13} |
| 20 buyers vs 1 seat | 20 | 1 | 1 | active holds on seat 1 | 645 ms | 540 ms | 644 ms | {"One or more of these seats is being held by someone else":19} |

## 2026-10-06T21:34:24.678Z — PASS

Database: ***.c-6.eu-central-1.aws.neon.tech

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 200 buyers vs 100 places | 200 | 100 | 100 | held_count 100, hold rows 100 | 3884 ms | 3225 ms | 3743 ms | {"Not enough tickets left in this category":100} |
| 20 buyers vs 1 seat | 20 | 1 | 1 | active holds on seat 1 | 591 ms | 308 ms | 591 ms | {"One or more of these seats is being held by someone else":19} |

