import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEditor } from '../EditorContext';
import {
  MAX_CUSTOM_SECTIONS,
  addCustomSection,
  getCreatedCustomSectionIds,
  getOrderedSiteSections,
  isCustomSectionId,
  moveSiteSection,
  removeCustomSection,
  scrollSiteSectionIntoView,
  setSiteSectionEnabled,
  stepSiteSection,
} from '../../utils/siteSections';

export default function StructurePanel() {
  const {
    config,
    replaceConfig,
    activePanel,
    openPanel,
    scrollToSection,
  } = useEditor();
  const [draggedId, setDraggedId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const sections = getOrderedSiteSections(config);
  const customCount = getCreatedCustomSectionIds(config).length;

  const focusSection = (id) => {
    openPanel(id);
    scrollToSection(id);
    if (isCustomSectionId(id)) scrollSiteSectionIntoView(id);
  };

  const toggleSection = (section) => {
    const nextEnabled = !section.enabled;
    replaceConfig(current => setSiteSectionEnabled(current, section.id, nextEnabled));
    if (nextEnabled) {
      window.requestAnimationFrame(() => {
        scrollToSection(section.id);
        if (section.custom) scrollSiteSectionIntoView(section.id);
      });
    }
  };

  const moveBy = (id, delta) => {
    replaceConfig(current => stepSiteSection(current, id, delta));
    window.requestAnimationFrame(() => scrollSiteSectionIntoView(id));
  };

  const handleDrop = (targetId) => {
    if (draggedId && draggedId !== targetId) {
      replaceConfig(current => moveSiteSection(current, draggedId, targetId));
      window.requestAnimationFrame(() => scrollSiteSectionIntoView(draggedId));
    }
    setDraggedId(null);
    setDropTargetId(null);
  };

  const handleAdd = () => {
    let createdId = null;
    replaceConfig(current => {
      const result = addCustomSection(current);
      createdId = result.id;
      return result.config;
    });

    if (createdId) {
      window.requestAnimationFrame(() => focusSection(createdId));
    }
  };

  const handleDelete = (section) => {
    const approved = window.confirm(`למחוק את „${section.label}”? אפשר יהיה לבטל את המחיקה באמצעות Undo.`);
    if (!approved) return;
    replaceConfig(current => removeCustomSection(current, section.id));
    if (activePanel === section.id) openPanel('structure');
  };

  return (
    <div className="structure-panel">
      <section className="structure-panel-intro" aria-labelledby="site-structure-heading">
        <span className="structure-panel-kicker">מבנה האתר</span>
        <h3 id="site-structure-heading">העמודים, בדיוק בסדר שנוח לך</h3>
        <p>
          גררו אזור בעזרת הידית כדי לשנות את מיקומו. במובייל או עם המקלדת אפשר להשתמש בחיצים.
          כל שינוי מופיע מיד באתר.
        </p>
      </section>

      <ol className="structure-section-list" aria-label="סדר אזורי האתר">
        {sections.map((section, index) => (
          <li
            key={section.id}
            className={[
              'structure-section-row',
              draggedId === section.id ? 'is-dragging' : '',
              dropTargetId === section.id ? 'is-drop-target' : '',
              section.enabled ? '' : 'is-hidden',
            ].filter(Boolean).join(' ')}
            draggable
            onDragStart={(event) => {
              setDraggedId(section.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', section.id);
            }}
            onDragEnter={() => setDropTargetId(section.id)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(section.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropTargetId(null);
            }}
          >
            <span className="structure-drag-handle" aria-hidden="true" title="גרירה לשינוי הסדר">
              <GripVertical size={19} />
            </span>

            <button
              type="button"
              className="structure-section-main"
              onClick={() => focusSection(section.id)}
              aria-label={`עריכת ${section.label}`}
            >
              <span className="structure-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="structure-section-copy">
                <strong>{section.label}</strong>
                <small>{section.custom ? 'אזור אישי' : (section.enabled ? 'מוצג באתר' : 'מוסתר מהאתר')}</small>
              </span>
              <Pencil size={16} aria-hidden="true" />
            </button>

            <div className="structure-section-actions" aria-label={`פעולות עבור ${section.label}`}>
              <button
                type="button"
                onClick={() => moveBy(section.id, -1)}
                disabled={index === 0}
                aria-label={`העברת ${section.label} למעלה`}
                title="למעלה"
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                onClick={() => moveBy(section.id, 1)}
                disabled={index === sections.length - 1}
                aria-label={`העברת ${section.label} למטה`}
                title="למטה"
              >
                <ArrowDown size={17} />
              </button>
              <button
                type="button"
                className={section.enabled ? 'is-visible' : ''}
                onClick={() => toggleSection(section)}
                role="switch"
                aria-checked={section.enabled}
                aria-label={section.enabled ? `הסתרת ${section.label}` : `הצגת ${section.label}`}
                title={section.enabled ? 'הסתרה מהאתר' : 'הצגה באתר'}
              >
                {section.enabled ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              {section.custom && (
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => handleDelete(section)}
                  aria-label={`מחיקת ${section.label}`}
                  title="מחיקת האזור"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="structure-add-section">
        <button
          type="button"
          onClick={handleAdd}
          disabled={customCount >= MAX_CUSTOM_SECTIONS}
        >
          <Plus size={18} />
          הוספת אזור אישי
        </button>
        <small>
          {customCount >= MAX_CUSTOM_SECTIONS
            ? 'נוספו שלושת האזורים האישיים האפשריים.'
            : `אפשר להוסיף עוד ${MAX_CUSTOM_SECTIONS - customCount} אזורים אישיים.`}
        </small>
      </div>
    </div>
  );
}
