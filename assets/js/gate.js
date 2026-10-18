(function(){
  "use strict";
  const $ = Koax.el;
  let info = null, polling = false, interval = null, busy = false;
  const flowKey = "koax-flow-token", sessionKey = "koax-gate-session-token";

  function denied(message) {
    sessionStorage.removeItem(sessionKey);
    if (String(message).toLowerCase().includes("flow") || String(message).toLowerCase().includes("flow token")) sessionStorage.removeItem(flowKey);
    $("spinner").style.display = "none";
    $("status").textContent = message;
    $("status").style.color = "#ffaaaa";
    $("complete-task").disabled = true;
    $("complete-task").textContent = "Phiên không hợp lệ";
    const box = $("api-warning"); box.textContent = message; box.classList.remove("hidden");
    setTimeout(() => location.replace("access-denied.html?reason=" + encodeURIComponent(message)), 1600);
  }
  function draw(data) {
    info = {...info, ...data};
    const total = Number(info.task_count || 2), step = Number(info.step_number || 1);
    $("provider-name").textContent = info.provider_name || info.provider || "—";
    $("step-number").textContent = String(step);
    const remain = Math.max(0, Number(data.remaining_seconds || 0));
    const mm = String(Math.floor(remain / 60)).padStart(2, "0"), ss = String(remain % 60).padStart(2, "0");
    $("timer").textContent = `${mm}:${ss}`;
    const wait = Number(info.wait_seconds ?? 50);
    $("timer-progress").style.width = `${Math.max(0, Math.min(100, (wait - remain) / Math.max(wait, 1) * 100))}%`;
    $("spinner").style.display = remain > 0 ? "block" : "none";
    if (remain > 0) {
      $("status").textContent = "Đang chờ đủ thời gian theo máy chủ…";
      $("complete-task").disabled = true;
      $("complete-task").textContent = `Còn ${remain}s`;
    } else {
      $("status").textContent = "Đã đủ thời gian chờ. Quay lại sau khi xử lý nhiệm vụ rồi tiếp tục.";
      $("complete-task").disabled = false;
      $("complete-task").textContent = step < total ? "✓ Hoàn thành task & tiếp tục" : "✓ Hoàn thành & nhận key";
    }
  }
  async function check() {
    if (polling || busy) return;
    polling = true;
    try {
      const data = await KoaxAPI.call("checkGateSession", {session_token: sessionStorage.getItem(sessionKey), flow_token: sessionStorage.getItem(flowKey), client_id: Koax.browserId()});
      draw(data);
    } catch (e) {
      if (["SESSION_INVALID", "SESSION_EXPIRED", "FLOW_INVALID", "FLOW_EXPIRED"].includes(e.code)) denied(e.message);
      else { $("status").textContent = e.message; $("status").style.color = "#e8c47d"; }
    } finally { polling = false; }
  }
  $("open-provider").addEventListener("click", () => {
    if (!info || !info.provider_url) { Koax.toast("Không có URL nhiệm vụ cho phiên này.", "error"); return; }
    const win = window.open(info.provider_url, "_blank", "noopener,noreferrer");
    if (!win) Koax.toast("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup rồi thử lại.", "warn");
    else Koax.toast("Đã mở trang nhiệm vụ ở tab mới. Quay lại tab KOAX sau khi hoàn tất.");
  });
  $("complete-task").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    const btn = $("complete-task"); btn.disabled = true; btn.textContent = "Đang xác minh…";
    try {
      const data = await KoaxAPI.call("completeGateSession", {session_token: sessionStorage.getItem(sessionKey), flow_token: sessionStorage.getItem(flowKey), client_id: Koax.browserId()});
      if (data.status === "completed") {
        sessionStorage.setItem("koax-flow-finished", "1");
        $("status").textContent = data.extended_existing ? "Key hiện tại đã được gia hạn." : "Đã tạo key mới.";
        location.href = "key.html";
        return;
      }
      if (data.next_session_token) {
        sessionStorage.setItem(sessionKey, data.next_session_token);
        $("intro").textContent = `Đã ghi nhận task ${data.completed_count}/${data.task_count}. Hãy mở task tiếp theo với cùng nhà cung cấp.`;
        draw({...data, remaining_seconds: Number(data.remaining_seconds ?? data.wait_seconds ?? 50)});
        Koax.toast(`Đã ghi nhận task ${data.completed_count}/${data.task_count}.`);
      }
    } catch (e) {
      Koax.toast(e.message, "error");
      if (e.code === "SESSION_NOT_READY") {
        try { const status = await KoaxAPI.call("checkGateSession", {session_token: sessionStorage.getItem(sessionKey), flow_token: sessionStorage.getItem(flowKey), client_id: Koax.browserId()}); draw(status); } catch (_) {}
      } else if (["SESSION_INVALID", "SESSION_EXPIRED", "FLOW_INVALID", "FLOW_EXPIRED"].includes(e.code)) denied(e.message);
      else { $("status").textContent = e.message; }
    } finally {
      busy = false;
      // Query authoritative server time again after each state transition; the poll interval stays active.
      await check();
    }
  });
  async function init() {
    if (!Koax.requireConfigured()) return;
    const flowToken = sessionStorage.getItem(flowKey), sessionToken = sessionStorage.getItem(sessionKey);
    if (!flowToken || !sessionToken) { denied("Thiếu token phiên. Hãy bắt đầu từ trang Dashboard."); return; }
    try {
      const data = await KoaxAPI.call("checkGateSession", {session_token: sessionToken, flow_token: flowToken, client_id: Koax.browserId()});
      draw(data); interval = setInterval(check, 5000);
    } catch (e) { denied(e.message); }
  }
  window.addEventListener("beforeunload", () => { if (interval) clearInterval(interval); });
  init();
})();
