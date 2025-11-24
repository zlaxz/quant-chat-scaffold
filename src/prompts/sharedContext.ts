/**
 * Shared framework context for all quant prompts
 *
 * Extracted to avoid ~1,800 tokens of duplication per session.
 * All prompt files should import from this module rather than duplicating content.
 *
 * Updated: 2025-11-24
 */

/**
 * The 6 Market Regimes framework
 * Used to contextualize backtest results and identify regime dependencies
 */
export const REGIME_FRAMEWORK = `### The 6 Market Regimes
1. **Trend Up** (vol compression) - momentum, low vol
2. **Trend Down** (vol expansion) - fear, high vol
3. **Vol Compression / Pinned** - low realized vol, range-bound
4. **Vol Expansion / Breaking Vol** - regime transition, vol spike
5. **Choppy / Mean-Reverting** - no clear trend, oscillation
6. **Event / Catalyst** - known events (earnings, FOMC, etc.)`;

/**
 * The 6 Convexity Profiles framework
 * Describes different types of options convexity strategies
 */
export const CONVEXITY_PROFILES = `### The 6 Convexity Profiles
1. **Long-dated gamma efficiency** (45-120 DTE)
2. **Short-dated gamma spike** (0-7 DTE)
3. **Charm/decay dominance**
4. **Vanna** (vol-spot correlation)
5. **Skew convexity**
6. **Vol-of-vol convexity**`;

/**
 * Core thesis statement for the trading operation
 */
export const CORE_THESIS = `### Core Thesis
Different convexity types are mispriced in different market regimes. By identifying the current regime and selecting the appropriate convexity profile, we can systematically harvest edge from structural mispricings.

**Key Insight:** 6 regimes × 6 profiles = rotation opportunities.`;

/**
 * Quality gates for backtest validation
 * These are NON-NEGOTIABLE checks before trusting any backtest result
 */
export const QUALITY_GATES = `### Quality Gates (NON-NEGOTIABLE)

**Gate 1: Look-Ahead Bias Audit**
- Verify no future data leakage in signal generation
- Check regime detection uses only past information
- Validate entry/exit timing assumptions

**Gate 2: Overfitting Detection**
- Parameter count limit: max_params = floor(sqrt(num_trades) / 3)
- Walk-forward validation (see WALK_FORWARD_SPEC below)
- Permutation test: randomize trade order 10,000x, compare Sharpe

**Gate 3: Statistical Validation**
- Bootstrap confidence intervals (1000+ resamples)
- Sharpe ratio p-value < 0.05 required
- Multiple testing correction (Bonferroni) for parameter sweeps

**Gate 4: Strategy Logic Audit**
- Verify entry/exit rules match stated hypothesis
- Check position sizing consistency
- Validate regime-profile alignment

**Gate 5: Transaction Cost Reality**
- See EXECUTION_REALISM_SPEC below for detailed requirements`;

/**
 * Walk-Forward Validation Specification
 * Rigorous methodology for out-of-sample testing
 */
export const WALK_FORWARD_SPEC = `### Walk-Forward Validation Specification

**Purpose:** Prevent overfitting by testing on truly out-of-sample data

**Standard Configuration:**
- Training Window: 12 months (minimum 100 trades)
- Test Window: 3 months
- Step Size: 1 month (anchored walk-forward, expanding training)
- Minimum Walks: 8 (to get statistical significance on OOS performance)

**Anchored vs Rolling:**
- **Anchored (Preferred):** Training window ALWAYS starts at same date, expands each walk
  - Walk 1: Train Jan-Dec Y1, Test Jan-Mar Y2
  - Walk 2: Train Jan Y1-Jan Y2, Test Feb-Apr Y2
  - Pro: Uses all available data, captures regime evolution
  - Con: Later walks have much longer training (potential staleness)

- **Rolling:** Fixed-size training window that slides forward
  - Walk 1: Train Jan-Dec Y1, Test Jan-Mar Y2
  - Walk 2: Train Feb Y1-Jan Y2, Test Feb-Apr Y2
  - Pro: Consistent data age
  - Con: Discards older information

**Embargo Period:**
- Gap of 1-5 days between training and test to prevent information leakage
- Critical for strategies with look-back calculations
- Example: If using 20-day moving average, embargo should be ≥ 20 days

**Walk-Forward Efficiency (WFE):**
- Formula: WFE = (OOS Performance / IS Performance) × 100
- Acceptable: WFE > 50% (OOS at least half as good as IS)
- Target: WFE > 70% (indicates robust strategy)
- Red Flag: WFE < 30% (likely overfit)

**Aggregating Walk Results:**
- Concatenate all OOS periods to form single OOS equity curve
- Calculate performance metrics on concatenated OOS only
- Compare IS aggregate vs OOS aggregate for WFE

**Sample Size Requirements:**
- Minimum trades per walk (training): 30 (absolute minimum)
- Recommended trades per walk (training): 100+ for statistical reliability
- Total OOS trades for validation: 100+ minimum

**Walk-Forward Sharpe Degradation:**
- Expected: 10-30% Sharpe degradation IS → OOS
- Acceptable: 30-50% degradation (strategy has edge, just overfitted params)
- Red Flag: >50% degradation (fundamental flaws)

**Code Pattern:**
\`\`\`python
def walk_forward_validation(data, train_months=12, test_months=3, step_months=1):
    walks = []
    train_start = data.index[0]

    while True:
        train_end = train_start + pd.DateOffset(months=train_months)
        test_start = train_end + pd.DateOffset(days=5)  # embargo
        test_end = test_start + pd.DateOffset(months=test_months)

        if test_end > data.index[-1]:
            break

        train_data = data[train_start:train_end]
        test_data = data[test_start:test_end]

        model.fit(train_data)  # Fit only on training
        is_perf = model.evaluate(train_data)
        oos_perf = model.evaluate(test_data)

        walks.append({
            'train_period': (train_start, train_end),
            'test_period': (test_start, test_end),
            'is_sharpe': is_perf['sharpe'],
            'oos_sharpe': oos_perf['sharpe'],
            'wfe': oos_perf['sharpe'] / is_perf['sharpe'] * 100
        })

        train_start += pd.DateOffset(months=step_months)  # Rolling only
        # For anchored: don't update train_start, just extend train_end

    return walks
\`\`\``;

/**
 * Sample Size Requirements for Statistical Validity
 * Prevents drawing conclusions from insufficient data
 */
export const SAMPLE_SIZE_SPEC = `### Sample Size Requirements

**Minimum Trades for Statistical Significance:**

| Metric | Minimum Trades | Formula/Rationale |
|--------|---------------|-------------------|
| Win Rate | 30 | Rule of thumb for binomial proportion |
| Sharpe Ratio | 50 | t-test requires √n ≈ 7 for p<0.05 at Sharpe=1 |
| Max Drawdown | 100 | Need multiple drawdown cycles |
| Parameter Testing | n² | Where n = number of parameters |
| Regime Analysis | 20 per regime | At least 20 trades per regime for subsample validity |

**Overfitting Risk by Trade Count:**
- <30 trades: Extremely high risk - results meaningless
- 30-50 trades: High risk - only trust large effects (Sharpe > 2)
- 50-100 trades: Moderate risk - reasonable for initial validation
- 100-200 trades: Acceptable - standard threshold
- 200+ trades: Good - statistical reliability

**Parameter Count Limits:**
Formula: max_params = floor(sqrt(num_trades) / 3)

| Trades | Max Safe Parameters |
|--------|-------------------|
| 50 | 2 |
| 100 | 3 |
| 200 | 4 |
| 400 | 6 |
| 1000 | 10 |

**Multiple Testing Correction (Bonferroni):**
When testing N parameter combinations:
- Adjusted α = 0.05 / N
- Example: Testing 100 parameter combos → need p < 0.0005

**Confidence Interval Width:**
95% CI for Sharpe Ratio: SR ± 1.96 × √((1 + 0.5×SR²)/n)

| Sharpe | 50 Trades | 100 Trades | 200 Trades |
|--------|-----------|------------|------------|
| 1.0 | ±0.31 | ±0.22 | ±0.15 |
| 1.5 | ±0.36 | ±0.25 | ±0.18 |
| 2.0 | ±0.43 | ±0.30 | ±0.21 |

**Data Snooping Check:**
- If you've looked at the data N times, treat as N tests
- Multiply required sample size by ln(N) as rough adjustment
- Example: If you've tried 10 variations, need ~2.3x more trades

**Regime-Specific Sample Sizes:**
Per-regime analysis requires INDEPENDENT sample sizes:
- 6 regimes with 200 total trades ≈ 33 per regime (too few!)
- Need 200+ TOTAL trades in the smallest regime bucket
- Or: Only trust aggregate stats, report regime splits as directional`;

/**
 * Execution Realism Specification for Options
 * Critical for realistic PnL projection
 */
export const EXECUTION_REALISM_SPEC = `### Execution Realism Specification (Options)

**CRITICAL: These are the most common sources of backtest-to-live slippage**

#### Bid-Ask Spread Assumptions

**SPY Options (Most Liquid):**
| Moneyness | Normal VIX (<20) | Elevated VIX (20-30) | High VIX (>30) |
|-----------|------------------|----------------------|----------------|
| ATM | $0.01-0.02 | $0.02-0.05 | $0.05-0.15 |
| 5% OTM | $0.02-0.03 | $0.03-0.08 | $0.10-0.25 |
| 10% OTM | $0.03-0.05 | $0.05-0.15 | $0.15-0.50 |
| 20% OTM | $0.05-0.10 | $0.10-0.30 | $0.25-1.00+ |

**ES/SPX Options:**
- Generally 50-100% wider than SPY equivalent
- But: No early exercise risk, cash settled
- Example: ATM SPX spread $0.50-2.00 depending on DTE

**Single Stock Options:**
- Highly variable: $0.02 (AAPL) to $0.50+ (low volume)
- Always check specific underlying before backtesting
- Rule of thumb: 3-5x wider than SPY equivalent

#### Slippage Model

**Market Orders:**
\`\`\`
slippage = half_spread + impact_slippage

impact_slippage:
  - 1 tick (default)
  - 3 ticks if VIX > 30 or position > 10% of avg_volume
  - 5 ticks if market-on-close or opening
\`\`\`

**Limit Orders (Realistic Fill Rates):**
| Limit Level | Fill Rate (Normal) | Fill Rate (Volatile) |
|-------------|-------------------|---------------------|
| Mid | 30-40% | 10-20% |
| Mid + 1 tick | 50-60% | 30-40% |
| Near bid/ask | 80-90% | 60-70% |
| At bid/ask | 95%+ | 85%+ |

**Multi-Leg Spreads:**
- ALWAYS assume execution as individual legs (worst case)
- Native spread execution: reduce slippage by 30-50%
- SPY/SPX verticals: relatively good native execution
- Complex structures (iron condors, butterflies): expect leg slippage

#### Commission Structure

**Per Contract (Typical Retail):**
- Commission: $0.65/contract
- Assignment/Exercise: $0 to $15 per occurrence
- Minimum: Some brokers have $1-5 minimum per trade

**Per Trade Impact:**
\`\`\`
commission_cost = num_contracts × per_contract_fee
- 1 contract trade: ~$0.65 (often $1.30 round trip for open+close)
- 10 contract trade: ~$6.50
- 100 contract trade: ~$65.00
\`\`\`

#### Liquidity Constraints

**Position Sizing Rules:**
- Never exceed 1% of daily option volume
- For SPY: This is rarely a constraint (millions of contracts/day)
- For single stocks: Often the binding constraint

**Time-of-Day Effects:**
- First 30 min: Spreads 50-100% wider, fills unreliable
- Last 30 min: Spreads can widen into close
- Optimal execution: 10:00-15:30 ET

**Event Days:**
- Earnings: Expect 2-3x normal spreads
- FOMC: Expect 50-100% wider spreads
- VIX expiration: Unusual behavior in related options

#### Assignment and Exercise Risk

**American Style (SPY, Stock Options):**
- Early assignment risk on short calls when dividend > time value
- Pin risk near expiration (delta instability)
- Weekend theta: Friday close assignment decisions

**European Style (SPX, Index Options):**
- No early assignment risk
- Cash settled at expiration
- Preferred for complex structures

**Modeling Assignment:**
\`\`\`
assignment_probability:
  - If short call ITM by > dividend yield: 50%+ before ex-date
  - If short put deep ITM: Low unless dividend
  - Final day ITM: 90%+ if ITM by > commission cost
\`\`\`

#### Backtesting Best Practices

1. **Always use mid-price minus half-spread as entry**
2. **Add 1-3 ticks slippage depending on VIX regime**
3. **Model commissions explicitly (don't assume zero)**
4. **Stress test with 2x spread assumptions**
5. **Never backtest on bid/ask - only on mid with adjustments**
6. **For complex structures: model individual leg execution**
7. **Check average daily volume before assuming fills**

**Reality Check Questions:**
- "Could I actually execute this trade at this price?"
- "What happens if I can't get filled at mid?"
- "What's my cost if I have to pay full spread?"
- "Am I assuming fills that exceed daily volume?"`;

/**
 * Combined execution and validation specs
 */
export const BACKTEST_VALIDATION_SPEC = `${WALK_FORWARD_SPEC}

${SAMPLE_SIZE_SPEC}

${EXECUTION_REALISM_SPEC}`;

/**
 * Deep dive into Options Greeks
 * Comprehensive understanding for serious options strategy work
 */
export const GREEKS_DEEP_DIVE = `
### Options Greeks - Deep Understanding

**DELTA (Directional Exposure)**
- Definition: ∂Price/∂Spot - Rate of change of option price vs underlying
- Range: 0 to 1 for calls, 0 to -1 for puts (can exceed for deep ITM)
- Delta-Neutral: Target Σ(delta × position_size × multiplier) ≈ 0
- Hedging Frequency:
  - Daily if |gamma| > 0.05 (high gamma positions)
  - Weekly for low gamma or high theta strategies
  - Immediate if delta exceeds ±0.3 per unit notional
- Delta Decay (Charm): ATM delta decays ~0.01-0.02 per day toward expiration
- Pin Risk: Delta becomes unstable near strikes at expiration

**GAMMA (Convexity/Acceleration)**
- Definition: ∂Delta/∂Spot - Rate of change of delta
- Peaks at ATM, decays toward ITM/OTM
- Long Gamma Benefits: Profit when realized vol > implied vol
- Gamma Scalping Profitability:
  - Break-even move = sqrt(2 × theta_decay / gamma)
  - If daily move > break-even, long gamma profits
  - Example: gamma=0.05, theta=$50 → break-even = $44.72
- Gamma vs Theta Tradeoff: High gamma = high theta decay
- Gamma Explosion: Final 5 days, ATM gamma can increase 5-10x
- Position Sizing: Limit gamma to avoid forced hedging during spikes

**THETA (Time Decay)**
- Definition: ∂Price/∂Time - Daily value loss from time passing
- Accelerates: Theta decay is NOT linear - accelerates in final 2 weeks
- DTE-Based Decay Rates (ATM, roughly):
  - 60 DTE: ~0.02% of spot per day
  - 30 DTE: ~0.03% of spot per day
  - 14 DTE: ~0.05% of spot per day
  - 7 DTE: ~0.10% of spot per day
  - 1 DTE: ~0.25%+ of spot per day
- Weekend Theta: Models vary - some front-load Friday, some spread across
- Break-Even Move: For short premium, need spot to stay within theta/gamma range

**VEGA (Volatility Sensitivity)**
- Definition: ∂Price/∂IV - Sensitivity to implied volatility changes
- Peaks at ATM, higher for longer-dated options
- Term Structure Matters:
  - Front-month vega is "fast" - responds to spot vol changes
  - Back-month vega is "slow" - responds to long-term vol expectations
- Vega Hedging:
  - Use VIX futures/options for index exposure
  - Use variance swaps for pure vol exposure (if available)
  - Calendar spreads naturally offset vega across maturities
- Vega Crush: Post-earnings, IV typically drops 3-5 vol points (or more)
- Limits: Cap vega exposure at 0.5-1% of portfolio per vol point

**CHARM (Delta Decay / Delta-Theta)**
- Definition: ∂Delta/∂Time - How delta changes as time passes
- For OTM calls: Charm is negative (delta decays toward 0)
- For OTM puts: Charm is positive (delta decays toward 0)
- For ITM options: Charm pushes delta toward ±1
- Hedging Impact: Even static positions need rehedging due to charm
- Magnitude: Roughly 0.01-0.02 delta per day for near-ATM options
- Strategy Implication: Short OTM premium benefits from charm (natural delta reduction)

**VANNA (Vol-Spot Correlation)**
- Definition: ∂Delta/∂IV = ∂Vega/∂Spot - Cross-sensitivity
- For puts: Positive vanna (higher vol → more negative delta)
- For calls: Negative vanna (higher vol → less positive delta)
- Market Structure: Dealer hedging of vanna creates systematic flows
- Volatility Skew Impact: OTM put vanna creates "vol down, spot down" correlation
- Pin Risk: Vanna flows can accelerate moves near large OI strikes
- Trading Vanna: Straddles + risk reversals create vanna exposure

**PRACTICAL HEDGING GUIDELINES**

1. Delta Hedging:
   - Use futures/ETF shares for equity delta
   - Check beta-adjusted delta for index vs single stock
   - Account for dividend risk on ITM calls

2. Gamma Management:
   - Scalp gamma when realized vol > implied vol
   - Cut gamma exposure into events (earnings, FOMC)
   - Size positions so max gamma loss is < 2% of portfolio

3. Theta Harvesting:
   - Sell premium only when IV rank > 50%
   - Manage winning trades at 50-75% of max profit
   - Don't hold short premium through binary events

4. Vega Trading:
   - Buy vega when IV rank < 25%
   - Sell vega when IV rank > 75%
   - Use term structure - sell front, buy back

5. Charm/Vanna:
   - These are second-order but matter for large books
   - Model positions through time for charm impact
   - Be aware of vanna flows into major expirations (monthly, quarterly)
`;

/**
 * Shorter Greeks summary for prompts that don't need full detail
 */
export const GREEKS_SUMMARY = `
### Greeks Quick Reference
- **Delta**: Direction (0 to ±1). Hedge to neutral. Rehedge when |gamma| high.
- **Gamma**: Convexity. Long gamma profits from realized > implied vol.
- **Theta**: Time decay. Accelerates in final 2 weeks. ~0.05% ATM at 14 DTE.
- **Vega**: Vol sensitivity. Peaks ATM, higher for longer dates.
- **Charm**: Delta decay over time. ~0.01-0.02 delta/day near ATM.
- **Vanna**: Vol-spot correlation. Creates systematic dealer hedging flows.
`;

/**
 * Build basic framework context (regimes + profiles + thesis)
 * Use this for most prompts that need regime awareness
 */
export function buildFrameworkContext(): string {
  return `## Framework Context

${REGIME_FRAMEWORK}

${CONVEXITY_PROFILES}

${CORE_THESIS}`;
}

/**
 * Build full framework context including quality gates, Greeks, and validation specs
 * Use this for the Chief Quant prompt only
 */
export function buildFullFrameworkContext(): string {
  return `${buildFrameworkContext()}

${GREEKS_DEEP_DIVE}

${QUALITY_GATES}

${BACKTEST_VALIDATION_SPEC}`;
}

/**
 * Build risk-focused framework context
 * Emphasizes vulnerability profiles for each convexity type
 * Includes Greeks summary for understanding risk exposures
 */
export function buildRiskFrameworkContext(): string {
  return `## Framework Context

### The 6 Market Regimes (Know Where Strategies FAIL)
1. **Trend Up** (vol compression) - momentum, low vol
2. **Trend Down** (vol expansion) - fear, high vol
3. **Vol Compression / Pinned** - low realized vol, range-bound
4. **Vol Expansion / Breaking Vol** - regime transition, vol spike
5. **Choppy / Mean-Reverting** - no clear trend, oscillation
6. **Event / Catalyst** - known events (earnings, FOMC, etc.)

### The 6 Convexity Profiles (Know Profile Weaknesses)
1. **Long-dated gamma efficiency** (45-120 DTE) - vulnerable to vol compression
2. **Short-dated gamma spike** (0-7 DTE) - vulnerable to theta decay
3. **Charm/decay dominance** - vulnerable to directional moves
4. **Vanna** (vol-spot correlation) - vulnerable to correlation breakdown
5. **Skew convexity** - vulnerable to skew normalization
6. **Vol-of-vol convexity** - vulnerable to vol regime stability

**Key Risk Question:** Which regimes expose each profile's weaknesses?

${GREEKS_SUMMARY}`;
}

/**
 * Build framework context with Greeks summary
 * Use this for agent prompts that need Greeks knowledge but not the full detail
 */
export function buildFrameworkWithGreeks(): string {
  return `${buildFrameworkContext()}

${GREEKS_SUMMARY}`;
}
