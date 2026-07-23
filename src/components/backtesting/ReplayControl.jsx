import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { REPLAY_SPEEDS } from "../../utils/backtestHelpers";

export default function ReplayControl({ session, candles, onPlay, onPause, onNext, onPrev, onSpeedChange, onSetIndex, onEnd }) {
  if (!session) return null;

  return (
    <div className="bt-replay-control">
      <button className="bt-btn-icon" onClick={onPrev} title="Backward"><SkipBack size={16} /></button>

      {session.isPlaying ? (
        <button className="bt-btn bt-btn-replay" onClick={onPause}><Pause size={16} /> Pause</button>
      ) : (
        <button className="bt-btn bt-btn-replay" onClick={onPlay}><Play size={16} /> Play</button>
      )}

      <button className="bt-btn-icon" onClick={onNext} title="Forward"><SkipForward size={16} /></button>

      <select value={session.replaySpeed} onChange={(e) => onSpeedChange(Number(e.target.value))} className="bt-speed-select">
        {REPLAY_SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <div className="bt-replay-progress">
        <span className="bt-replay-pct">{Math.round((session.currentCandleIndex / Math.max(candles.length - 1, 1)) * 100)}%</span>
        <span className="bt-replay-count">{session.currentCandleIndex + 1} / {candles.length}</span>
      </div>

      <button className="bt-btn-icon bt-btn-danger" onClick={onEnd} title="End Session"><X size={16} /></button>
    </div>
  );
}
