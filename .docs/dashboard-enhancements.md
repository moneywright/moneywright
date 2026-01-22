# Dashboard Enhancements

## Data Model Constraint

**Important**: Transaction data can be up to 30 days old since users upload statements after billing cycles complete. The dashboard should focus on **historical analysis and patterns** rather than real-time tracking.

### What works well:
- Historical trends and comparisons
- Completed period analysis
- Pattern recognition
- Long-term averages

### What to avoid:
- "Upcoming payments" with specific dates
- "Budget remaining this month"
- Real-time spending alerts
- "Spent so far today/this week"

---

## Planned Enhancements

### 1. Monthly Spending Trends Chart
**Priority: High**

Bar or line chart showing total spending (debits) over the last 6-12 months.

- X-axis: Months
- Y-axis: Total spending amount
- Optional: Overlay income (credits) as a second series
- Helps visualize spending patterns over time

### 2. Month-over-Month Comparison
**Priority: High**

Compare the most recent *completed* month to the previous month.

Examples:
- "December spending was 15% lower than November"
- "Income increased by ₹15,000 from last month"

Show:
- Spending change (amount and percentage)
- Income change (amount and percentage)
- Net savings change

### 3. Spending Patterns & Averages
**Priority: Medium**

Show average spending by category over the last 3-6 months.

- "Your average monthly dining spend is ₹4,200"
- Helps users understand their baseline spending

### 4. Top Merchants (Historical)
**Priority: Medium**

Show where money is actually going at the merchant level.

- Top 5-10 merchants by total spend
- Time period: Last 3-6 months
- More actionable than category breakdowns

### 5. Detected Subscriptions List
**Priority: Medium**

List recurring payments detected from transaction patterns.

- Merchant name
- Typical amount
- Frequency (monthly, yearly)
- Last seen date

Note: Don't show "next payment date" since timing is unreliable with statement uploads.

### 6. Category Trends
**Priority: Medium**

Show if spending in each category is trending up or down.

- Compare last 3 months to previous 3 months
- "Food & Dining has increased 20% over the last 3 months"
- Could be sparklines or simple up/down indicators

### 7. Savings Rate Trend
**Priority: Low**

Show savings rate (income - expenses / income) over completed months.

- Monthly savings rate chart
- Average savings rate

### 8. Investment Performance
**Priority: Low** (can be more real-time since prices can be fetched)

- Portfolio value over time chart
- Returns by holding
- Allocation breakdown (pie/donut chart)

---

## Implementation Notes

- All time-based features should use completed billing periods only
- Consider showing "Data as of [latest statement date]" disclaimer
- Use the existing timeframe selector pattern where applicable
