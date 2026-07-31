import { Pencil } from 'lucide-react';
import { useEditor } from './EditorContext';

export default function SectionGear({ sectionId, label, style: extraStyle }) {
  const { isEditing, activePanel, openPanel } = useEditor();
  if (!isEditing) return null;

  const active = activePanel === sectionId;

  return (
    <button
      type="button"
      className={`editor-section-edit-chip ${active ? 'is-active' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        openPanel(sectionId);
      }}
      aria-label={`עריכת ${label}`}
      aria-pressed={active}
      title={`עריכת ${label}`}
      style={extraStyle}
    >
      <Pencil size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>עריכת {label}</span>
    </button>
  );
}
