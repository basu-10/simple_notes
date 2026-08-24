import { $, uid, toast } from "./utils.js";
import { state } from "./state.js";
import { put, saveSetting } from "./db.js";
import { modal, closeModal, renderAll, root } from "./ui.js";

export function setMode(m) {
  state.mode = m;
  $("localMode").classList.toggle("active", m === "local");
  $("driveMode").classList.toggle("active", m === "drive");
  saveSetting("mode", m);
  if (m === "drive" && !state.driveToken) driveSetup();
}

export function driveSetup() {
  modal(`<h2>Connect Google Drive</h2><p>NoteZen has no backend. Drive access happens directly in your browser using Google's OAuth flow. Supply your own Web OAuth Client ID.</p><div class="field"><label>OAuth Client ID</label><input id="clientId" placeholder="…apps.googleusercontent.com"></div><div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="connect">Connect</button></div>`);
  $("cancel").onclick = () => { closeModal(); setMode("local"); };
  $("connect").onclick = () => connectDrive($("clientId").value.trim());
}

export function connectDrive(id) {
  if (!id) return toast("Client ID required");
  try {
    let tc = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: r => {
        if (r.error) return toast("Drive authorization failed");
        state.driveToken = r.access_token;
        closeModal(); setMode("drive"); toast("Google Drive connected"); loadDrive();
      }
    });
    tc.requestAccessToken({ prompt: "consent" });
  } catch (e) {
    toast("Google Identity Services is not ready");
  }
}

async function df(url, o = {}) {
  let r = await fetch(url, { ...o, headers: { Authorization: "Bearer " + state.driveToken, ...(o.headers || {}) } });
  if (!r.ok) throw Error(await r.text());
  return r;
}

export async function loadDrive() {
  try {
    const query = encodeURIComponent("trashed=false");
    const url = "https://www.googleapis.com/drive/v3/files?pageSize=1000&q=" + query + "&fields=files(id,name,mimeType,modifiedTime,appProperties)";
    const response = await df(url);
    const data = await response.json();
    const files = data.files || [];
    for (const file of files) {
      if (file.mimeType !== "text/plain") continue;
      if (!file.appProperties || file.appProperties.plainnote !== "1") continue;
      const existing = state.items.find(x => x.driveId === file.id);
      if (existing) continue;
      const bodyResponse = await df("https://www.googleapis.com/drive/v3/files/" + file.id + "?alt=media");
      const body = await bodyResponse.text();
      const note = { id: uid(), type: "note", parentId: root().id, title: file.name.replace(/\.txt$/, ""), content: body, createdAt: file.modifiedTime, updatedAt: file.modifiedTime, driveId: file.id };
      state.items.push(note);
      await put(note);
    }
    renderAll();
    toast("Drive notes loaded");
  } catch (e) {
    console.warn(e);
    toast("Drive sync failed");
  }
}

export async function driveSync(n) {
  let meta = { name: (n.title || "Untitled note") + ".txt", mimeType: "text/plain", appProperties: { plainnote: "1" } };
  let form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([n.content], { type: "text/plain" }));
  if (n.driveId) {
    await df("https://www.googleapis.com/upload/drive/v3/files/" + n.driveId + "?uploadType=multipart", { method: "PATCH", body: form });
  } else {
    let r = await df("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", body: form });
    n.driveId = (await r.json()).id;
    await put(n);
  }
}
