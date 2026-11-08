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

## 2026-11-08T21:46:30.623Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 2 buyers vs 1 places | 2 | 1 | 1 | held_count 1, hold rows 1 | 774 ms | 773 ms | 773 ms | {"Not enough tickets left in this category":1} |
| 2 buyers vs 1 seat | 2 | 1 | 1 | active holds on seat 1 | 415 ms | 415 ms | 415 ms | {"One or more of these seats is being held by someone else":1} |

## 2026-11-08T21:59:51.504Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 2 buyers vs 1 places | 2 | 1 | 1 | held_count 1, hold rows 1 | 792 ms | 792 ms | 792 ms | {"Not enough tickets left in this category":1} |
| 2 buyers vs 1 seat | 2 | 1 | 1 | active holds on seat 1 | 409 ms | 409 ms | 409 ms | {"One or more of these seats is being held by someone else":1} |

## 2026-11-08T22:00:11.541Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 2 buyers vs 1 places | 2 | 1 | 1 | held_count 1, hold rows 1 | 899 ms | 899 ms | 899 ms | {"Not enough tickets left in this category":1} |
| 2 buyers vs 1 seat | 2 | 1 | 1 | active holds on seat 1 | 418 ms | 418 ms | 418 ms | {"One or more of these seats is being held by someone else":1} |

## 2026-11-08T22:00:23.316Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 2 buyers vs 1 places | 2 | 1 | 1 | held_count 1, hold rows 1 | 796 ms | 794 ms | 794 ms | {"Not enough tickets left in this category":1} |
| 2 buyers vs 1 seat | 2 | 1 | 1 | active holds on seat 1 | 446 ms | 446 ms | 446 ms | {"One or more of these seats is being held by someone else":1} |

## 2026-11-08T22:01:55.387Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 50 buyers vs 20 places | 50 | 20 | 20 | held_count 20, hold rows 20 | 1770 ms | 970 ms | 1135 ms | {"Error in connector: Error querying the database: FATAL: (EMAXCONNSESSION) max clients reached in ses":2,"Not enough tickets left in this category":28} |
| 10 buyers vs 1 seat | 10 | 1 | 1 | active holds on seat 1 | 528 ms | 399 ms | 527 ms | {"One or more of these seats is being held by someone else":9} |

## 2026-11-08T22:35:46.857Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 50 buyers vs 20 places | 50 | 20 | 20 | held_count 20, hold rows 20 | 3556 ms | 3026 ms | 3515 ms | {"Not enough tickets left in this category":30} |
| 10 buyers vs 1 seat | 10 | 1 | 1 | active holds on seat 1 | 1017 ms | 762 ms | 1017 ms | {"One or more of these seats is being held by someone else":9} |

## 2026-11-08T22:40:48.410Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 50 buyers vs 20 places | 50 | 20 | 20 | held_count 20, hold rows 20 | 3459 ms | 2772 ms | 3458 ms | {"Not enough tickets left in this category":30} |
| 10 buyers vs 1 seat | 10 | 1 | 1 | active holds on seat 1 | 1033 ms | 773 ms | 1032 ms | {"One or more of these seats is being held by someone else":9} |

## 2026-11-08T22:41:07.218Z — PASS

Database: ***.pooler.supabase.com

| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |
|---|---|---|---|---|---|---|---|---|
| 50 buyers vs 20 places | 50 | 20 | 20 | held_count 20, hold rows 20 | 3344 ms | 2710 ms | 3341 ms | {"Not enough tickets left in this category":30} |
| 10 buyers vs 1 seat | 10 | 1 | 1 | active holds on seat 1 | 1117 ms | 757 ms | 1116 ms | {"One or more of these seats is being held by someone else":9} |

