// Real output from Ledgerline's live model and data on the sample joinery, used to show the AI on the homepage.
export const TOOLS = {"monthly_trend": {"metric": "revenue", "rows": [{"label": "Oct 25", "month": "2025-10", "value": 222476.05}, {"label": "Nov 25", "month": "2025-11", "value": 216501.44}, {"label": "Dec 25", "month": "2025-12", "value": 177287.01}, {"label": "Jan 26", "month": "2026-01", "value": 186166.28}, {"label": "Feb 26", "month": "2026-02", "value": 199243.57}, {"label": "Mar 26", "month": "2026-03", "value": 222642.67}, {"label": "Apr 26", "month": "2026-04", "value": 232430.19}, {"label": "May 26", "month": "2026-05", "value": 232584.19}, {"label": "Jun 26", "month": "2026-06", "value": 234873.03}, {"label": "Jul 26", "month": "2026-07", "value": 219858.93}, {"label": "Aug 26", "month": "2026-08", "value": 210630.39}, {"label": "Sep 26", "month": "2026-09", "value": 246280.8}]}, "cost_breakdown": {"rows": [{"account": "Wages and salaries", "sharePct": 71.8, "value": 432586.38}, {"account": "Rent and rates", "sharePct": 9.3, "value": 55800}, {"account": "Marketing", "sharePct": 9, "value": 54372.54}, {"account": "Software", "sharePct": 4.3, "value": 25870.62}, {"account": "General", "sharePct": 2.9, "value": 17776.11}, {"account": "Accountancy and legal", "sharePct": 2.7, "value": 16200}], "total": 602605.65}, "company_overview": {"cash": 228779.53, "cashChangePct": -18.1, "company": "Extra", "creditorDays": 24, "currentRatio": 3.64, "debtorDays": 48, "ebitda": 35838.01, "grossMarginPct": 42.3, "month": "2026-09", "monthLabel": "September 2026", "netProfit": 28471, "owedByCustomers": 354821.94, "owedToSuppliers": 159474.43, "revenue": 246280.8, "revenueChangePct": 16.9, "runwayMonths": null}, "forecast": {"cashOutMonth": null, "cashRunsOut": false, "lowestCash": 187469.43, "lowestMonth": "November 2026", "rows": [{"cash": 188391.13, "ebitda": 34824.3, "label": "Oct 26", "month": "2026-10", "revenue": 243547.08}, {"cash": 187469.43, "ebitda": 33452.65, "label": "Nov 26", "month": "2026-11", "revenue": 240843.71}, {"cash": 223941.57, "ebitda": 32092.98, "label": "Dec 26", "month": "2026-12", "revenue": 238170.35}, {"cash": 259018.01, "ebitda": 30745.16, "label": "Jan 27", "month": "2027-01", "revenue": 235526.65}, {"cash": 292710.98, "ebitda": 29409.03, "label": "Feb 27", "month": "2027-02", "revenue": 232912.31}, {"cash": 325032.57, "ebitda": 28084.47, "label": "Mar 27", "month": "2027-03", "revenue": 230326.98}, {"cash": 355994.79, "ebitda": 26771.41, "label": "Apr 27", "month": "2027-04", "revenue": 227770.35}, {"cash": 385609.4, "ebitda": 25469.57, "label": "May 27", "month": "2027-05", "revenue": 225242.1}, {"cash": 392168.29, "ebitda": 24178.96, "label": "Jun 27", "month": "2027-06", "revenue": 222741.91}, {"cash": 419122.59, "ebitda": 22899.3, "label": "Jul 27", "month": "2027-07", "revenue": 220269.48}, {"cash": 444763.92, "ebitda": 21630.61, "label": "Aug 27", "month": "2027-08", "revenue": 217824.49}, {"cash": 469103.5, "ebitda": 20372.62, "label": "Sep 27", "month": "2027-09", "revenue": 215406.64}, {"cash": 492152.43, "ebitda": 19125.27, "label": "Oct 27", "month": "2027-10", "revenue": 213015.62}, {"cash": 503235.14, "ebitda": 17888.42, "label": "Nov 27", "month": "2027-11", "revenue": 210651.15}, {"cash": 523735.65, "ebitda": 16661.97, "label": "Dec 27", "month": "2027-12", "revenue": 208312.92}, {"cash": 542978.11, "ebitda": 15445.78, "label": "Jan 28", "month": "2028-01", "revenue": 206000.65}, {"cash": 560973.13, "ebitda": 14239.73, "label": "Feb 28", "month": "2028-02", "revenue": 203714.04}, {"cash": 577731.14, "ebitda": 13043.63, "label": "Mar 28", "month": "2028-03", "revenue": 201452.81}, {"cash": 593262.49, "ebitda": 11857.44, "label": "Apr 28", "month": "2028-04", "revenue": 199216.69}, {"cash": 607577.34, "ebitda": 10680.96, "label": "May 28", "month": "2028-05", "revenue": 197005.38}, {"cash": 612129.48, "ebitda": 9514.14, "label": "Jun 28", "month": "2028-06", "revenue": 194818.62}, {"cash": 624041.54, "ebitda": 8356.87, "label": "Jul 28", "month": "2028-07", "revenue": 192656.14}, {"cash": 634767.03, "ebitda": 7208.98, "label": "Aug 28", "month": "2028-08", "revenue": 190517.65}, {"cash": 644315.67, "ebitda": 6070.4, "label": "Sep 28", "month": "2028-09", "revenue": 188402.91}], "runwayMonths": 24, "scenario": "Base case"}} as const;

export const CONVERSATIONS = [
 {
  "question": "How is cash looking, and should I worry?",
  "steps": [
   [
    "company_overview",
    "Reading the headline figures"
   ],
   [
    "forecast",
    "Running through the forecast"
   ]
  ],
  "answer": "Cash is **not an immediate solvency worry**, but it deserves attention. September closed at **\u20ac228,780**, down **18.1%**, and the base case shows cash dipping to **\u20ac187,469 in November 2026** before rebuilding. It does not run out within the 24-month forecast.\n\nThe main watchpoint is working capital: customers owe **\u20ac354,822**, with debtor days at **48**. I would focus on collections and avoid committing to large new fixed costs until the November low point has passed.\n\n```ui\nroot = Stack([tiles, chart, note, follow])\noverview = Query(\"company_overview\", {}, {cash: 0, cashChangePct: 0, owedByCustomers: 0, debtorDays: 0})\nforecastData = Query(\"forecast\", {}, {runwayMonths: 0, lowestCash: 0, lowestMonth: \"\", rows: []})\ntiles = Row([Kpi(\"Cash now\", overview.cash, \"money\", \"September 2026\"), Kpi(\"Lowest forecast cash\", forecastData.lowestCash, \"money\", forecastData.lowestMonth), Kpi(\"Forecast runway\", forecastData.runwayMonths, \"months\")])\nchart = LineChart(\"Forecast cash\", forecastData.rows.label, forecastData.rows.cash, \"money\")\nnote = Callout(\"warning\", \"Working capital to watch\", \"Collections are the main cash lever until the November low point.\")\nfollow = FollowUps([\"Who owes us the most?\", \"What happens in a downside scenario?\"])\n```"
 },
 {
  "question": "Show me revenue over the last year and where our costs go",
  "steps": [
   [
    "monthly_trend",
    "Reading the monthly trend"
   ],
   [
    "cost_breakdown",
    "Breaking down the costs"
   ]
  ],
  "answer": "Revenue dipped to **\u20ac177,287 in December** before recovering steadily, reaching a 12-month high of **\u20ac246,281 in September 2026**. The latest month was also above the **\u20ac222,476** recorded in October 2025.\n\nYour financial-year-to-date operating costs total **\u20ac602,606**. **Wages and salaries dominate at \u20ac432,586 (71.8%)**, followed by rent and rates (\u20ac55,800) and marketing (\u20ac54,373).\n\n```ui\nroot = Stack([revenueChart, costChart, note])\nrevenue = Query(\"monthly_trend\", {metric: \"revenue\", months: 12}, {metric: \"revenue\", rows: [{label: \"Oct 25\", month: \"2025-10\", value: 222476.05}, {label: \"Nov 25\", month: \"2025-11\", value: 216501.44}, {label: \"Dec 25\", month: \"2025-12\", value: 177287.01}]})\ncosts = Query(\"cost_breakdown\", {}, {total: 0, rows: [{account: \"Wages and salaries\", value: 432586.38, sharePct: 71.8}, {account: \"Rent and rates\", value: 55800, sharePct: 9.3}, {account: \"Marketing\", value: 54372.54, sharePct: 9}]})\nrevenueChart = LineChart(\"Revenue \u2014 last 12 months\", revenue.rows.label, revenue.rows.value, \"money\", \"Revenue\")\ncostChart = BarChart(\"Operating costs \u2014 financial year to date\", costs.rows.account, costs.rows.value, \"money\")\nnote = Callout(\"info\", \"Main cost driver\", \"Wages and salaries account for 71.8% of operating costs; the figures are financial-year-to-date.\")\n```"
 },
 {
  "question": "When is cash at its lowest, and what drives it?",
  "steps": [
   [
    "forecast",
    "Running through the forecast"
   ],
   [
    "owed_to_you",
    "Checking who owes you"
   ]
  ],
  "answer": "Cash is forecast to be at its lowest in **November 2026: \u20ac187,469**. It is only slightly below October\u2019s \u20ac188,391, then rises from December onwards and reaches \u20ac644,316 by September 2028.\n\nThe immediate trough appears to be a **short-term cash-timing issue**, rather than losses: November EBITDA is still positive at \u20ac33,453. Customer collections are the main risk to that timing, with **\u20ac140,482 already overdue** out of \u20ac354,822 owed. The forecast does not include a cash-flow bridge, so it cannot prove exactly how much of the November dip comes from debtor receipts versus supplier payments or other movements; I\u2019d check the forecast assumptions and payment dates next."
 }
];

export const SEARCH = {"query": "Payments to Liffey Timber over 5k in Q2", "count": 20, "rows": [{"date": "2026-06-15", "journalNumber": 2239, "code": "310", "account": "Timber and materials", "contact": "Liffey Timber Supplies", "description": "Liffey Timber Supplies: materials", "debitCents": 2094668, "creditCents": 0}, {"date": "2026-06-15", "journalNumber": 2239, "code": "800", "account": "Trade creditors", "contact": "Liffey Timber Supplies", "description": "Liffey Timber Supplies: materials", "debitCents": 0, "creditCents": 2576442}, {"date": "2026-06-03", "journalNumber": 2225, "code": "310", "account": "Timber and materials", "contact": "Liffey Timber Supplies", "description": "Liffey Timber Supplies: materials", "debitCents": 2166643, "creditCents": 0}, {"date": "2026-06-03", "journalNumber": 2225, "code": "800", "account": "Trade creditors", "contact": "Liffey Timber Supplies", "description": "Liffey Timber Supplies: materials", "debitCents": 0, "creditCents": 2664971}, {"date": "2026-06-03", "journalNumber": 2224, "code": "800", "account": "Trade creditors", "contact": "Liffey Timber Supplies", "description": "Payment: Liffey Timber Supplies", "debitCents": 4062904, "creditCents": 0}, {"date": "2026-06-03", "journalNumber": 2224, "code": "090", "account": "Bank: business current account", "contact": "Liffey Timber Supplies", "description": "Payment: Liffey Timber Supplies", "debitCents": 0, "creditCents": 4062904}, {"date": "2026-05-11", "journalNumber": 2196, "code": "800", "account": "Trade creditors", "contact": "Liffey Timber Supplies", "description": "Payment: Liffey Timber Supplies", "debitCents": 3235243, "creditCents": 0}, {"date": "2026-05-11", "journalNumber": 2196, "code": "090", "account": "Bank: business current account", "contact": "Liffey Timber Supplies", "description": "Payment: Liffey Timber Supplies", "debitCents": 0, "creditCents": 3235243}]};

// The sample company's last twelve months, from its journals (October 2025 to September 2026).
export const HISTORY = {
  labels: ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"],
  cash: [277439, 254396, 88723, 117833, 130716, 254939, 233626, 150552, 182579, 113988, 279277, 228780],
  revenue: [222476, 216501, 177287, 186166, 199244, 222643, 232430, 232584, 234873, 219859, 210630, 246281],
  netProfit: [27122, 20513, 13549, 11030, 12509, 25565, 21523, 22516, 27164, 18991, 15838, 28471],
};

// September 2026 sales for doors and joinery, line by line.
export const DOORS_SEPTEMBER = [
  { date: "15 Sep 2026", journal: "2351", code: "210", account: "Sales: doors and joinery", description: "Glenmore Developments: doors and joinery", credit: 34619.82 },
  { date: "25 Sep 2026", journal: "2363", code: "210", account: "Sales: doors and joinery", description: "Ó Briain residence: doors and joinery", credit: 49299.07 },
  { date: "28 Sep 2026", journal: "2369", code: "210", account: "Sales: doors and joinery", description: "Ó Briain residence: doors and joinery", credit: 48145.48 },
];
