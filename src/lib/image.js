// Downscale camera photos on-device before storing or uploading.
// Phone cameras produce 4–12 MB images; Vercel functions cap request bodies at 4.5 MB.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function resizeDataURL(dataUrl, maxSide = 1600, quality = 0.85) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Returns { full, ai, thumb } data URLs from a picked/captured file. */
export async function processPhoto(file) {
  const original = await readFileAsDataURL(file);
  const [full, ai, thumb] = await Promise.all([
    resizeDataURL(original, 1600, 0.86), // stored "high-res" copy
    resizeDataURL(original, 1280, 0.82), // sent to the vision model
    resizeDataURL(original, 420, 0.75), // grid thumbnail
  ]);
  return { full, ai, thumb };
}

export const base64Of = (dataUrl) => dataUrl.split(',')[1] || '';

export function dataURLtoFile(dataUrl, name) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
