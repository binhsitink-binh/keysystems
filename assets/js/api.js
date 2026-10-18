(function () {
  "use strict";
  const cfg = window.KOAX_CONFIG || {};
  const base = String(cfg.API_BASE || "").trim().replace(/\/$/, "");
  const PLACEHOLDER = "https://script.google.com/macros/s/AKfycbxQqJIOMfQY566nv24OSYS-ymFxz0r1rCk_gH7FGGPkqs6HcoOuK9r1IpZ9iCPjcuL1/exec";
  let frame = null, bridgeOrigin = "", readyResolve = null, readyReject = null, readyPromise = null, handshakeTimer = null;
  const pending = new Map();
  const timeoutError = message => { const e = new Error(message); e.code = "NETWORK_TIMEOUT"; return e; };
  function configured() { return !!base && base !== PLACEHOLDER && /^https:\/\//i.test(base); }
  function trustedGoogleOrigin(origin) {
    try { const u = new URL(origin); return u.protocol === "https:" && (u.hostname === "script.google.com" || u.hostname.endsWith(".googleusercontent.com")); }
    catch (_) { return false; }
  }
  function makeBridgeUrl() { return base + (base.includes("?") ? "&" : "?") + "action=bridge&v=1"; }
  function ensureBridge() {
    if (readyPromise) return readyPromise;
    if (!configured()) { const e = new Error("Chưa cấu hình API_BASE trong assets/js/config.js."); e.code = "API_NOT_CONFIGURED"; return Promise.reject(e); }
    readyPromise = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    frame = document.createElement("iframe");
    frame.title = "KOAX API bridge";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-10px;bottom:-10px";
    frame.src = makeBridgeUrl();
    frame.addEventListener("load", () => { try { frame.contentWindow.postMessage({ type: "KOAX_BRIDGE_HELLO" }, "*"); } catch (_) {} });
    document.body.appendChild(frame);
    let tries = 0;
    handshakeTimer = setInterval(() => {
      if (bridgeOrigin) { clearInterval(handshakeTimer); handshakeTimer = null; return; }
      tries++;
      try { if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: "KOAX_BRIDGE_HELLO" }, "*"); } catch (_) {}
      if (tries > 30) {
        clearInterval(handshakeTimer); handshakeTimer = null;
        const err = timeoutError("Không khởi tạo được Apps Script iframe bridge. Kiểm tra ALLOWED_ORIGIN, quyền triển khai Web App và URL API.");
        if (readyReject) readyReject(err); readyResolve = null; readyReject = null; readyPromise = null;
      }
    }, 650);
    return readyPromise;
  }
  window.addEventListener("message", event => {
    if (!frame || event.source !== frame.contentWindow || !trustedGoogleOrigin(event.origin)) return;
    const message = event.data || {};
    if (message.type === "KOAX_BRIDGE_READY") {
      bridgeOrigin = event.origin;
      if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
      if (readyResolve) readyResolve(); readyResolve = null; readyReject = null;
      return;
    }
    if (event.origin !== bridgeOrigin || message.type !== "KOAX_API_RESPONSE" || typeof message.id !== "string") return;
    const job = pending.get(message.id); if (!job) return;
    pending.delete(message.id); clearTimeout(job.timer);
    const payload = message.response;
    if (!payload || payload.success !== true) {
      const err = new Error(payload && payload.message ? payload.message : "Apps Script trả về lỗi.");
      err.code = payload && payload.code ? payload.code : "API_ERROR";
      err.data = payload && payload.data;
      job.reject(err);
    } else job.resolve(payload.data || {});
  });
  async function call(action, data = {}, options = {}) {
    await ensureBridge();
    if (!bridgeOrigin || !frame || !frame.contentWindow) throw timeoutError("Apps Script bridge chưa sẵn sàng.");
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const duration = options.timeout || 18000;
      const timer = setTimeout(() => { pending.delete(id); reject(timeoutError("Máy chủ phản hồi quá chậm. Hãy thử lại.")); }, duration);
      pending.set(id, {resolve, reject, timer});
      try { frame.contentWindow.postMessage({type:"KOAX_API_REQUEST",id,request:{action,...data}}, bridgeOrigin); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(new Error("Không gửi được yêu cầu tới API bridge.")); }
    });
  }
  window.KoaxAPI = Object.freeze({ call, isConfigured: configured });
})();
