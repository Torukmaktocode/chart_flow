JSON.stringify((() => {
  // Fila de trabajo: descarga anual en HistData sin recargar
  // defino __hdFetch(year) en la pagina de eurusd/URI del par
  window.__hdFetch = async function (year) {
    try {
      // 1) pagina anual para obtener tk fresco
      const page = await fetch(`https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/${window.__hdPair}/` + year, { credentials: "include" });
      const html = await page.text();
      const tk = (html.match(/name="tk"[^>]*value="([^"]+)"/) || [])[1];
      if (!tk) { window.__hdState = "NO-TK-" + year; return; }
      const date = html.match(/name="date"[^>]*value="([^"]+)"/)[1];
      const datemonth = (html.match(/name="datemonth"[^>]*value="([^"]+)"/) || [])[1] || date;
      const timeframe = (html.match(/name="timeframe"[^>]*value="([^"]+)"/) || [])[1] || "M1";
      const fxpair = (html.match(/name="fxpair"[^>]*value="([^"]+)"/) || [])[1];
      // 2) POST de descarga
      const fd = new FormData();
      [
        ["tk", tk], ["date", date], ["datemonth", datemonth], ["platform", "ASCII"],
        ["timeframe", timeframe], ["fxpair", fxpair],
      ].forEach(([k, v]) => fd.append(k, v));
      const r = await fetch("https://www.histdata.com/get.php", { method: "POST", body: fd, credentials: "include" });
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (String.fromCharCode(bytes[0], bytes[1]) !== "PK") {
        window.__hdState = "SIN-ZIP-" + year + " " + String.fromCharCode(...bytes.slice(0, 120)).replace(/\s+/g, " ");
        return;
      }
      window.__hdZip = btoa([...new Uint8Array(bytes)].map(b => String.fromCharCode(b)).join(""));
      window.__hdState = "ZIP-OK-" + year + " " + bytes.length;
    } catch (e) { window.__hdState = "ERR-" + year + " " + e.message; }
  };
  return "definido para " + window.__hdPair;
})())
