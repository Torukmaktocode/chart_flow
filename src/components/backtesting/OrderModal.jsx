import { useState } from "react";
import { X, Save, BookOpen } from "lucide-react";

export default function OrderModal({ side, entryPrice, session, onClose, onSave }) {
  const [type, setType] = useState("market");
  const [positionSize, setPositionSize] = useState(1);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = (withJournal) => {
    onSave({
      id: crypto.randomUUID(),
      sessionId: session.id,
      asset: session.asset,
      timeframe: session.timeframe,
      side,
      type,
      status: "open",
      entryPrice,
      stopLoss: stopLossEnabled && stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfitEnabled && takeProfit ? Number(takeProfit) : undefined,
      positionSize,
      entryTime: new Date().toISOString(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: withJournal ? notes : "",
    });
    onClose();
  };

  return (
    <div className="bt-overlay" onClick={onClose}>
      <div className="bt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bt-modal-header">
          <h3 className="bt-modal-title">Place Order — {side === "buy" ? "Buy" : "Sell"}</h3>
          <button className="bt-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="bt-modal-grid">
          <label className="bt-field">
            <span className="bt-field-label">Side</span>
            <select value={side} disabled className="bt-input">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="bt-input">
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Position Size</span>
            <input type="number" value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))} className="bt-input" />
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Entry Price</span>
            <input type="number" value={entryPrice} readOnly className="bt-input" />
          </label>
        </div>
        <div className="bt-modal-toggles">
          <label className="bt-toggle-row">
            <span>Stop Loss</span>
            <input type="checkbox" checked={stopLossEnabled} onChange={(e) => setStopLossEnabled(e.target.checked)} />
          </label>
          {stopLossEnabled && (
            <input type="number" placeholder="Stop Loss Price" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="bt-input" />
          )}
          <label className="bt-toggle-row">
            <span>Take Profit</span>
            <input type="checkbox" checked={takeProfitEnabled} onChange={(e) => setTakeProfitEnabled(e.target.checked)} />
          </label>
          {takeProfitEnabled && (
            <input type="number" placeholder="Take Profit Price" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="bt-input" />
          )}
        </div>
        <div className="bt-modal-fields">
          <label className="bt-field">
            <span className="bt-field-label">Tags (comma separated)</span>
            <input placeholder="ORB, FVG, London, NY..." value={tags} onChange={(e) => setTags(e.target.value)} className="bt-input" />
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Journal Notes</span>
            <textarea placeholder="Reason for entry, mistake, lesson..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bt-textarea" rows={3} />
          </label>
        </div>
        <div className="bt-modal-actions">
          <button className="bt-btn bt-btn-ghost" onClick={onClose}>Discard</button>
          <button className="bt-btn bt-btn-secondary" onClick={() => handleSave(false)}><Save size={16} /> Save</button>
          <button className="bt-btn bt-btn-primary" onClick={() => handleSave(true)}><BookOpen size={16} /> Save &amp; Journal</button>
        </div>
      </div>
    </div>
  );
}
