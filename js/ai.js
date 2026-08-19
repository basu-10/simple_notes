import { $, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { setting, saveSetting } from "./db.js";
import { modal, closeModal, renderModelOptions } from "./ui.js";

export async function settings() {
  let key = await setting("orKey") || "";
  state.endpoints = await setting("endpoints") || [];
  modal(`<h2>Settings</h2><p>Local data stays in IndexedDB. Requests are sent directly from this browser (BYOK). Add custom model endpoints to use them from the AI assistant dropdown.</p>
  <div class="field"><label>OpenRouter API key</label><input id="orKey" type="password" value="${esc(key)}" placeholder="sk-or-v1-…"></div>
  <div class="field"><label>Custom Model Endpoints</label>
   <div class="endpoint-list" id="endpointList"></div>
   <div class="endpoint-add">
    <input id="epName" placeholder="Label (e.g. Local Llama)">
    <div class="row"><input id="epUrl" placeholder="https://host/v1/chat/completions"><input id="epModel" placeholder="model id (optional)"></div>
    <div class="row"><input id="epKey" type="password" placeholder="API key (optional)"><button class="primary" id="addEp">Add</button></div>
   </div>
  </div>
  <div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="save">Save</button></div>`);

  function drawList() {
    const list = $("endpointList"); list.innerHTML = "";
    if (!state.endpoints.length) {
      const e = document.createElement("div"); e.className = "endpoint-empty"; e.textContent = "No custom endpoints yet."; list.appendChild(e); return;
    }
    state.endpoints.forEach((e, i) => {
      const item = document.createElement("div"); item.className = "endpoint-item";
      const name = document.createElement("span"); name.className = "ep-name"; name.textContent = e.name;
      const url = document.createElement("span"); url.className = "ep-url"; url.textContent = e.url;
      const del = document.createElement("button"); del.className = "ep-del"; del.textContent = "×"; del.onclick = () => { state.endpoints.splice(i, 1); drawList(); };
      item.append(name, url, del); list.appendChild(item);
    });
  }
  drawList();

  $("addEp").onclick = () => {
    const name = $("epName").value.trim(), url = $("epUrl").value.trim();
    if (!name || !url) return toast("Label and URL required");
    state.endpoints.push({ name, url, model: $("epModel").value.trim(), key: $("epKey").value.trim() });
    $("epName").value = ""; $("epUrl").value = ""; $("epModel").value = ""; $("epKey").value = "";
    drawList();
  };

  $("cancel").onclick = closeModal;
  $("save").onclick = async () => {
    await saveSetting("orKey", $("orKey").value.trim());
    await saveSetting("endpoints", state.endpoints);
    closeModal(); renderModelOptions(); toast("Settings saved");
  };
}

export async function askAI() {
  let n = state.items.find(x => x.id === state.selected), key = await setting("orKey");
  if (!n) return toast("Open a note first");
  const sel = $("model").value;
  let url = "https://openrouter.ai/api/v1/chat/completions", model = sel, authKey = key;
  if (sel.startsWith("custom:")) {
    const ep = state.endpoints[+sel.slice(7)];
    if (!ep) return toast("Selected endpoint missing");
    url = ep.url; model = ep.model || ep.name; authKey = ep.key || key;
    if (!authKey) return toast("API key required for this endpoint");
  } else if (!key) return settings();
  toast("Reviewing note…");
  try {
    let r = await fetch(url, {
      method: "POST",
      headers: { "Authorization": "Bearer " + authKey, "Content-Type": "application/json", "HTTP-Referer": location.href, "X-Title": "NoteZen" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Review this plain-text note for factual ambiguity, logical gaps, unsupported claims, and unclear terminology. Return concise findings only.\n\n" + n.content }], temperature: .2 })
    });
    let d = await r.json();
    if (!r.ok) throw Error(d.error?.message || "Request failed");
    modal("<h2>AI Review</h2><p>" + esc(d.choices?.[0]?.message?.content || "No response").replace(/\n/g, "<br>") + '</p><div class="modal-actions"><button class="primary" id="close">Close</button></div>');
    $("close").onclick = closeModal;
  } catch (e) {
    toast(e.message);
  }
}
