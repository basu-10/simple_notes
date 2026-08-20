import { test, expect } from "@playwright/test";

// 1x1 transparent PNG (valid image blob for the object-URL resolution check).
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQDJ/3pUAAAAAElFTkSuQmCC";

test("rich text table + blob image persists and resolves after reload", async ({ page }) => {
  const png = Buffer.from(PNG_B64, "base64");

  await page.goto("/app.html");
  const frame = page.frameLocator(".cke_wysiwyg_frame");
  await expect(page.locator(".cke_wysiwyg_frame")).toBeVisible();

  // Insert an image via the custom AssetImage toolbar button (file picker path).
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator('.cke_button[title="Insert image"]').click()
  ]);
  await chooser.setFiles({ name: "pic.png", mimeType: "image/png", buffer: png });

  const img = frame.locator("img[data-asset-id]");
  await expect(img).toHaveCount(1);
  const assetId = await img.first().getAttribute("data-asset-id");
  expect(assetId).toBeTruthy();

  // Insert a table via the editor API, then trigger autosave.
  await page.evaluate(() => {
    const e = window.CKEDITOR.instances.content;
    e.insertHtml("<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>");
    e.fire("change");
  });

  // The note content should be persisted as HTML (no inline base64).
  const readContent = () =>
    page.evaluate(() => {
      return new Promise(res => {
        const r = indexedDB.open("plainnote-v2");
        r.onsuccess = () => {
          const tx = r.result.transaction("items", "readonly");
          const req = tx.objectStore("items").getAll();
          req.onsuccess = () => {
            const note = req.result.find(x => x.type === "note");
            res(note ? note.content : "");
          };
        };
      });
    });

  await expect.poll(readContent, { timeout: 8000 }).toContain("<table");
  const content = await readContent();
  expect(content).toContain(`data-asset-id="${assetId}"`);
  expect(content).not.toContain("base64");
  expect(content).not.toContain("data:image");

  // The asset blob was stored in the assets store.
  const assetCount = await page.evaluate(
    () =>
      new Promise(res => {
        const r = indexedDB.open("plainnote-v2");
        r.onsuccess = () => {
          const tx = r.result.transaction("assets", "readonly");
          const req = tx.objectStore("assets").getAll();
          req.onsuccess = () => res(req.result.length);
        };
      })
  );
  expect(assetCount).toBe(1);

  // Reload — the image should resolve to a session blob: URL (not be broken).
  await page.reload();
  await expect(page.locator(".cke_wysiwyg_frame")).toBeVisible();
  const img2 = page.frameLocator(".cke_wysiwyg_frame").locator("img[data-asset-id]");
  await expect(img2).toHaveCount(1);
  await expect
    .poll(() => img2.first().getAttribute("src"))
    .toMatch(/^blob:/);
});
