import { $, esc, toast, uid } from "./utils.js";
import { state } from "./state.js";
import { setting, saveSetting } from "./db.js";
import { modal, closeModal, renderProviderOptions, renderAI } from "./ui.js";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_DEFAULT_MODELS = ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-3.5-haiku"];

export async function loadProviders() {
  let p = await setting("providers");
  if (Array.isArray(p) && p.length) return p;
  const orKey = await setting("orKey") || "";
  const eps = await setting("endpoints") || [];
  const out = [];
  if (orKey) out.push({ id: uid(), name: "OpenRouter", type: "openrouter", key: orKey, models: [...OPENROUTER_DEFAULT_MODELS] });
  eps.forEach(e => out.push({ id: uid(), name: e.name, type: "lmstudio", key: "", models: e.model ? [e.model] : [] }));
  return out;
}

export async function settings() {
  state.providers = await loadProviders();

  modal(`<h2>Settings</h2><p>Local data stays in IndexedDB. Requests are sent directly from this browser (BYOK). Add AI providers — pick a preset, then list the models you want to use from the assistant dropdown.</p>
  <div class="field"><label>Providers</label>
    <div class="provider-list" id="providerList"></div>
    <button class="primary" id="addProvider">+ Add provider</button>
  </div>
  <div class="provider-form" id="providerForm" hidden>
    <div class="field"><label>Name</label><input id="pvName" placeholder="e.g. My OpenRouter"></div>
    <div class="field"><label>Preset</label>
      <select id="pvType">
        <option value="openrouter">OpenRouter</option>
        <option value="lmstudio">LM Studio (local)</option>
      </select>
    </div>
    <div class="field" id="pvKeyWrap"><label>OpenRouter API key</label><input id="pvKey" type="password" placeholder="sk-or-v1-…"></div>
    <div class="field"><label>Models</label>
      <div class="model-list" id="pvModelList"></div>
      <div class="row"><input id="pvModel" placeholder="model id (e.g. anthropic/claude-3.5-haiku)"><button class="primary" id="pvAddModel">Add</button></div>
    </div>
    <div class="modal-actions"><button id="pvCancel">Cancel</button><button class="primary" id="pvSave">Add provider</button></div>
  </div>
  <div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="save">Save</button></div>`);

  const form = $("providerForm");
  let pv = null;

  function drawProviderList() {
    const list = $("providerList"); list.innerHTML = "";
    if (!state.providers.length) {
      const e = document.createElement("div"); e.className = "provider-empty"; e.textContent = "No providers yet."; list.appendChild(e); return;
    }
    state.providers.forEach((p, i) => {
      const item = document.createElement("div"); item.className = "provider-item";
      const name = document.createElement("span"); name.className = "pv-name"; name.textContent = p.name;
      const meta = document.createElement("span"); meta.className = "pv-meta";
      meta.textContent = (p.type === "openrouter" ? "OpenRouter" : "LM Studio") + " · " + (p.models.length || 0) + " model" + (p.models.length === 1 ? "" : "s");
      const edit = document.createElement("button"); edit.className = "pv-edit"; edit.textContent = "Edit"; edit.onclick = () => showForm(i);
      const del = document.createElement("button"); del.className = "pv-del"; del.textContent = "×"; del.onclick = () => { state.providers.splice(i, 1); drawProviderList(); };
      item.append(name, meta, edit, del); list.appendChild(item);
    });
  }

  function drawFormModels() {
    const list = $("pvModelList"); list.innerHTML = "";
    if (!pv.models.length) {
      const e = document.createElement("div"); e.className = "provider-empty"; e.textContent = "No models added."; list.appendChild(e); return;
    }
    pv.models.forEach((m, i) => {
      const item = document.createElement("div"); item.className = "model-item";
      const name = document.createElement("span"); name.textContent = m;
      const del = document.createElement("button"); del.className = "pv-del"; del.textContent = "×"; del.onclick = () => { pv.models.splice(i, 1); drawFormModels(); };
      item.append(name, del); list.appendChild(item);
    });
  }

  function syncType() {
    const isOR = $("pvType").value === "openrouter";
    $("pvKeyWrap").hidden = !isOR;
    if (!isOR) $("pvKey").value = "";
  }

  function showForm(index) {
    const existing = index != null ? state.providers[index] : null;
    pv = existing
      ? { ...existing, models: [...existing.models] }
      : { id: uid(), name: "", type: "openrouter", key: "", models: [] };
    $("pvName").value = pv.name;
    $("pvType").value = pv.type;
    $("pvKey").value = pv.key;
    syncType();
    drawFormModels();
    form.hidden = false;
    $("addProvider").hidden = true;
    $("pvSave").textContent = existing ? "Save changes" : "Add provider";
  }

  function hideForm() {
    form.hidden = true;
    $("addProvider").hidden = false;
    pv = null;
  }

  drawProviderList();

  $("addProvider").onclick = () => showForm(null);
  $("pvCancel").onclick = hideForm;
  $("pvType").onchange = syncType;
  $("pvAddModel").onclick = () => {
    const v = $("pvModel").value.trim();
    if (!v) return toast("Enter a model id");
    if (pv.models.includes(v)) return toast("Model already added");
    pv.models.push(v); $("pvModel").value = ""; drawFormModels();
  };
  $("pvModel").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("pvAddModel").click(); } });
  $("pvSave").onclick = () => {
    const name = $("pvName").value.trim();
    if (!name) return toast("Name required");
    const type = $("pvType").value;
    const key = $("pvKey").value.trim();
    if (type === "openrouter" && !key) return toast("OpenRouter API key required");
    if (!pv.models.length) return toast("Add at least one model");
    pv.name = name; pv.type = type; pv.key = key;
    const idx = state.providers.findIndex(p => p.id === pv.id);
    if (idx >= 0) state.providers[idx] = pv; else state.providers.push(pv);
    hideForm(); drawProviderList();
  };

  $("cancel").onclick = closeModal;
  $("save").onclick = async () => {
    await saveSetting("providers", state.providers);
    closeModal(); renderProviderOptions(); renderAI(); toast("Settings saved");
  };
}

export async function askAI() {
  let n = state.items.find(x => x.id === state.selected);
  if (!n) return toast("Open a note first");
  if (!state.providers.length) return settings();
  const p = state.providers.find(x => x.id === $("provider").value);
  if (!p) return settings();
  const model = $("model").value;
  if (!model) return toast("Add a model to this provider first");

  let url, authKey = "";
  if (p.type === "lmstudio") {
    url = LM_STUDIO_URL;
  } else {
    url = OPENROUTER_URL;
    authKey = p.key;
    if (!authKey) return settings();
  }

  toast("Reviewing note…");
  try {
    const headers = { "Content-Type": "application/json" };
    if (authKey) headers["Authorization"] = "Bearer " + authKey;
    if (p.type === "openrouter") { headers["HTTP-Referer"] = location.href; headers["X-Title"] = "NoteZen"; }
    let r = await fetch(url, {
      method: "POST",
      headers,
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
