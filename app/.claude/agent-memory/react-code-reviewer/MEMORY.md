# Memory Index

- [Money domain object](money-domain.md) — all currency is integer cents; `Money` in src/domain/money.ts is the only currency type; format at the UI edge via `.format()`
- [Dashboard charts](dashboard-charts.md) — Recharts charts under src/components/dashboard; SSR mount-gate idiom; YAxis conventions per chart; co-located formatters
