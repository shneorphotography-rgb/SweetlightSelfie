import { useRef, useState } from 'react';
import { IS_STATIC_PREVIEW } from '../utils/deployment';

/**
 * Uploads one or more images to /api/upload and calls onUpload(paths[], media[])
 * @param {object} props
 * @param {function} props.onUpload  - called with array of public paths
 * @param {boolean}  props.multiple  - allow multi-file
 * @param {string}   props.preview   - current image path (single mode)
 * @param {string}   props.label     - button label
 */
export default function ImageUpload({ onUpload, multiple = false, preview, label = 'העלה תמונה' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = async (files) => {
    if (IS_STATIC_PREVIEW) return;
    if (!files || !files.length) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('file', f));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('העלאה נכשלה');
      const { paths, media = [] } = await res.json();
      onUpload(paths, media);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Single image preview */}
      {!multiple && preview && (
        <div style={{ marginBottom: '0.6rem' }}>
          <img
            src={preview}
            alt="תצוגה מקדימה"
            style={{
              width: '100%',
              height: '140px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1px solid var(--ssf-border)',
              background: 'color-mix(in srgb, var(--ssf-surface) 88%, var(--ssf-border))',
              display: 'block',
            }}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        style={{ display: 'none' }}
        disabled={IS_STATIC_PREVIEW}
        onChange={e => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || IS_STATIC_PREVIEW}
        style={{
          width: '100%',
          minHeight: '44px',
          padding: '0.65rem',
          border: '1.5px dashed var(--ssf-cyan)',
          borderRadius: '4px',
          background: uploading ? 'var(--ssf-brand-soft)' : 'transparent',
          color: 'var(--ssf-cyan)',
          fontFamily: 'Heebo, sans-serif',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          cursor: uploading || IS_STATIC_PREVIEW ? 'not-allowed' : 'pointer',
          opacity: IS_STATIC_PREVIEW ? 0.62 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { if (!uploading && !IS_STATIC_PREVIEW) e.currentTarget.style.background = 'var(--ssf-brand-soft)'; }}
        onMouseLeave={e => { if (!uploading && !IS_STATIC_PREVIEW) e.currentTarget.style.background = 'transparent'; }}
      >
        {uploading ? (
          'מעלה...'
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {label}
          </>
        )}
      </button>

      {IS_STATIC_PREVIEW && (
        <p style={{ color: 'var(--ssf-muted)', fontSize: '0.7rem', marginTop: '0.4rem', fontFamily: 'Heebo, sans-serif', lineHeight: 1.55 }}>
          העלאת קבצים זמינה בגרסה המקומית. בדמו של GitHub Pages ניתן לבדוק את כל אפשרויות העיצוב עם התמונות הקיימות.
        </p>
      )}

      {error && (
        <p style={{ color: 'var(--ssf-danger)', fontSize: '0.72rem', marginTop: '0.35rem', fontFamily: 'Heebo, sans-serif' }}>
          {error}
        </p>
      )}
    </div>
  );
}
