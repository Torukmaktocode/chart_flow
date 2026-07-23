import { useState, useCallback, useEffect, useMemo } from "react";
import BacktestingSetup from "./BacktestingSetup";
import CandleChart from "./CandleChart";
import ReplayControl from "./ReplayControl";
import TradingPanel from "./TradingPanel";
import OrderModal from "./OrderModal";
import BacktestTimeline from "./BacktestTimeline";
import SessionStats from "./SessionStats";
import BacktestingSessions from "./BacktestingSessions";
import SessionDetail from "./SessionDetail";
import { generateMockCandles } from "../../utils/backtestHelpers";

export default function BacktestingPage({ allCandles: externalCandles }) {
  const [view, setView] = useState("sessions");
  const [session, setSession] = useState(null);
  const [candles, setCandles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5000);
  const [trades, setTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [orderSide, setOrderSide] = useState(null);
  const [savedSessions, setSavedSessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);

  const allCandles = externalCandles?.length > 0 ? externalCandles : useMemo(() => generateMockCandles(480), []);

  const currentCandle = candles[currentIndex];
  const currentPrice = currentCandle?.close ?? 0;

  const closeTrade = useCallback((tradeId) => {
    if (!currentCandle) return;
    setTrades((prev) => {
      const trade = prev.find((t) => t.id === tradeId);
      if (!trade || trade.status === "closed") return prev;

      const direction = trade.side === "buy" ? 1 : -1;
      const pnl = (currentPrice - trade.entryPrice) * direction * trade.positionSize;
      let rMultiple = 0;
      if (trade.stopLoss) {
        const riskPerUnit = Math.abs(trade.entryPrice - trade.stopLoss);
        if (riskPerUnit > 0) rMultiple = pnl / (riskPerUnit * trade.positionSize);
      }

      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, status: "closed", exitPrice: currentPrice, exitTime: currentCandle.time, pnl, rMultiple, result: pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven" }
          : t
      );

      setSession((s) => s ? { ...s, currentBalance: s.currentBalance + pnl } : s);
      return updated;
    });
  }, [currentCandle]);

  useEffect(() => {
    if (!session) return;
    const openTrades = trades.filter((t) => t.status === "open");
    openTrades.forEach((t) => {
      if (t.stopLoss && ((t.side === "buy" && currentPrice <= t.stopLoss) || (t.side === "sell" && currentPrice >= t.stopLoss))) {
        closeTrade(t.id);
      }
      if (t.takeProfit && ((t.side === "buy" && currentPrice >= t.takeProfit) || (t.side === "sell" && currentPrice <= t.takeProfit))) {
        closeTrade(t.id);
      }
    });
  }, [currentIndex, currentPrice, session]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= candles.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, candles.length]);

  const handleStart = (newSession, filteredCandles) => {
    setSession(newSession);
    setCandles(filteredCandles);
    setCurrentIndex(0);
    setIsPlaying(false);
    setSpeed(5000);
    setTrades([]);
    setSelectedTrade(null);
    setView("replay");
  };

  const handleEnd = () => {
    const finalSession = { ...session, trades, currentCandleIndex: currentIndex, isPlaying: false, updatedAt: new Date().toISOString() };
    setSavedSessions((prev) => [...prev, finalSession]);
    setSession(null);
    setCandles([]);
    setTrades([]);
    setView("sessions");
  };

  const handlePlay = () => {
    if (currentIndex >= candles.length - 1) return;
    setIsPlaying(true);
  };
  const handlePause = () => setIsPlaying(false);
  const handleNext = () => setCurrentIndex((prev) => Math.min(prev + 1, candles.length - 1));
  const handlePrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const handleSetIndex = (idx) => setCurrentIndex(Math.max(0, Math.min(idx, candles.length - 1)));
  const handleSpeedChange = (newSpeed) => setSpeed(newSpeed);

  const handleOpenOrder = (side) => setOrderSide(side);
  const handleSaveOrder = (trade) => {
    setTrades((prev) => [...prev, trade]);
  };

  const handleSelectTrade = (trade) => setSelectedTrade(trade);

  const handleDeleteSession = (id) => setSavedSessions((prev) => prev.filter((s) => s.id !== id));

  if (viewingSession) {
    return (
      <div className="bt-page">
        <SessionDetail session={viewingSession} onBack={() => setViewingSession(null)} />
      </div>
    );
  }

  if (view === "sessions") {
    return (
      <div className="bt-page">
        <BacktestingSessions
          sessions={savedSessions}
          onBack={() => {}}
          onNew={() => setView("setup")}
          onViewSession={(s) => setViewingSession(s)}
          onDeleteSession={handleDeleteSession}
        />
      </div>
    );
  }

  if (view === "setup") {
    return (
      <div className="bt-page">
        <BacktestingSetup
          allCandles={allCandles}
          onStart={handleStart}
          onBack={() => setView("sessions")}
        />
      </div>
    );
  }

  if (view === "replay" && session) {
    const replaySession = { ...session, currentCandleIndex: currentIndex, isPlaying, replaySpeed: speed };

    return (
      <div className="bt-page bt-page-replay">
        <ReplayControl
          session={replaySession}
          candles={candles}
          onPlay={handlePlay}
          onPause={handlePause}
          onNext={handleNext}
          onPrev={handlePrev}
          onSpeedChange={handleSpeedChange}
          onSetIndex={handleSetIndex}
          onEnd={handleEnd}
        />

        <div className="bt-main-area">
          <div className="bt-chart-area">
            <CandleChart
              candles={candles}
              trades={trades}
              currentIndex={currentIndex}
            />
          </div>

          <SessionStats trades={trades} session={replaySession} />
        </div>

        <BacktestTimeline
          session={replaySession}
          candles={candles}
          trades={trades}
          onSetIndex={handleSetIndex}
          onSelectTrade={handleSelectTrade}
        />

        <TradingPanel
          session={replaySession}
          candles={candles}
          trades={trades}
          currentIndex={currentIndex}
          onOpenOrder={handleOpenOrder}
        />

        {orderSide && (
          <OrderModal
            side={orderSide}
            entryPrice={currentPrice}
            session={session}
            onClose={() => setOrderSide(null)}
            onSave={handleSaveOrder}
          />
        )}
      </div>
    );
  }

  return null;
}
