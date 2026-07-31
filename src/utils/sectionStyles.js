import { getTextTemplateById } from '../theme/designOptions';

export function getSectionBackground(token = 'background') {
  const safeToken = typeof token === 'string' ? token.trim() : 'background';
  return `var(--color-${safeToken || 'background'})`;
}

function resolveThemeTypography(config) {
  const template = getTextTemplateById(config?.theme?.textTemplateId);
  return {
    headingFamily: config?.theme?.headingFamily || template.headingFamily,
    bodyFamily: config?.theme?.bodyFamily || template.bodyFamily,
    heroTitleFamily: config?.theme?.heroTitleFamily || template.heroTitleFamily || template.headingFamily,
  };
}

export function getSectionTypography(config, sectionKey) {
  const themeTypography = resolveThemeTypography(config);
  const typography = config?.sections?.[sectionKey]?.typography || {};

  return {
    headingFamily: typography.headingFamily || themeTypography.headingFamily,
    bodyFamily: typography.bodyFamily || themeTypography.bodyFamily,
    accentFamily: typography.accentFamily || typography.bodyFamily || themeTypography.bodyFamily,
    heroTitleFamily: typography.titleFontFamily || typography.headingFamily || themeTypography.heroTitleFamily,
    nameFamily: typography.nameFamily || typography.bodyFamily || themeTypography.bodyFamily,
  };
}
