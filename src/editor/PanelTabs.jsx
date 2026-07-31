import { useId, useRef } from 'react';

export default function PanelTabs({
  tabs,
  value,
  onChange,
  ariaLabel = 'אפשרויות עריכה',
}) {
  const groupId = useId();
  const tabRefs = useRef([]);

  const focusTab = (index) => {
    if (!tabs.length) return;
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => {
      tabRefs.current[nextIndex]?.focus();
      tabRefs.current[nextIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="editor-panel-tabs"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`${groupId}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`editor-panel-tab ${isActive ? 'is-active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                aria-label={`${tab.badge} פריטים`}
                className="editor-panel-tab-badge"
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
