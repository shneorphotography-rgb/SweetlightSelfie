import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import defaultConfig from '../data/config.json';
import { rebasePublicAssets } from '../utils/deployment';
import { loadPublicShare } from '../sharing/shareRepository';

const STORAGE_KEY = 'sweetlight-selfie:cms-config:v1';
const LEGACY_STORAGE_KEY = 'cms-config';
const HISTORY_LIMIT = 100;
const HISTORY_COALESCE_MS = 400;
const COMPANION_CHANGE_MS = 50;
const SAVE_STATUS_DELAY_MS = 450;
const EDITOR_LAYOUT_SETTLE_MS = 280;
const EDITOR_TOPBAR_HEIGHT = 58;
const EDITOR_SECTION_IDS = new Set([
  'hero',
  'about',
  'gallery',
  'pricing',
  'testimonials',
  'faq',
  'contact',
  'custom1',
  'custom2',
  'custom3',
]);
const runtimeDefaultConfig = rebasePublicAssets(defaultConfig);

/* ── deep-set helper: set(obj, 'a.b.c', val) ── */
function deepSet(obj, path, value) {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPathValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function getSingleLeafChange(before, after, trail = '') {
  if (Object.is(before, after)) return null;

  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
      return null;
    }

    let changedLeaf = null;
    for (let index = 0; index < before.length; index++) {
      if (Object.is(before[index], after[index])) continue;
      const candidate = getSingleLeafChange(before[index], after[index], `${trail}[${index}]`);
      if (!candidate || changedLeaf) return null;
      changedLeaf = candidate;
    }
    return changedLeaf;
  }

  if (isObject(before) || isObject(after)) {
    if (!isObject(before) || !isObject(after)) return null;
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    if (
      beforeKeys.length !== afterKeys.length
      || beforeKeys.some(key => !Object.prototype.hasOwnProperty.call(after, key))
    ) {
      return null;
    }

    let changedLeaf = null;
    for (const key of beforeKeys) {
      if (Object.is(before[key], after[key])) continue;
      const candidate = getSingleLeafChange(before[key], after[key], `${trail}.${key}`);
      if (!candidate || changedLeaf) return null;
      changedLeaf = candidate;
    }
    return changedLeaf;
  }

  return { before, after, trail };
}

function getCoalesceDescriptor(path, before, after) {
  const changedLeaf = getSingleLeafChange(before, after);
  if (!changedLeaf) return null;

  if (typeof changedLeaf.before === 'string' && typeof changedLeaf.after === 'string') {
    return {
      key: `${path}${changedLeaf.trail}`,
      kind: 'typing',
    };
  }

  if (
    typeof changedLeaf.before === 'number'
    && typeof changedLeaf.after === 'number'
  ) {
    return {
      key: `${path}${changedLeaf.trail}`,
      kind: 'continuous',
    };
  }

  return null;
}

function deepMerge(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? [...override] : [...base];
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const next = { ...base };
  const source = isObject(override) ? override : {};

  Object.keys(source).forEach((key) => {
    next[key] = key in base ? deepMerge(base[key], source[key]) : source[key];
  });

  return next;
}

function withoutCoverFrame(item) {
  const {
    coverX: _coverX,
    coverY: _coverY,
    coverZoom: _coverZoom,
    coverFrameSource: _coverFrameSource,
    ...rest
  } = item;
  return rest;
}

function getAutomaticCoverFields(item) {
  const automatic = item?.autoCover;
  const coverImage = automatic?.image || item?.coverImage || '';
  const coverFocus = automatic?.focus?.source === coverImage
    ? automatic.focus
    : item?.coverFocus?.source === coverImage
      ? item.coverFocus
      : undefined;
  const metadata = item?.imageMetadata?.[coverImage];

  return {
    coverImage,
    coverFocus,
    ...(metadata
      ? { aspectRatio: metadata.height > metadata.width ? '2:3' : '3:2' }
      : {}),
  };
}

function mergeGalleryItem(defaultItem, savedItem) {
  const merged = deepMerge(defaultItem, savedItem);
  const latestAutoCover = defaultItem.autoCover || merged.autoCover;
  const knownAutomaticImages = new Set([
    defaultItem.coverImage,
    latestAutoCover?.image,
    ...(latestAutoCover?.previousImages || []),
  ].filter(Boolean));
  const explicitMode = savedItem.coverMode;
  const legacyLooksManual = (
    Boolean(savedItem.coverImage)
    && !knownAutomaticImages.has(savedItem.coverImage)
  );
  const coverMode = explicitMode || (legacyLooksManual ? 'manual' : 'auto');

  if (coverMode === 'manual') {
    return {
      ...merged,
      autoCover: latestAutoCover,
      coverMode: 'manual',
      coverFocus: merged.coverFocus?.source === merged.coverImage
        ? merged.coverFocus
        : undefined,
    };
  }

  const automaticFields = getAutomaticCoverFields(defaultItem);
  const sourceChanged = (
    Boolean(savedItem.coverImage)
    && savedItem.coverImage !== automaticFields.coverImage
  );
  const frameMatches = (
    savedItem.coverFrameSource
      ? savedItem.coverFrameSource === automaticFields.coverImage
      : !sourceChanged
  );
  const autoMerged = frameMatches ? merged : withoutCoverFrame(merged);

  return {
    ...autoMerged,
    ...automaticFields,
    autoCover: latestAutoCover,
    coverMode: 'auto',
  };
}

function applyLegacySectionCompatibility(merged, override) {
  const savedHero = override?.sections?.hero;
  if (
    isObject(savedHero)
    && !Object.prototype.hasOwnProperty.call(savedHero, 'title')
  ) {
    const language = savedHero.displayLanguage || 'en';
    merged.sections.hero.title = language === 'he'
      ? (savedHero.titleHe || savedHero.titleEn || merged.sections.hero.title)
      : (savedHero.titleEn || savedHero.titleHe || merged.sections.hero.title);
  }

  const savedAbout = override?.sections?.about;
  if (
    isObject(savedAbout)
    && !Object.prototype.hasOwnProperty.call(savedAbout, 'images')
    && Object.prototype.hasOwnProperty.call(savedAbout, 'image')
  ) {
    merged.sections.about.images = savedAbout.image
      ? [{
          id: 'about-primary',
          src: savedAbout.image,
          alt: '',
          frame: savedAbout.imageFrame || { x: 0, y: 0, zoom: 1 },
        }]
      : [];
  }

  return merged;
}

function mergeConfig(base, override) {
  const merged = applyLegacySectionCompatibility(deepMerge(base, override), override);
  if (!Array.isArray(base?.galleryItems) || !Array.isArray(override?.galleryItems)) {
    return merged;
  }

  const defaultsByKey = new Map(
    base.galleryItems
      .filter(item => item.galleryKey)
      .map(item => [String(item.galleryKey), item]),
  );
  const defaultsById = new Map(
    base.galleryItems.map(item => [String(item.id), item]),
  );
  merged.galleryItems = override.galleryItems.map((item) => {
    if (!isObject(item)) return item;
    const defaultItem = (
      (item.galleryKey && defaultsByKey.get(String(item.galleryKey)))
      || defaultsById.get(String(item.id))
    );
    return defaultItem ? mergeGalleryItem(defaultItem, item) : item;
  });

  return merged;
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) return mergeConfig(runtimeDefaultConfig, rebasePublicAssets(JSON.parse(raw)));
  } catch { /* ignore */ }
  return mergeConfig(runtimeDefaultConfig, {});
}

function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

/* ────────────────────────────────────────────── */

const EditorContext = createContext(null);

export function EditorProvider({ children, readOnly = false, shareToken = null }) {
  const [config, setConfig] = useState(() => (
    readOnly ? mergeConfig(runtimeDefaultConfig, {}) : loadConfig()
  ));
  const configRef = useRef(config);
  const historyRef = useRef({
    past: [],
    future: [],
    coalesce: null,
  });
  const panelUiStateRef = useRef(new Map());
  const saveStatusTimerRef = useRef(null);
  const sectionScrollRef = useRef({
    firstFrame: null,
    secondFrame: null,
    timer: null,
  });
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [saveStatus, setSaveStatus] = useState('saved');
  const [isEditing, setIsEditing] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [isShareLoading, setIsShareLoading] = useState(Boolean(readOnly && shareToken));
  const [shareError, setShareError] = useState('');

  const getEditorPanelState = useCallback((panelId, key, initialValue) => {
    const stateKey = `${panelId}:${key}`;
    if (!panelUiStateRef.current.has(stateKey)) {
      panelUiStateRef.current.set(
        stateKey,
        typeof initialValue === 'function' ? initialValue() : initialValue,
      );
    }
    return panelUiStateRef.current.get(stateKey);
  }, []);

  const setEditorPanelState = useCallback((panelId, key, nextValue) => {
    const stateKey = `${panelId}:${key}`;
    const previous = panelUiStateRef.current.get(stateKey);
    const next = typeof nextValue === 'function' ? nextValue(previous) : nextValue;
    panelUiStateRef.current.set(stateKey, next);
    return next;
  }, []);

  const syncHistoryState = useCallback(() => {
    const history = historyRef.current;
    const nextCanUndo = history.past.length > 0;
    const nextCanRedo = history.future.length > 0;
    setHistoryState(current => (
      current.canUndo === nextCanUndo && current.canRedo === nextCanRedo
        ? current
        : { canUndo: nextCanUndo, canRedo: nextCanRedo }
    ));
  }, []);

  const markSaving = useCallback(() => {
    setSaveStatus('saving');
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
    }
    saveStatusTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      saveStatusTimerRef.current = null;
    }, SAVE_STATUS_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
    }
  }, []);

  const cancelPendingSectionScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const pending = sectionScrollRef.current;

    if (pending.firstFrame !== null) {
      window.cancelAnimationFrame(pending.firstFrame);
    }
    if (pending.secondFrame !== null) {
      window.cancelAnimationFrame(pending.secondFrame);
    }
    if (pending.timer !== null) {
      window.clearTimeout(pending.timer);
    }

    sectionScrollRef.current = {
      firstFrame: null,
      secondFrame: null,
      timer: null,
    };
  }, []);

  useEffect(() => () => cancelPendingSectionScroll(), [cancelPendingSectionScroll]);

  const scrollToSection = useCallback((id) => {
    cancelPendingSectionScroll();
    if (
      !EDITOR_SECTION_IDS.has(id)
      || typeof window === 'undefined'
      || typeof document === 'undefined'
    ) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const performScroll = () => {
      sectionScrollRef.current.timer = null;
      const section = document.getElementById(id);
      if (!section || section.hidden || section.getClientRects().length === 0) return;

      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      const topOffset = (isDesktop ? EDITOR_TOPBAR_HEIGHT : 0) + 16;
      const targetTop = Math.max(
        0,
        window.scrollY + section.getBoundingClientRect().top - topOffset,
      );

      window.scrollTo({
        top: targetTop,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    };

    sectionScrollRef.current.firstFrame = window.requestAnimationFrame(() => {
      sectionScrollRef.current.firstFrame = null;
      sectionScrollRef.current.secondFrame = window.requestAnimationFrame(() => {
        sectionScrollRef.current.secondFrame = null;
        sectionScrollRef.current.timer = window.setTimeout(
          performScroll,
          reducedMotion ? 0 : EDITOR_LAYOUT_SETTLE_MS,
        );
      });
    });
  }, [cancelPendingSectionScroll]);

  const recordHistory = useCallback((previous, descriptor = null) => {
    const history = historyRef.current;
    const now = Date.now();
    const active = history.coalesce;
    const withinCoalesceWindow = (
      descriptor
      && active
      && descriptor.kind === active.kind
      && now - active.lastAt <= HISTORY_COALESCE_MS
    );
    const isKnownKey = withinCoalesceWindow && active.keys.includes(descriptor.key);
    const isCompanionTypingChange = (
      withinCoalesceWindow
      && descriptor.kind === 'typing'
      && now - active.lastAt <= COMPANION_CHANGE_MS
      && active.keys.length < 4
    );
    const shouldCoalesce = (
      history.past.length > 0
      && (isKnownKey || isCompanionTypingChange)
    );

    if (shouldCoalesce) {
      history.coalesce = {
        ...active,
        keys: isKnownKey ? active.keys : [...active.keys, descriptor.key],
        lastAt: now,
      };
    } else {
      history.past = [...history.past, previous].slice(-HISTORY_LIMIT);
      history.coalesce = descriptor
        ? { kind: descriptor.kind, keys: [descriptor.key], lastAt: now }
        : null;
    }

    history.future = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const persistConfig = useCallback((next) => {
    configRef.current = next;
    setConfig(next);
    saveConfig(next);
    markSaving();
  }, [markSaving]);

  useEffect(() => {
    if (!readOnly || !shareToken) return undefined;

    let isCurrent = true;
    setIsShareLoading(true);
    setShareError('');

    loadPublicShare(shareToken)
      .then(data => {
        if (!isCurrent || !data.config) return;
        const next = mergeConfig(runtimeDefaultConfig, rebasePublicAssets(data.config));
        configRef.current = next;
        setConfig(next);
      })
      .catch(() => {
        if (isCurrent) setShareError('לא הצלחנו לטעון את הגרסה המשותפת.');
      })
      .finally(() => {
        if (isCurrent) setIsShareLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [readOnly, shareToken]);

  const updateConfig = useCallback((path, value) => {
    if (readOnly) return;
    const previous = configRef.current;
    const previousValue = getPathValue(previous, path);
    const next = deepSet(previous, path, value);
    if (!Object.is(previousValue, value)) {
      recordHistory(previous, getCoalesceDescriptor(path, previousValue, value));
    }
    persistConfig(next);
  }, [persistConfig, readOnly, recordHistory]);

  const replaceConfig = useCallback((nextValue) => {
    if (readOnly) return;
    const previous = configRef.current;
    const next = typeof nextValue === 'function' ? nextValue(previous) : nextValue;
    if (!Object.is(previous, next)) {
      recordHistory(previous);
    }
    persistConfig(next);
  }, [persistConfig, readOnly, recordHistory]);

  const undo = useCallback(() => {
    if (readOnly) return;
    const history = historyRef.current;
    if (history.past.length === 0) return;

    const current = configRef.current;
    const previous = history.past[history.past.length - 1];
    history.past = history.past.slice(0, -1);
    history.future = [...history.future, current].slice(-HISTORY_LIMIT);
    history.coalesce = null;
    syncHistoryState();
    persistConfig(previous);
  }, [persistConfig, readOnly, syncHistoryState]);

  const redo = useCallback(() => {
    if (readOnly) return;
    const history = historyRef.current;
    if (history.future.length === 0) return;

    const current = configRef.current;
    const next = history.future[history.future.length - 1];
    history.future = history.future.slice(0, -1);
    history.past = [...history.past, current].slice(-HISTORY_LIMIT);
    history.coalesce = null;
    syncHistoryState();
    persistConfig(next);
  }, [persistConfig, readOnly, syncHistoryState]);

  const toggleEditing = useCallback(() => {
    if (readOnly) return;
    cancelPendingSectionScroll();
    setIsEditing(e => !e);
    setActivePanel(null);
  }, [cancelPendingSectionScroll, readOnly]);

  const openPanel = useCallback((id) => {
    if (readOnly) return;
    setActivePanel(id);
    scrollToSection(id);
  }, [readOnly, scrollToSection]);
  const closePanel = useCallback(() => {
    cancelPendingSectionScroll();
    setActivePanel(null);
  }, [cancelPendingSectionScroll]);

  const resetToDefault = useCallback(() => {
    if (readOnly) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const previous = configRef.current;
    const next = mergeConfig(runtimeDefaultConfig, {});
    if (!Object.is(previous, next)) {
      recordHistory(previous);
    }
    configRef.current = next;
    setConfig(next);
    markSaving();
  }, [markSaving, readOnly, recordHistory]);

  return (
    <EditorContext.Provider value={{
      config,
      isEditing,
      activePanel,
      readOnly,
      isShareLoading,
      shareError,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      saveStatus,
      updateConfig,
      replaceConfig,
      undo,
      redo,
      toggleEditing,
      openPanel,
      scrollToSection,
      closePanel,
      resetToDefault,
      getEditorPanelState,
      setEditorPanelState,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside <EditorProvider>');
  return ctx;
}

export function useEditorPanelState(panelId, key, initialValue) {
  const { getEditorPanelState, setEditorPanelState } = useEditor();
  const [value, setValueState] = useState(() => (
    getEditorPanelState(panelId, key, initialValue)
  ));

  useEffect(() => {
    setValueState(getEditorPanelState(panelId, key, initialValue));
  }, [getEditorPanelState, initialValue, key, panelId]);

  const setValue = useCallback((nextValue) => {
    const next = setEditorPanelState(panelId, key, nextValue);
    setValueState(next);
  }, [key, panelId, setEditorPanelState]);

  return [value, setValue];
}
