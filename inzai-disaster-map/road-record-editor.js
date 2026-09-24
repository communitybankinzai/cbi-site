/* 道路記録の写真・出典リンク。運営の認証を使い、保存時にだけサーバーへ送る。 */
(function () {
  "use strict";
  function httpUrl(value) {
    try {
      const raw = String(value || "").trim();
      if (!/^https?:\/\//i.test(raw) || /[\u0000-\u0020]/.test(raw)) return "";
      const url = new URL(raw);
      return !url.username && !url.password && raw.length <= 2048 ? url.href : "";
    } catch { return ""; }
  }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }
  function render(road) {
    const images = (Array.isArray(road.imageUrls) ? road.imageUrls : []).map(httpUrl).filter(Boolean).slice(0, 3);
    const links = (Array.isArray(road.sourceUrls) ? road.sourceUrls : []).map(httpUrl).filter(Boolean).slice(0, 3);
    if (!images.length && !links.length) return "";
    return '<div class="road-evidence">' +
      images.map((url, i) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><img src="${escape(url)}" alt="記録の添付画像 ${i + 1}" loading="lazy" referrerpolicy="no-referrer"></a>`).join("") +
      links.map((url, i) => `<a class="road-evidence-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">出典リンク ${i + 1}：${escape(new URL(url).hostname)} ↗</a>`).join("") + '</div>';
  }
  async function compress(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw Error("画像はJPEG・PNG・WebP・GIFを選んでください。");
    if (file.size > 8 * 1024 * 1024) throw Error("元画像は8MB以下にしてください。");
    const image = await createImageBitmap(file).catch(() => { throw Error("画像を読み込めません。JPEGまたはPNGに変換してお試しください。"); });
    try {
      const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.82, .65, .45]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= 1024 * 1024) return blob;
      }
      throw Error("圧縮後も1MBを超えています。画像を小さくしてお試しください。");
    } finally { image.close(); }
  }
  let dialog, form, state;
  const byId = id => dialog.querySelector('#' + id);
  const status = text => { byId("road-edit-status").textContent = text; };
  function busy(value) {
    state.busy = value;
    form.querySelectorAll("input, textarea, button").forEach(node => { node.disabled = value; });
    byId("road-edit-save").textContent = value ? "保存中…" : "保存する";
  }
  function cleanup() {
    state?.images.forEach(image => { if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview); });
  }
  function renderImages() {
    const box = byId("road-edit-images"); box.replaceChildren();
    state.images.forEach((image, i) => {
      const item = document.createElement("div"); item.className = "road-edit-image";
      const img = document.createElement("img"); img.src = image.preview || image.url; img.alt = `添付画像 ${i + 1}`; img.referrerPolicy = "no-referrer";
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = `画像${i + 1}を外す`;
      remove.addEventListener("click", () => {
        if (state.busy) return;
        if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
        state.images.splice(i, 1); renderImages();
      });
      item.append(img, remove); box.append(item);
    });
  }
  async function addFiles(files) {
    if (state.busy) return;
    const captured = state;
    busy(true);
    try {
      if (state.images.length + files.length > 3) throw Error("画像は3枚までです。不要な画像を外してから追加してください。");
      for (const file of files) {
        const blob = await compress(file);
        if (captured !== state) return;
        state.images.push({ blob, preview: URL.createObjectURL(blob) });
      }
      status("画像を追加しました。「保存する」で公開されます。");
    } catch (error) { status(error.message); }
    finally { if (captured === state) { renderImages(); busy(false); byId("road-edit-files").value = ""; } }
  }
  async function authenticatedFetch(url, options) {
    const send = () => fetch(url, { ...options, headers: { ...options.headers, "x-moderation-key": state.key } });
    let response = await send();
    if (response.status === 403) { state.key = state.getKey(); if (!state.key) throw Error("合言葉を確認してください。"); response = await send(); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = { forbidden: "合言葉を確認してください。", invalid_time: "記録時刻を確認してください。", future_time: "未来の時刻は保存できません。", invalid_image: "画像を読み込めません。", image_too_large: "画像のサイズが大きすぎます。" };
      throw Error(messages[result.error] || result.error || `通信エラー（${response.status}）`);
    }
    return result;
  }
  async function save(event) {
    event.preventDefault();
    if (state.busy || !form.reportValidity()) return;
    busy(true); status("保存しています…");
    try {
      const rawLinks = byId("road-edit-links").value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
      if (rawLinks.length > 3 || rawLinks.some(v => !httpUrl(v))) throw Error("リンクはhttp://またはhttps://で始まるURLを、1行に1つ・3件まで入力してください。");
      const payload = { note: byId("road-edit-note").value, sourceUrls: [...new Set(rawLinks.map(httpUrl))] };
      const time = byId("road-edit-time").value;
      if (time !== state.originalTime) {
        const at = new Date(time);
        if (!time || !Number.isFinite(at.getTime())) throw Error("記録時刻を入力してください。");
        payload.endedAt = at.toISOString();
      }
      for (const image of state.images) {
        if (image.url) continue;
        const body = new FormData(); body.append("roadId", state.road.id); body.append("image", image.blob, "road.jpg");
        const uploaded = await authenticatedFetch(state.endpoint.replace(/\/$/, "") + "/image", { method: "POST", body });
        image.url = httpUrl(uploaded.url);
        if (!image.url) throw Error("画像の保存先を確認できませんでした。");
      }
      payload.imageUrls = state.images.map(image => image.url);
      await authenticatedFetch(`${state.endpoint}?id=${encodeURIComponent(state.road.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      busy(false); dialog.close(); cleanup();
      await state.onSaved();
    } catch (error) { status(`保存できませんでした。${error.message} 入力内容は残っています。`); busy(false); }
  }
  function init() {
    if (dialog) return;
    dialog = document.createElement("dialog"); dialog.className = "road-edit-dialog"; dialog.setAttribute("aria-labelledby", "road-edit-title");
    dialog.innerHTML = `<form id="road-edit-form"><h2 id="road-edit-title">時刻・メモ・画像・リンクを直す</h2>
      <label>記録した時刻<input id="road-edit-time" type="datetime-local" required></label>
      <label>メモ<textarea id="road-edit-note" maxlength="200" rows="3"></textarea></label>
      <fieldset><legend>画像（3枚まで）</legend><div id="road-edit-images"></div>
        <label class="road-file-label">端末から画像を選ぶ<input id="road-edit-files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label>
        <p>コピーした画像は、この画面で貼り付け（Ctrl+V）できます。</p>
        <div class="road-image-url-row"><input id="road-edit-image-url" type="url" aria-label="画像のURL" placeholder="画像のURL（https://…）"><button type="button" id="road-edit-add-url">画像URLを追加</button></div>
      </fieldset>
      <label>出典・関連リンク（1行に1つ、3件まで）<textarea id="road-edit-links" rows="3" placeholder="https://…"></textarea></label>
      <p class="road-edit-notice">画像とリンクは地図の吹き出しに公開されます。写真は圧縮し、位置情報などの画像内データを取り除いて保存します。</p>
      <p id="road-edit-status" role="status"></p><div class="road-edit-actions"><button type="button" id="road-edit-cancel">キャンセル</button><button type="submit" id="road-edit-save">保存する</button></div></form>`;
    document.body.append(dialog); form = byId("road-edit-form");
    form.addEventListener("submit", save);
    byId("road-edit-cancel").addEventListener("click", () => { if (!state.busy) { dialog.close(); cleanup(); } });
    dialog.addEventListener("cancel", event => { if (state.busy) event.preventDefault(); else cleanup(); });
    byId("road-edit-files").addEventListener("change", event => addFiles([...event.target.files]));
    dialog.addEventListener("paste", event => {
      const files = [...(event.clipboardData?.items || [])].filter(i => i.kind === "file" && i.type.startsWith("image/")).map(i => i.getAsFile()).filter(Boolean);
      if (files.length) { event.preventDefault(); addFiles(files); }
    });
    byId("road-edit-add-url").addEventListener("click", () => {
      const url = httpUrl(byId("road-edit-image-url").value);
      if (!url) { status("画像のURLはhttp://またはhttps://で入力してください。"); return; }
      if (state.images.length >= 3) { status("画像は3枚までです。"); return; }
      state.images.push({ url }); byId("road-edit-image-url").value = ""; renderImages(); status("画像URLを追加しました。「保存する」で反映されます。");
    });
  }
  function open(options) {
    init(); if (dialog.open) return;
    cleanup();
    const at = new Date(options.road.endedAt);
    const local = Number.isFinite(at.getTime()) ? new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0,16) : "";
    state = { ...options, busy: false, originalTime: local, images: (options.road.imageUrls || []).map(httpUrl).filter(Boolean).slice(0,3).map(url => ({url})) };
    byId("road-edit-time").value = local; byId("road-edit-note").value = options.road.note || "";
    byId("road-edit-links").value = (options.road.sourceUrls || []).map(httpUrl).filter(Boolean).join("\n");
    byId("road-edit-image-url").value = ""; byId("road-edit-files").value = "";
    status(""); renderImages(); busy(false); dialog.showModal();
  }
  window.RoadRecordEditor = { open, render, httpUrl };
})();
