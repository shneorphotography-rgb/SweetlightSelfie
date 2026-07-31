import {
  Eye,
  LayoutGrid,
  Palette,
  Pencil,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import ClientShare from './ClientShare';
import SweetLightLogo from './SweetLightLogo';

export default function EditorToggle() {
  const {
    isEditing,
    activePanel,
    toggleEditing,
    openPanel,
    saveStatus = 'saved',
    canUndo = false,
    canRedo = false,
    undo = () => {},
    redo = () => {},
  } = useEditor();

  const beginEditing = () => {
    toggleEditing();
    window.requestAnimationFrame(() => openPanel('hero'));
  };

  if (!isEditing) {
    return (
      <div className="editor-launch-dock" data-editor-toggle dir="rtl">
        <ClientShare buttonClassName="editor-launch-secondary" pillStyle={{ boxShadow: 'none' }} />
        <button type="button" className="editor-launch-primary" onClick={beginEditing}>
          <Pencil size={18} strokeWidth={2} />
          <span>עריכת האתר</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="editor-studio-topbar" data-editor-toggle dir="rtl">
        <div className="editor-topbar-brand">
          <span className="editor-topbar-mark">
            <SweetLightLogo size={36} title="SweetLight" />
          </span>
          <div className="editor-topbar-brand-copy">
            <strong className="editor-wordmark" dir="ltr">
              SweetLight <span>Selfie</span>
            </strong>
            <span className="editor-save-status" aria-live="polite">
              <i className={saveStatus === 'saving' ? 'is-saving' : ''} />
              {saveStatus === 'saving' ? 'שומר שינויים…' : 'כל השינויים נשמרו'}
            </span>
          </div>
        </div>

        <div className="editor-topbar-history" role="group" aria-label="ביטול וביצוע מחדש">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="ביטול שינוי" title="ביטול">
            <Undo2 size={18} />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="ביצוע מחדש" title="ביצוע מחדש">
            <Redo2 size={18} />
          </button>
        </div>

        <div className="editor-topbar-actions">
          <button type="button" className="editor-topbar-button" onClick={() => openPanel('style')}>
            <Palette size={18} />
            <span>עיצוב כללי</span>
          </button>
          <ClientShare buttonClassName="editor-topbar-button editor-topbar-share" pillStyle={{ boxShadow: 'none' }} />
          <button type="button" className="editor-topbar-preview" onClick={toggleEditing}>
            <Eye size={18} />
            <span>תצוגה מקדימה</span>
          </button>
        </div>
      </header>

      <nav className="editor-mobile-toolbar" aria-label="כלי עריכת האתר" dir="rtl">
        <button
          type="button"
          className={activePanel && activePanel !== 'style' ? 'is-active' : ''}
          onClick={() => openPanel(activePanel && activePanel !== 'style' ? activePanel : 'hero')}
        >
          <LayoutGrid size={19} />
          <span>אזורים</span>
        </button>

        <button
          type="button"
          className={activePanel === 'style' ? 'is-active' : ''}
          onClick={() => openPanel('style')}
        >
          <Palette size={19} />
          <span>עיצוב</span>
        </button>

        <ClientShare buttonClassName="editor-mobile-toolbar-share" showLabel pillStyle={{ boxShadow: 'none' }} />

        <button type="button" onClick={toggleEditing}>
          <Eye size={19} />
          <span>תצוגה</span>
        </button>
      </nav>
    </>
  );
}
