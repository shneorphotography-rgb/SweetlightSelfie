import { ThemeProvider } from './theme/ThemeContext';
import Navigation from './components/Navigation';
import HeroSection from './sections/HeroSection';
import AboutSection from './sections/AboutSection';
import GallerySection from './sections/GallerySection';
import PricingSection from './sections/PricingSection';
import TestimonialsSection from './sections/TestimonialsSection';
import FAQSection from './sections/FAQSection';
import ContactSection from './sections/ContactSection';
import CustomSection from './sections/CustomSection';
import Footer from './components/Footer';

import { EditorProvider, useEditor } from './editor/EditorContext';
import EditorToggle from './editor/EditorToggle';
import EditorDrawer from './editor/EditorDrawer';
import SectionGear from './editor/SectionGear';
import { getClientShareToken, isClientView } from './utils/clientView';
import { getOrderedSiteSections } from './utils/siteSections';

function ClientViewStatus({ error = false }) {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        background: '#F5F7FB',
        color: '#1C1C1C',
        fontFamily: 'Heebo, sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ color: '#A8834A', fontFamily: 'Bellefair, serif', fontSize: '2rem' }}>
          {error ? 'הקישור אינו זמין כרגע' : 'טוענים את האתר…'}
        </div>
        <p style={{ margin: '0.5rem 0 0', color: '#777068' }}>
          {error ? 'אפשר לרענן את העמוד או לבקש מהצלם קישור חדש.' : 'עוד רגע התמונות יופיעו כאן'}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              minHeight: '42px',
              padding: '0 1.2rem',
              borderRadius: '21px',
              border: 'none',
              background: '#7C3AED',
              color: '#fff',
              fontFamily: 'Heebo, sans-serif',
              cursor: 'pointer',
            }}
          >
            רענון
          </button>
        )}
      </div>
    </div>
  );
}

function AppInner({ clientView }) {
  const {
    config,
    isEditing,
    activePanel,
    isShareLoading,
    shareError,
  } = useEditor();

  if (clientView && isShareLoading) return <ClientViewStatus />;
  if (clientView && shareError) return <ClientViewStatus error />;

  const orderedSections = getOrderedSiteSections(config);
  const navSections = orderedSections.map(({ id, label, enabled }) => ({ id, label, enabled }));

  const renderSection = (section) => {
    if (!section.enabled) return null;

    let content = null;
    switch (section.id) {
      case 'hero':
        content = <HeroSection config={config} />;
        break;
      case 'about':
        content = <AboutSection data={config.sections.about} config={config} />;
        break;
      case 'gallery':
        content = <GallerySection data={config.sections.gallery} config={config} />;
        break;
      case 'pricing':
        content = <PricingSection data={config.sections.pricing} config={config} />;
        break;
      case 'testimonials':
        content = <TestimonialsSection data={config.sections.testimonials} config={config} />;
        break;
      case 'faq':
        content = <FAQSection data={config.sections.faq} config={config} />;
        break;
      case 'contact':
        content = <ContactSection data={config.sections.contact} photographer={config.photographer} config={config} />;
        break;
      default:
        if (section.custom) {
          content = <CustomSection id={section.id} data={section.data} config={config} />;
        }
    }

    if (!content) return null;

    return (
      <div key={section.id} style={{ position: 'relative' }} data-site-section={section.id}>
        {content}
        <SectionGear
          sectionId={section.id}
          label={section.editorLabel || section.label}
          style={section.id === 'hero' ? { top: '1.5rem', left: '1.5rem' } : undefined}
        />
      </div>
    );
  };

  return (
    <ThemeProvider config={config}>
      <div
        className={[
          'min-h-screen',
          'editor-app-shell',
          isEditing && !clientView ? 'editor-studio-active' : '',
          activePanel && !clientView ? 'editor-inspector-open' : '',
        ].filter(Boolean).join(' ')}
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div className="editor-site-canvas">
          <div className="site-navigation-shell">
            <Navigation sections={navSections} navStyle={config.layout?.navigation} />
          </div>

          <main>
            {orderedSections.map(renderSection)}
          </main>

          <Footer photographer={config.photographer} />
        </div>

        {!clientView && (
          <>
            <EditorToggle />
            <EditorDrawer />
          </>
        )}
      </div>
    </ThemeProvider>
  );
}

export default function App() {
  const clientView = isClientView();

  return (
    <EditorProvider readOnly={clientView} shareToken={getClientShareToken()}>
      <AppInner clientView={clientView} />
    </EditorProvider>
  );
}
