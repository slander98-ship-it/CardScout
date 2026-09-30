import { useRef } from 'react';
import { processPhoto } from '../lib/image.js';
import { IconCamera, IconUpload } from './icons.jsx';

/** Hidden native inputs: `capture` opens the rear camera on iOS/Android; the other opens the photo library. */
export function usePhotoPicker(onPhoto) {
  const camRef = useRef(null);
  const libRef = useRef(null);
  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPhoto(await processPhoto(file), file);
  };
  const inputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </>
  );
  return { openCamera: () => camRef.current?.click(), openLibrary: () => libRef.current?.click(), inputs };
}

/** Front/back photo slot used in the card form. */
export function PhotoSlot({ label, src, onChange }) {
  const { openCamera, openLibrary, inputs } = usePhotoPicker((p) => onChange(p));
  return (
    <div className="flex-1">
      {inputs}
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-dim">{label}</div>
      <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-line bg-panel2">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">No photo</div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={openCamera} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-panel2 border border-line text-sm" aria-label={`Take ${label} photo`}>
          <IconCamera className="h-4 w-4" /> Snap
        </button>
        <button type="button" onClick={openLibrary} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-panel2 border border-line text-sm" aria-label={`Upload ${label} photo`}>
          <IconUpload className="h-4 w-4" /> Upload
        </button>
      </div>
    </div>
  );
}
