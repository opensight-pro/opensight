import React from "react";

interface OrderbookLevel {
  price: number; // 0-1 (represents $0-$1)
  size: number;  // in Coin
  total: number; // cumulative
}

interface OrderbookProps {
  midPrice: number; // Current market price (0-1)
  className?: string;
  status?: 'OPEN' | 'RESOLVED';
  outcome?: 'UNRESOLVED' | 'YES' | 'NO';
  onPriceUpdate?: (prices: { bestBid: number; bestAsk: number }) => void;
}

// Generate mock orderbook around the current price with time-based jitter
function generateOrderbook(baseMidPrice: number): { bids: OrderbookLevel[]; asks: OrderbookLevel[] } {
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];
  
  // Add time-based jitter to make prices "jump" every update
  // Oscillates between -2¢ and +2¢ based on time
  const now = Date.now();
  const jitter = Math.sin(now / 3000) * 0.02 + (Math.random() - 0.5) * 0.01;
  const midPrice = Math.max(0.05, Math.min(0.95, baseMidPrice + jitter));
  
  // Generate 8 bid levels below mid price
  let bidTotal = 0;
  for (let i = 0; i < 8; i++) {
    const distance = (i + 1) * 0.01 + Math.random() * 0.005;
    const price = Math.max(0.01, midPrice - distance);
    const size = Math.floor(Math.random() * 400) + 100;
    bidTotal += size;
    bids.push({
      price: Math.round(price * 100) / 100,
      size,
      total: bidTotal
    });
  }
  
  // Generate 8 ask levels above mid price
  let askTotal = 0;
  for (let i = 0; i < 8; i++) {
    const distance = (i + 1) * 0.01 + Math.random() * 0.005;
    const price = Math.min(0.99, midPrice + distance);
    const size = Math.floor(Math.random() * 400) + 100;
    askTotal += size;
    asks.push({
      price: Math.round(price * 100) / 100,
      size,
      total: askTotal
    });
  }
  
  return { bids: bids.reverse(), asks };
}

export function Orderbook({ midPrice, className = "", status = 'OPEN', outcome = 'UNRESOLVED', onPriceUpdate }: OrderbookProps) {
  const [orderbook, setOrderbook] = React.useState(() => generateOrderbook(midPrice));
  const [spread, setSpread] = React.useState(0.02);
  
  const isResolved = status === 'RESOLVED';
  const yesWon = outcome === 'YES';
  const noWon = outcome === 'NO';
  
  // Regenerate orderbook frequently to simulate live activity (only for open markets)
  React.useEffect(() => {
    if (isResolved) return; // Stop updates when resolved
    
    // Update every 800ms for a "live" feel
    const interval = setInterval(() => {
      setOrderbook(generateOrderbook(midPrice));
      setSpread(0.01 + Math.random() * 0.02);
    }, 800);
    
    return () => clearInterval(interval);
  }, [midPrice, isResolved]);
  
  const bestBid = orderbook.bids[0]?.price ?? midPrice - 0.01;
  const bestAsk = orderbook.asks[0]?.price ?? midPrice + 0.01;
  const midDisplay = Math.round(((bestBid + bestAsk) / 2) * 100);
  
  // Notify parent of price updates
  React.useEffect(() => {
    if (!isResolved && onPriceUpdate) {
      onPriceUpdate({ bestBid, bestAsk });
    }
  }, [bestBid, bestAsk, isResolved, onPriceUpdate]);
  
  // Find max individual size for bar width calculation
  const maxSize = Math.max(
    ...orderbook.bids.map(b => b.size),
    ...orderbook.asks.map(a => a.size),
    1 // Prevent division by zero
  );
  
  // Resolved market: show final prices ($1 winner, $0 loser)
  if (isResolved) {
    return (
      <div className={`bg-surface rounded-lg border border-border overflow-hidden ${className}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-danger/10">
          <h2 className="text-sm font-semibold text-danger">Order Book</h2>
          <div className="mt-1 text-xs text-danger font-medium">
            ⚠ MARKET RESOLVED
          </div>
        </div>
        
        {/* Final Prices */}
        <div className="p-6 text-center">
          <div className="text-text-tertiary text-xs uppercase mb-4">Final Settlement Prices</div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* YES Price */}
            <div className={`p-4 rounded-lg border-2 ${yesWon ? 'border-success bg-success/10' : 'border-gray-700 bg-gray-900/50'}`}>
              <div className="text-xs text-text-tertiary uppercase mb-1">YES</div>
              <div className={`text-3xl font-bold ${yesWon ? 'text-success' : 'text-gray-600'}`}>
                {yesWon ? '$1.00' : '$0.00'}
              </div>
              {yesWon && <div className="text-xs text-success mt-1">🏆 WINNER</div>}
            </div>
            
            {/* NO Price */}
            <div className={`p-4 rounded-lg border-2 ${noWon ? 'border-danger bg-danger/10' : 'border-gray-700 bg-gray-900/50'}`}>
              <div className="text-xs text-text-tertiary uppercase mb-1">NO</div>
              <div className={`text-3xl font-bold ${noWon ? 'text-danger' : 'text-gray-600'}`}>
                {noWon ? '$1.00' : '$0.00'}
              </div>
              {noWon && <div className="text-xs text-danger mt-1">🏆 WINNER</div>}
            </div>
          </div>
          
          <div className="mt-4 text-xs text-text-secondary">
            Trading has been halted. Positions settled at final prices.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-surface rounded-lg border border-border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-main">Order Book</h2>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-tertiary">Spread: {Math.round(spread * 100)}¢</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-tertiary">Mid:</span>
            <span className="text-text-main font-mono font-medium">{midDisplay}¢</span>
          </div>
        </div>
      </div>
      
      {/* Orderbook - Traditional layout with shared center */}
      <div className="grid grid-cols-2">
        {/* Bids (YES) - Right aligned, bars grow from right */}
        <div className="bg-surface border-r border-border">
          <div className="px-3 py-2 bg-bg-secondary text-xs font-medium text-success flex items-center justify-between">
            <span className="text-text-tertiary">Size</span>
            <span>Bids (YES)</span>
          </div>
          <div className="max-h-[200px] overflow-hidden">
            {orderbook.bids.map((bid, i) => (
              <div 
                key={i} 
                className="relative px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-hover transition-colors"
              >
                {/* Background bar - grows from right */}
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-success/10"
                  style={{ width: `${(bid.size / maxSize) * 100}%` }}
                />
                <span className="relative text-text-secondary font-mono">
                  {bid.size.toLocaleString()}
                </span>
                <span className="relative text-success font-mono font-medium">
                  {Math.round(bid.price * 100)}¢
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Asks (YES) - Left aligned, bars grow from left */}
        <div className="bg-surface">
          <div className="px-3 py-2 bg-bg-secondary text-xs font-medium text-danger flex items-center justify-between">
            <span>Asks (YES)</span>
            <span className="text-text-tertiary">Size</span>
          </div>
          <div className="max-h-[200px] overflow-hidden">
            {orderbook.asks.map((ask, i) => (
              <div 
                key={i} 
                className="relative px-3 py-1.5 text-xs flex items-center justify-between hover:bg-surface-hover transition-colors"
              >
                {/* Background bar - grows from left */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-danger/10"
                  style={{ width: `${(ask.size / maxSize) * 100}%` }}
                />
                <span className="relative text-danger font-mono font-medium">
                  {Math.round(ask.price * 100)}¢
                </span>
                <span className="relative text-text-secondary font-mono">
                  {ask.size.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Depth indicator */}
      <div className="px-4 py-2 border-t border-border bg-bg-secondary">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Depth</span>
          <div className="flex items-center gap-3">
            <span className="text-success">
              YES: {orderbook.bids.reduce((sum, b) => sum + b.size, 0).toLocaleString()}
            </span>
            <span className="text-danger">
              NO: {orderbook.asks.reduce((sum, a) => sum + a.size, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
