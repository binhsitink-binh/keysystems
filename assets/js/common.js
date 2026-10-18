(function () {
  "use strict";
  window.Koax = {
    el(id) { return document.getElementById(id); },
    esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); },
    toast(message, type = "success") {
      const host = this.el("toast-host"); if (!host) return;
      const node = document.createElement("div"); node.className = `toast ${type === "error" ? "error" : type === "warn" ? "warn" : ""}`; node.textContent = message;
      host.appendChild(node); setTimeout(() => { node.style.opacity = "0"; setTimeout(() => node.remove(), 240); }, 4200);
    },
    setBusy(button, busy, busyText = "Đang xử lý…") {
      if (!button) return;
      if (busy) { if (!button.dataset.originalText) button.dataset.originalText = button.textContent; button.disabled = true; button.textContent = busyText; }
      else { button.disabled = false; if (button.dataset.originalText) button.textContent = button.dataset.originalText; delete button.dataset.originalText; }
    },
    formatDate(value) { if (!value) return "Không hết hạn"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }); },
    timeLeft(value) { if (!value) return "Vĩnh viễn"; const ms = new Date(value).getTime() - Date.now(); if (!Number.isFinite(ms) || ms <= 0) return "Hết hạn"; const h = Math.floor(ms/3600000), d = Math.floor(h/24), m = Math.floor((ms%3600000)/60000); return d ? `${d} ngày ${h%24} giờ` : h ? `${h} giờ ${m} phút` : `${m} phút`; },
    status(value) { const v = String(value || "").toLowerCase(); if (["active","valid","enabled","ok"].includes(v)) return '<span class="status">Hoạt động</span>'; if (["locked","banned","disabled","expired"].includes(v)) return `<span class="status bad">${v === "expired" ? "Hết hạn" : v === "disabled" ? "Đã tắt" : "Đã khóa"}</span>`; if (["maintenance","pending","created"].includes(v)) return '<span class="status warn">Đang chờ</span>'; return '<span class="status off">Chưa dùng</span>'; },
    uuid() { return crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2,"0")).join(""); },
    browserId() { let id = localStorage.getItem("koax-browser-install-id"); if (!id) { id = "KOAXHWID#" + this.uuid().replace(/-/g, "").toUpperCase(); localStorage.setItem("koax-browser-install-id", id); } return id; },
    async copy(text) { try { await navigator.clipboard.writeText(text); this.toast("Đã sao chép vào clipboard."); } catch (_) { const input=document.createElement("textarea"); input.value=text; input.style.position="fixed"; input.style.opacity="0"; document.body.appendChild(input); input.select(); const ok=document.execCommand("copy"); input.remove(); this.toast(ok?"Đã sao chép vào clipboard.":"Không thể sao chép tự động; hãy chọn và sao chép thủ công.",ok?"success":"warn"); } },
    requireConfigured() { if (!window.KoaxAPI || !window.KoaxAPI.isConfigured()) { const box=this.el("api-warning"); if(box){box.classList.remove("hidden");box.textContent="Chưa kết nối backend: hãy điền API_BASE trong assets/js/config.js và triển khai Apps Script Web App trước khi sử dụng chức năng thật.";} return false; } return true; }
  };
})();
