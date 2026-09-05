// 入場枠：3D都市データ（課金対象の root request）を要求する前に、CiDAO の /api/metaverse-admission で1日の枠（通常30回）を数える。
// 枠が無い・サーバーに繋がらないときは要求せず、お断り画面を出す（fail closed）。?notiles=1 は素通り。
// 元は Codex セッション（2人対戦）の作。2026-09-06 に文言を日単位に直して採用
(function () {
  "use strict";
  let pending;
  window.ensureMetaverseAdmission = function () {
    if (pending) return pending;
    pending = (async function () {
      if (new URLSearchParams(location.search).get("notiles") === "1") return true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let full = false;
      try {
        const response = await fetch("https://cidao.vercel.app/api/metaverse-admission", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ launchId: crypto.randomUUID() }), signal: controller.signal
        });
        const result = await response.json();
        if (response.ok && result.allowed === true) return true;
        full = response.status === 429;
      } catch (error) { /* Fail closed before requesting paid map data. */ }
      finally { clearTimeout(timer); }
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#101719;color:white;display:grid;place-content:center;text-align:center;padding:24px;font:16px sans-serif";
      const title = document.createElement("h1");
      title.style.fontSize = "24px";
      title.textContent = full ? "🕒 本日の3Dワールド利用枠に達しました" : "入場を確認できませんでした";
      const detail = document.createElement("p");
      detail.textContent = full ? "費用をかけずに運営するため、1日に3Dワールドを開ける回数に上限（通常30回）を設けています。枠は毎日夕方ごろ（日本時間）に回復します。文化財ずかん・学習レポートは3D表示がなくてもご利用いただけます。" : "サーバーに繋がらないため、3D都市データの読み込みを止めました。時間をおいて再度アクセスしてください。";
      const link = document.createElement("a");
      link.href = "../"; link.textContent = "CBIに戻る"; link.style.color = "#7de0bf";
      modal.append(title, detail, link); document.body.appendChild(modal);
      return false;
    })();
    return pending;
  };
})();
