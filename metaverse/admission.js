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
      // 登録なしで試せる枠（2026-11-15）：night.js が受付で「登録なしで試す」を押した人に window.cbiTrial を立てる。
      // サーバーは1日10回まで別に数える。入れたら、この端末で今日使った印を残す（1端末1日1回）
      const trial = window.cbiTrial === true;
      let full = false, trialFull = false;
      try {
        const response = await fetch("https://cidao.vercel.app/api/metaverse-admission", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trial ? { launchId: crypto.randomUUID(), guest: true } : { launchId: crypto.randomUUID() }), signal: controller.signal
        });
        const result = await response.json();
        if (response.ok && result.allowed === true) {
          if (trial) { try { localStorage.setItem("cbi-meta-trial-day-v1", new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })); } catch (e) { /* 保存できなくても入れる */ } }
          return true;
        }
        full = response.status === 429;
        trialFull = full && result.guestFull === true;
      } catch (error) { /* Fail closed before requesting paid map data. */ }
      finally { clearTimeout(timer); }
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#101719;color:white;display:grid;place-content:center;text-align:center;padding:24px;font:16px sans-serif";
      const title = document.createElement("h1");
      title.style.fontSize = "24px";
      // 上限に達したときの文（2026-11-15 事業主指示）：「アクセスが集中しているため、時間をあけてから」
      title.textContent = full ? "🕒 ただいまアクセスが集中しています" : "入場を確認できませんでした";
      const detail = document.createElement("p");
      detail.style.cssText = "max-width:32em;line-height:1.8";
      detail.textContent = trialFull ? "時間をあけてから、もう一度アクセスしてください。登録なしで試せる回数には1日の上限があり、毎日夕方ごろ（日本時間）に回復します。CiDAO に登録（無料）すると、登録者の枠で入れます。"
        : full ? "時間をあけてから、もう一度アクセスしてください。費用をかけずに運営するため、1日に3Dワールドを開ける回数に上限を設けています。毎日夕方ごろ（日本時間）に回復します。" : "サーバーに繋がらないため、3D都市データの読み込みを止めました。時間をおいて再度アクセスしてください。";
      modal.append(title, detail);
      if (trialFull) {
        const signup = document.createElement("a");
        signup.href = "https://cidao.vercel.app/login?utm_source=metaverse&utm_medium=reception&utm_campaign=trial_full";
        signup.textContent = "CiDAO に登録する（無料）"; signup.style.cssText = "color:#ffd76a;display:block;margin:6px 0 14px;font-size:18px";
        modal.append(signup);
      }
      const link = document.createElement("a");
      link.href = "../"; link.textContent = "CBIに戻る"; link.style.color = "#7de0bf";
      modal.append(link); document.body.appendChild(modal);
      return false;
    })();
    return pending;
  };
})();
