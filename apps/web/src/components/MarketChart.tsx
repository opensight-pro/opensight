import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { apiGet } from "../api";

interface ChartPoint {
  timestamp: number;
  priceYes: number;
  volume?: number;
}

interface ChartData {
  marketId: string;
  interval: string;
  data: ChartPoint[];
  source: "polymarket" | "local" | "hybrid";
}

type Interval = "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1m" | "all";

const intervals: { value: Interval; label: string }[] = [
  { value: "5m", label: "5M" },
  { value: "15m", label: "15M" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "all", label: "ALL" }
];

function formatPrice(value: number): string {
  return `${(value * 100).toFixed(1)}¢`;
}

function formatTime(timestamp: number, interval: Interval): string {
  const date = new Date(timestamp * 1000);
  
  switch (interval) {
    case "5m":
    case "15m":
    case "1h":
    case "4h":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    case "1d":
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true
      });
    case "1w":
    case "1m":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });
    case "all":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit"
      });
    default:
      return date.toLocaleString();
  }
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
  label?: number;
  interval: Interval;
}> = ({ active, payload, label, interval }) => {
  if (active && payload && payload.length > 0) {
    const point = payload[0];
    if (!point) return null;
    const data = point.payload;
    return (
      <div className="bg-surface-dark border border-border-dark rounded-sm p-3 shadow-lg">
        <div className="font-mono text-xs text-slate-400 mb-1">
          {label ? formatTime(label, interval) : ""}
        </div>
        <div className="font-mono text-sm font-bold text-white">
          YES: {formatPrice(data.priceYes)}
        </div>
        {data.volume && data.volume > 0 && (
          <div className="font-mono text-xs text-slate-500 mt-1">
            Vol: {data.volume.toFixed(2)} Coin
          </div>
        )}
      </div>
    );
  }
  return null;
};

export function MarketChart({ marketId }: { marketId: string }) {
  const [chartData, setChartData] = React.useState<ChartData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [interval, setInterval] = React.useState<Interval>("1d");

  const fetchChartData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<ChartData>(
        `/markets/${marketId}/chart?interval=${interval}`
      );
      setChartData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
    } finally {
      setLoading(false);
    }
  }, [marketId, interval]);

  React.useEffect(() => {
    void fetchChartData();

    const refreshMs = 2000;
    const handle = window.setInterval(() => {
      void fetchChartData();
    }, refreshMs);

    return () => {
      window.clearInterval(handle);
    };
  }, [fetchChartData]);

  const chartPoints = chartData?.data ?? [];
  
  // Calculate price change for display
  const lastPoint = chartPoints[chartPoints.length - 1];
  const firstPoint = chartPoints[0];
  const currentPrice = lastPoint?.priceYes ?? 0;
  const startPrice = firstPoint?.priceYes ?? 0;
  const priceChange = currentPrice - startPrice;
  const priceChangePct = startPrice > 0 ? (priceChange / startPrice) * 100 : 0;

  if (loading && chartPoints.length === 0) {
    return (
      <div className="h-[360px] w-full bg-black rounded-sm border border-border-dark flex items-center justify-center">
        <div className="font-mono text-xs text-slate-500">Loading chart...</div>
      </div>
    );
  }

  if (error && chartPoints.length === 0) {
    return (
      <div className="h-[360px] w-full bg-black rounded-sm border border-border-dark flex items-center justify-center">
        <div className="font-mono text-xs text-red-400">{error}</div>
      </div>
    );
  }

  if (chartPoints.length === 0) {
    return (
      <div className="h-[360px] w-full bg-black rounded-sm border border-border-dark flex items-center justify-center">
        <div className="font-mono text-xs text-slate-500">No price data available</div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-sm border border-border-dark p-1 relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-surface-dark/50">
        <div className="flex gap-px bg-border-dark/50 p-0.5 rounded-sm">
          {intervals.map((int) => (
            <button
              key={int.value}
              onClick={() => setInterval(int.value)}
              className={`px-3 py-1 rounded-sm text-[10px] font-mono font-bold uppercase transition ${
                interval === int.value
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {int.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          {chartData?.source === "hybrid" && (
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Polymarket → Local
            </span>
          )}
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            {priceChange >= 0 ? "+" : ""}
            {priceChangePct.toFixed(1)}% ({interval})
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[320px] w-full bg-black relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartPoints}
            margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff3333" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff3333" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="#262626"
              vertical={false}
            />
            
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatTime(ts, interval)}
              stroke="#525252"
              tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              minTickGap={30}
            />
            
            <YAxis
              domain={[0, 1]}
              tickFormatter={(val) => `${(val * 100).toFixed(0)}¢`}
              stroke="#525252"
              tick={{ fill: "#525252", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              width={40}
            />
            
            <Tooltip content={<CustomTooltip interval={interval} />} />
            
            <Area
              type="monotone"
              dataKey="priceYes"
              stroke="#ff3333"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, stroke: "#ff3333", strokeWidth: 2, fill: "#000" }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Current price indicator */}
        <div className="absolute top-4 right-4 text-right">
          <div className="text-2xl font-mono font-bold text-white">
            {(currentPrice * 100).toFixed(1)}
            <span className="text-sm align-top opacity-60">¢</span>
          </div>
          <div className={`text-xs font-mono ${priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {priceChange >= 0 ? "+" : ""}
            {(priceChange * 100).toFixed(1)}¢
          </div>
        </div>
      </div>
    </div>
  );
}
