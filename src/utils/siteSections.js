export const CUSTOM_SECTION_IDS = ['custom1', 'custom2', 'custom3'];
export const MAX_CUSTOM_SECTIONS = CUSTOM_SECTION_IDS.length;

export const BUILT_IN_SECTIONS = [
  { id: 'hero', label: 'בית', editorLabel: 'בית' },
  { id: 'about', label: 'אודות', editorLabel: 'אודות' },
  { id: 'gallery', label: 'גלריה', editorLabel: 'גלריה' },
  { id: 'pricing', label: 'הצעת מחיר', editorLabel: 'הצעת מחיר' },
  { id: 'testimonials', label: 'המלצות', editorLabel: 'המלצות' },
  { id: 'faq', label: 'שאלות נפוצות', editorLabel: 'שאלות' },
  { id: 'contact', label: 'צור קשר', editorLabel: 'קשר' },
];

const BUILT_IN_IDS = BUILT_IN_SECTIONS.map(({ id }) => id);
const BUILT_IN_BY_ID = new Map(BUILT_IN_SECTIONS.map(section => [section.id, section]));

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function createCustomSection(id, number = 1) {
  return {
    id,
    created: true,
    enabled: true,
    navLabel: `אישי ${number}`,
    eyebrow: 'הסיפור שלי',
    title: 'כותרת לאזור האישי',
    text: 'כאן אפשר לספר משהו נוסף, להציג שירות מיוחד או לתת לתמונות מקום משלהן.',
    images: [],
    layout: 'split',
    imageSide: 'start',
    textAlign: 'right',
    backgroundColor: 'background',
    desktopPosition: {
      contentX: 0,
      contentY: 0,
      mediaX: 0,
      mediaY: 0,
    },
    mobilePosition: {
      contentX: 0,
      contentY: 0,
      mediaX: 0,
      mediaY: 0,
    },
  };
}

export function isCustomSectionId(id) {
  return CUSTOM_SECTION_IDS.includes(id);
}

export function getCreatedCustomSectionIds(config) {
  return CUSTOM_SECTION_IDS.filter(id => config?.sections?.[id]?.created === true);
}

export function normalizeSectionOrder(config, requestedOrder = config?.layout?.sectionOrder) {
  const customIds = getCreatedCustomSectionIds(config);
  const validIds = new Set([...BUILT_IN_IDS, ...customIds]);
  const normalized = [];

  if (Array.isArray(requestedOrder)) {
    requestedOrder.forEach((id) => {
      if (validIds.has(id) && !normalized.includes(id)) normalized.push(id);
    });
  }

  [...BUILT_IN_IDS, ...customIds].forEach((id) => {
    if (!normalized.includes(id)) normalized.push(id);
  });

  return normalized;
}

export function getSiteSection(config, id) {
  if (isCustomSectionId(id)) {
    const data = config?.sections?.[id];
    if (!data?.created) return null;
    return {
      id,
      label: data.navLabel?.trim() || 'אזור אישי',
      editorLabel: data.navLabel?.trim() || 'אזור אישי',
      enabled: data.enabled !== false,
      custom: true,
      data,
    };
  }

  const definition = BUILT_IN_BY_ID.get(id);
  if (!definition) return null;

  return {
    ...definition,
    enabled: config?.sections?.[id]?.enabled !== false,
    custom: false,
    data: config?.sections?.[id],
  };
}

export function getOrderedSiteSections(config) {
  return normalizeSectionOrder(config)
    .map(id => getSiteSection(config, id))
    .filter(Boolean);
}

export function withSectionOrder(config, requestedOrder) {
  const next = {
    ...config,
    layout: {
      ...(config?.layout || {}),
      sectionOrder: requestedOrder,
    },
  };

  return {
    ...next,
    layout: {
      ...next.layout,
      sectionOrder: normalizeSectionOrder(next, requestedOrder),
    },
  };
}

export function moveSiteSection(config, sourceId, targetId) {
  const order = normalizeSectionOrder(config);
  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return config;

  const nextOrder = [...order];
  const [moved] = nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, moved);
  return withSectionOrder(config, nextOrder);
}

export function stepSiteSection(config, id, delta) {
  const order = normalizeSectionOrder(config);
  const currentIndex = order.indexOf(id);
  const targetIndex = currentIndex + delta;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= order.length) return config;

  const nextOrder = [...order];
  [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
  return withSectionOrder(config, nextOrder);
}

export function setSiteSectionEnabled(config, id, enabled) {
  const current = config?.sections?.[id];
  if (!current || (isCustomSectionId(id) && !current.created)) return config;

  return {
    ...config,
    sections: {
      ...config.sections,
      [id]: {
        ...current,
        enabled,
      },
    },
  };
}

export function addCustomSection(config) {
  const id = CUSTOM_SECTION_IDS.find(slotId => config?.sections?.[slotId]?.created !== true);
  if (!id) return { config, id: null };

  const number = CUSTOM_SECTION_IDS.indexOf(id) + 1;
  const next = {
    ...config,
    sections: {
      ...config.sections,
      [id]: createCustomSection(id, number),
    },
  };

  return {
    id,
    config: withSectionOrder(next, [...normalizeSectionOrder(config), id]),
  };
}

export function removeCustomSection(config, id) {
  if (!isCustomSectionId(id) || !config?.sections?.[id]?.created) return config;

  const { [id]: _removed, ...remainingSections } = config.sections;
  const next = {
    ...config,
    sections: remainingSections,
  };

  return withSectionOrder(
    next,
    normalizeSectionOrder(config).filter(sectionId => sectionId !== id),
  );
}

export function updateCustomSection(config, id, patch) {
  if (!isCustomSectionId(id) || !config?.sections?.[id]?.created) return config;
  const current = config.sections[id];
  const nextPatch = typeof patch === 'function' ? patch(current) : patch;

  return {
    ...config,
    sections: {
      ...config.sections,
      [id]: {
        ...current,
        ...nextPatch,
        id,
        created: true,
      },
    },
  };
}

export function normalizeCustomPosition(position) {
  return {
    contentX: clamp(position?.contentX, -24, 24),
    contentY: clamp(position?.contentY, -24, 24),
    mediaX: clamp(position?.mediaX, -24, 24),
    mediaY: clamp(position?.mediaY, -24, 24),
  };
}

export function scrollSiteSectionIntoView(id) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const section = document.getElementById(id);
      if (!section || section.hidden || section.getClientRects().length === 0) return;
      const desktopOffset = window.matchMedia('(min-width: 1024px)').matches ? 74 : 16;
      window.scrollTo({
        top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - desktopOffset),
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    });
  });
}
