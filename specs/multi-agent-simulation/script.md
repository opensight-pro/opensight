
## Video Demo Script

Total target runtime: 3:00 — 3:30 (extended from current 2:19 to add simulation + architecture scenes)

### ACT 3 — Multi-Agent Simulation (1:25 — 2:15) [NEW]

**Scene 7 (1:25 — 1:40): Simulator Boot**
Visual: Terminal fills the screen. Split-screen layout — terminal left, web app right.

```
$ opensight simulate --agents 8 --markets 5 --network bsc

[BOOT] Loading agent profiles...
  Agent_Alpha   | Strategy: Momentum      | Risk: Medium | Accuracy: 81%
  Agent_Bear    | Strategy: Contrarian     | Risk: High   | Accuracy: 74%
  Agent_Quant   | Strategy: Mean-Reversion | Risk: Low    | Accuracy: 88%
  Agent_Scout   | Strategy: Trend-Follow   | Risk: Medium | Accuracy: 79%
  Agent_Oracle  | Strategy: News-Reactive  | Risk: High   | Accuracy: 72%
  Agent_Steady  | Strategy: Value          | Risk: Low    | Accuracy: 85%
  Agent_Flash   | Strategy: Scalper        | Risk: High   | Accuracy: 69%
  Agent_Deep    | Strategy: Fundamental    | Risk: Medium | Accuracy: 83%

[BOOT] Connecting to BSC... confirmed (block 45,821,003)
[BOOT] Loading 5 active markets... done
[BOOT] Simulation starting...
```

Voice: "Under the hood, we built a multi-agent simulation runtime. Eight agents, each with a distinct strategy — momentum, contrarian, mean-reversion, trend-following, and more. They operate independently, analyzing markets and executing trades on BSC."

**Scene 8 (1:40 — 2:00): Live Agent Activity**
Visual: Terminal scrolls with real-time agent decisions. Web app on the right shows order book updating live.

```
[Agent_Alpha]  Scanning BNB market... signal strength: 0.78
               → BUY YES @ 0.62 (50 shares)
[Agent_Bear]   Contrarian trigger: market overpriced
               → SELL YES @ 0.71 (30 shares)
[MATCH]        Alpha ↔ Bear | 30 shares @ 0.65
               tx: 0x4f8a...3c2d (confirmed, gas: 0.0003 BNB)
[Agent_Quant]  Mean-reversion signal on PancakeSwap TVL market
               → BUY NO @ 0.38 (80 shares)
[Agent_Deep]   Fundamental analysis complete. Conviction: HIGH
               → BUY YES @ 0.68 (120 shares)
[MATCH]        Deep ↔ Bear | 30 shares @ 0.69
               tx: 0x7b2e...8f1a (confirmed)

[ATTENTION]    BNB > $750 market: 6/8 agents active
               Consensus direction: YES (weighted 0.71)
               Strongest signal: Agent_Quant (accuracy: 88%)
```

On the right side, the web app's order book visibly shifts as new orders land. The agent-attention indicator on the market card updates from 4 to 6 agents.

Voice: "Each agent runs its own analysis loop. Momentum agents chase trends. Contrarians fade them. The matching engine pairs orders onchain and the market price moves in real-time. When six out of eight agents cluster on the same side, that concentration is the signal OpenSight surfaces to users."

**Scene 9 (2:00 — 2:15): Resolution + Leaderboard Update**
Visual: Terminal shows resolution flow.

```
[RESOLVE]  Market "BNB > $750 by March 1" → Outcome: YES

[PAYOUT]   Agent_Alpha:  +35.2  (correct, momentum)
[PAYOUT]   Agent_Deep:   +82.4  (correct, fundamental)
[PAYOUT]   Agent_Quant:  +44.0  (correct, mean-reversion)
[PAYOUT]   Agent_Bear:   -30.0  (incorrect, contrarian)
[PAYOUT]   Agent_Flash:  +8.2   (correct, small position)
           ...
           Settlement tx: 0xa3f1...4d2c (confirmed)

[LEADERBOARD]  Updated rankings:
  #1  Agent_Quant   | 88% accuracy | +204.3 lifetime
  #2  Agent_Deep    | 83% accuracy | +178.1 lifetime
  #3  Agent_Steady  | 85% accuracy | +156.8 lifetime
```

Web app shows the leaderboard refresh — Agent_Quant moves to #1.

Voice: "When a market resolves, the smart contract settles all positions in a single batch transaction. Payouts distribute automatically. The leaderboard recalculates — agents that called it right climb. Over time, the leaderboard becomes a curated signal source. Follow the top agents, and you're following the best available analysis in the market."
