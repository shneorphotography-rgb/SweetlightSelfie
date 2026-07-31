import { useEffect, useMemo, useRef, useState } from 'react';
import { getImageFrameStyle, normalizeFrame, updateFrameValue } from '../utils/imageFrame';
import './hero-media.css';

const PAN_LIMIT = 50;
const WHEEL_COMMIT_DELAY = 180;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export default function ImageFrameEditor({
  src,
  value,
  onChange,
  aspectRatio = '16 / 9',
  label = 'שליטת פריים',
  previewOverlay = null,
  previewStyle = null,
  showSourcePreview = false,
  onInteractionStart,
  onInteractionEnd,
}) {
  const previewRef = useRef(null);
  const wheelTimerRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const interactingRef = useRef(false);
  const normalizedValue = useMemo(() => normalizeFrame(value), [value]);
  const [draft, setDraft] = useState(normalizedValue);
  const draftRef = useRef(normalizedValue);
  const [dragging, setDragging] = useState(false);

  const setLocalDraft = (nextValue) => {
    const next = normalizeFrame(nextValue);
    draftRef.current = next;
    setDraft(next);
  };

  useEffect(() => {
    if (!interactingRef.current) setLocalDraft(normalizedValue);
  }, [normalizedValue.x, normalizedValue.y, normalizedValue.zoom]);

  useEffect(() => () => {
    if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
  }, []);

  const beginInteraction = () => {
    if (interactingRef.current) return;
    interactingRef.current = true;
    onInteractionStart?.();
  };

  const commit = (nextValue = draftRef.current) => {
    const next = normalizeFrame(nextValue);
    setLocalDraft(next);
    onChange?.(next);
    interactingRef.current = false;
    onInteractionEnd?.(next);
  };

  const resetGestureFromPointers = () => {
    const points = [...pointersRef.current.values()];
    if (!points.length) {
      gestureRef.current = null;
      return;
    }

    if (points.length === 1) {
      gestureRef.current = {
        frame: draftRef.current,
        point: points[0],
      };
      return;
    }

    gestureRef.current = {
      frame: draftRef.current,
      distance: Math.max(pointerDistance(points[0], points[1]), 1),
      midpoint: pointerMidpoint(points[0], points[1]),
    };
  };

  const handlePointerDown = (event) => {
    if (!previewRef.current || !src) return;
    event.preventDefault();
    previewRef.current.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginInteraction();
    setDragging(true);
    resetGestureFromPointers();
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId) || !previewRef.current) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    const rect = previewRef.current.getBoundingClientRect();
    if (!gesture || !rect.width || !rect.height) return;

    if (points.length === 1 && gesture.point) {
      const deltaX = points[0].x - gesture.point.x;
      const deltaY = points[0].y - gesture.point.y;
      setLocalDraft({
        ...gesture.frame,
        x: clamp(gesture.frame.x - (deltaX / rect.width) * 100, -PAN_LIMIT, PAN_LIMIT),
        y: clamp(gesture.frame.y - (deltaY / rect.height) * 100, -PAN_LIMIT, PAN_LIMIT),
      });
      return;
    }

    if (points.length >= 2 && gesture.distance) {
      const distance = Math.max(pointerDistance(points[0], points[1]), 1);
      const midpoint = pointerMidpoint(points[0], points[1]);
      const zoom = clamp(gesture.frame.zoom * (distance / gesture.distance), 1, 2.5);
      setLocalDraft({
        ...gesture.frame,
        zoom,
        x: clamp(gesture.frame.x - ((midpoint.x - gesture.midpoint.x) / rect.width) * 100, -PAN_LIMIT, PAN_LIMIT),
        y: clamp(gesture.frame.y - ((midpoint.y - gesture.midpoint.y) / rect.height) * 100, -PAN_LIMIT, PAN_LIMIT),
      });
    }
  };

  const finishPointer = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    previewRef.current?.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size) {
      resetGestureFromPointers();
      return;
    }
    gestureRef.current = null;
    setDragging(false);
    commit();
  };

  const handleWheel = (event) => {
    if (!previewRef.current || !src) return;
    event.preventDefault();
    beginInteraction();
    const rect = previewRef.current.getBoundingClientRect();
    const current = draftRef.current;
    const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0014), 1, 2.5);
    const zoomDelta = nextZoom - current.zoom;
    const anchorX = ((event.clientX - rect.left) / rect.width) * 100;
    const anchorY = ((event.clientY - rect.top) / rect.height) * 100;
    setLocalDraft({
      ...current,
      zoom: nextZoom,
      x: clamp(current.x + (anchorX - 50) * (zoomDelta / nextZoom), -PAN_LIMIT, PAN_LIMIT),
      y: clamp(current.y + (anchorY - 50) * (zoomDelta / nextZoom), -PAN_LIMIT, PAN_LIMIT),
    });

    if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null;
      commit();
    }, WHEEL_COMMIT_DELAY);
  };

  const handleKeyDown = (event) => {
    const step = event.shiftKey ? 5 : 1;
    const current = draftRef.current;
    let patch = null;
    if (event.key === 'ArrowLeft') patch = { x: current.x - step };
    if (event.key === 'ArrowRight') patch = { x: current.x + step };
    if (event.key === 'ArrowUp') patch = { y: current.y - step };
    if (event.key === 'ArrowDown') patch = { y: current.y + step };
    if (event.key === '+' || event.key === '=') patch = { zoom: current.zoom + 0.05 };
    if (event.key === '-' || event.key === '_') patch = { zoom: current.zoom - 0.05 };
    if (event.key === 'Home') patch = { x: 0, y: 0, zoom: 1 };
    if (!patch) return;
    event.preventDefault();
    beginInteraction();
    const next = updateFrameValue(current, patch);
    setLocalDraft(next);
    commit(next);
  };

  const updateFromRange = (patch) => {
    beginInteraction();
    setLocalDraft(updateFrameValue(draftRef.current, patch));
  };

  if (!src) return null;

  return (
    <div className="ssf-frame-editor">
      <div className="ssf-frame-editor__head">
        <div>
          <p className="ssf-frame-editor__eyebrow">{label}</p>
          <p className="ssf-frame-editor__hint">גרירה להזזה · גלגלת או צביטה לזום · חצים לדיוק</p>
        </div>
        <div className="ssf-frame-editor__actions">
          <button type="button" onClick={() => commit({ ...draftRef.current, x: 0, y: 0 })}>מרכז</button>
          <button type="button" onClick={() => commit({ x: 0, y: 0, zoom: 1 })}>איפוס</button>
        </div>
      </div>

      {showSourcePreview && (
        <div className="ssf-frame-source">
          <span>הקובץ המלא</span>
          <img src={src} alt="התמונה המלאה לפני חיתוך" />
        </div>
      )}

      <div
        ref={previewRef}
        className={`ssf-frame-crop${dragging ? ' is-dragging' : ''}`}
        style={{ aspectRatio, ...(previewStyle || {}) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        role="application"
        tabIndex={0}
        aria-label="תצוגת חיתוך אינטראקטיבית. השתמשו בחצים להזזה ובמקשי פלוס ומינוס לזום."
      >
        <img
          src={src}
          alt=""
          draggable="false"
          style={{ ...getImageFrameStyle(draft) }}
        />
        {previewOverlay && <div className="ssf-frame-crop__overlay">{previewOverlay}</div>}
      </div>

      <div className="ssf-frame-controls">
        <label>
          <span>זום <output>{draft.zoom.toFixed(2)}×</output></span>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.01"
            value={draft.zoom}
            onChange={(event) => updateFromRange({ zoom: Number(event.target.value) })}
            onPointerUp={() => commit()}
            onKeyUp={() => commit()}
            onBlur={() => interactingRef.current && commit()}
          />
        </label>
        <div className="ssf-frame-controls__pair">
          <label>
            <span>אופקי <output>{Math.round(draft.x)}</output></span>
            <input
              type="range"
              min={-PAN_LIMIT}
              max={PAN_LIMIT}
              step="1"
              value={draft.x}
              onChange={(event) => updateFromRange({ x: Number(event.target.value) })}
              onPointerUp={() => commit()}
              onKeyUp={() => commit()}
              onBlur={() => interactingRef.current && commit()}
            />
          </label>
          <label>
            <span>אנכי <output>{Math.round(draft.y)}</output></span>
            <input
              type="range"
              min={-PAN_LIMIT}
              max={PAN_LIMIT}
              step="1"
              value={draft.y}
              onChange={(event) => updateFromRange({ y: Number(event.target.value) })}
              onPointerUp={() => commit()}
              onKeyUp={() => commit()}
              onBlur={() => interactingRef.current && commit()}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
