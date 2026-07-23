import { useState, useEffect, useCallback, useRef } from "react";

export default function useMarketData(initialSymbol = "NAS100") {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [allCandles, setAllCandles] = useState([]);
  const abortRef = useRef(null);

  const load = useCallback(async (nextSymbol) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    try {
      const response = await fetch(`/api/market/${encodeURIComponent(nextSymbol)}?range=3mo&interval=1d`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (!controller.signal.aborted) {
        setData(json);
        setAllCandles(json?.chart || []);
        setStatus("ready");
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setStatus("error");
        setData({ error: error.message });
      }
    }
  }, []);

  useEffect(() => {
    load(symbol);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  const changeSymbol = useCallback((next) => {
    setSymbol(next);
    load(next);
  }, [load]);

  return { symbol, data, status, allCandles, changeSymbol, reload: () => load(symbol) };
}
