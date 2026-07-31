# System Encyclopedia: SweetlightSelfie

> **Analysis Date:** 2026-04-07
> **Application:** SweetlightSelfie
> **Version:** 1.0.0
> **Path:** `C:\Users\Omer Shneor\דף דוגמא לצלמים\photographer-portfolio`

---

## 1. Architecture Discovery

### 1.1 Project Overview
A **React-based Single Page Application (SPA)** designed as a portfolio website for a wedding/event photographer. The application is built as a **static site generator** with a configuration-driven approach, allowing content customization through a single JSON file.

### 1.2 Directory Hierarchy

```
photographer-portfolio/
├── index.html                    # Entry point (RTL Hebrew layout)
├── package.json                  # Dependencies & scripts
├── vite.config.js                # Build config + dev upload middleware
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS processor config
│
├── public/                       # Static assets
│   ├── logo-clean.png            # Brand logo
│   ├── camera-icon.svg           # Favicon
│   └── portfolio-media/          # Generated media (WebP)
│       ├── hero/                 # Hero slideshow images (10 covers)
│       ├── about/                # About section portrait
│       ├── avatars/              # Testimonial reviewer avatars
│       └── gallery/              # Gallery images by category
│           ├── evening-weddings/ # 4 sessions (01-04)
│           ├── day-weddings/     # 4 sessions (01-04)
│           └── couples/          # 4 sessions (01-04)
│
├── scripts/
│   └── sync-gallery.mjs          # Media sync & image processing script
│
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Root component (section orchestrator)
    ├── index.css                 # Design tokens + global styles (1067 lines)
    │
    ├── data/
    │   └── config.json           # Central configuration (808 lines)
    │
    ├── theme/
    │   └── ThemeContext.jsx      # Light/Dark theme provider
    │
    ├── components/
    │   ├── Navigation.jsx        # Navigation router (top/side/hamburger)
    │   ├── TopNavbar.jsx         # Top-fixed navigation bar
    │   ├── SideNavbar.jsx        # Side-fixed navigation rail
    │   ├── HamburgerMenu.jsx     # Scroll-triggered logo badge (nav-free)
    │   ├── LayoutEngine.jsx      # Layout type router (grid/masonry/stories)
    │   ├── SoftReveal.jsx        # IntersectionObserver animation component
    │   └── Footer.jsx            # Site footer
    │
    ├── sections/
    │   ├── HeroSection.jsx       # Fullscreen hero with Ken Burns slideshow
    │   ├── AboutSection.jsx      # Photographer bio + stats
    │   ├── GallerySection.jsx    # Gallery with category filters
    │   ├── TestimonialsSection.jsx # Client reviews carousel
    │   ├── FAQSection.jsx        # Accordion-style FAQ
    │   └── ContactSection.jsx    # Contact form + social links
    │
    ├── layouts/
    │   ├── GridGallery.jsx       # Uniform grid layout
    │   ├── MasonryGallery.jsx    # Pinterest-style masonry layout
    │   ├── StoriesGallery.jsx    # Instagram-style story cards
    │   └── Lightbox.jsx          # Fullscreen image viewer with crossfade
    │
    └── editor/                   # CMS editing system (optional)
        ├── EditorContext.jsx     # localStorage-based state management
        ├── EditorToggle.jsx      # Edit mode toggle
        ├── EditorDrawer.jsx      # Editing panel drawer
        ├── ImageUpload.jsx       # File upload component
        ├── SectionGear.jsx       # Per-section edit button
        └── panels/
            ├── HeroPanel.jsx     # Hero section editor
            ├── AboutPanel.jsx    # About section editor
            └── StylePanel.jsx    # Theme/style editor
```

### 1.3 Core Module Relationships

```
main.jsx
  └── App.jsx
        ├── ThemeProvider (theme/ThemeContext.jsx)
        │     └── Manages light/dark theme + CSS variables
        │
        ├── Navigation (components/Navigation.jsx)
        │     ├── TopNavbar
        │     ├── SideNavbar
        │     └── HamburgerMenu
        │
        ├── HeroSection (sections/HeroSection.jsx)
        │     └── Ken Burns slideshow with 10 images
        │
        ├── AboutSection (sections/AboutSection.jsx)
        │
        ├── GallerySection (sections/GallerySection.jsx)
        │     └── LayoutEngine (components/LayoutEngine.jsx)
        │           ├── GridGallery
        │           ├── MasonryGallery (react-masonry-css)
        │           └── StoriesGallery
        │                 └── Lightbox (layouts/Lightbox.jsx)
        │
        ├── FAQSection (sections/FAQSection.jsx)
        ├── TestimonialsSection (sections/TestimonialsSection.jsx)
        ├── ContactSection (sections/ContactSection.jsx)
        └── Footer (components/Footer.jsx)
```

---

## 2. Logic Mapping

### 2.1 Data Flow Architecture

```
config.json (static) ──────────────────────────────────────┐
                                                            │
sync-gallery.mjs ──► config.json ──► App.jsx ───────────────┼──► All Sections
     │                                                       │
     │ (reads from ../omershneor/)                          │
     │ (processes with sharp)                               │
     └──────────────────────────────────────────────────────┘
```

### 2.2 Primary Algorithms

#### Hero Slideshow ([`HeroSection.jsx`](photographer-portfolio/src/sections/HeroSection.jsx:1))
- **Auto-advance:** 5.5 second intervals
- **Transition:** 1.2s crossfade opacity
- **Ken Burns effect:** CSS `scale(1)` → `scale(1.08)` over 10s
- **Image positions:** Per-image `objectPosition` mapping for optimal framing
- **Fallback:** Uses gallery cover images if no hero images defined

#### Lightbox Viewer ([`Lightbox.jsx`](photographer-portfolio/src/layouts/Lightbox.jsx:1))
- **Crossfade animation:** 900ms fade-out overlay for outgoing images
- **Auto-play mode:** 4 second intervals (toggleable with spacebar)
- **Keyboard navigation:** Arrow keys, Escape, Space
- **Safe area support:** iOS notch handling with `env(safe-area-inset-*)`

#### Soft Reveal Animations ([`SoftReveal.jsx`](photographer-portfolio/src/components/SoftReveal.jsx:1))
- **IntersectionObserver-based:** Triggers on viewport entry
- **Variants:** `rise`, `soft-open`, `drift-left`, `drift-right`, `card`, `gallery-item`, `image-rise`
- **Configurable:** threshold, rootMargin, delay, once (animate once vs. repeat)

#### Gallery Filtering ([`GallerySection.jsx`](photographer-portfolio/src/sections/GallerySection.jsx:1))
- **Category tabs:** "הכל" (All) + dynamic categories from config
- **Layout adaptation:** 3 columns for "All", 2 columns for specific category
- **Max width:** 1367px (all) vs 910px (specific)

### 2.3 Business Logic

- **Photographer:** עומר שניאור (Omer Shneor)
- **Target market:** Israeli wedding/event photography
- **Gallery categories:** חתונות ערב (Evening Weddings), חתונות צהריים (Day Weddings), צילומי זוגיות (Couples Photography)
- **Contact methods:** Email, Instagram, WhatsApp (with pre-filled message)

---

## 3. Dependency Audit

### 3.1 Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | DOM rendering |
| `react-masonry-css` | ^1.0.16 | Masonry grid layout |

### 3.2 Build/Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.0.8 | Build tool + dev server |
| `@vitejs/plugin-react` | ^4.2.1 | React HMR support |
| `tailwindcss` | ^3.4.0 | Utility-first CSS |
| `postcss` | ^8.4.32 | CSS processing |
| `autoprefixer` | ^10.4.16 | Vendor prefixing |
| `sharp` | ^0.34.5 | Image processing (sync script) |
| `busboy` | ^1.6.0 | File upload parsing (dev middleware) |

### 3.3 External Services & APIs

| Service | Usage |
|---------|-------|
| Google Fonts | Typography: Bellefair, Great Vibes, Heebo, Cormorant Garamond, Frank Ruhl Libre |
| WhatsApp API | `wa.me` links with pre-filled messages |
| Mailto Protocol | Email contact link |
| Instagram | Social media link |

### 3.4 Hardware/External Integrations

- **None** - Pure web application with no hardware integrations

---

## 4. UI/UX Logic

### 4.1 Layout System

- **Current layout:** `stories` (Instagram-style grid)
- **Navigation:** `hamburger` (scroll-triggered logo badge, no menu)
- **RTL support:** Full right-to-left layout for Hebrew
- **Responsive breakpoints:** Desktop (default), Tablet (1024px), Mobile (640px)

### 4.2 Design Tokens

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--color-primary` | #1C1C1C | #ffffff |
| `--color-accent` | #C9A96E (gold) | #e8a838 (amber) |
| `--color-accent-secondary` | #B8967E (warm brown) | #d4619c (pink) |
| `--color-background` | #FAFAF8 (warm white) | #0d0d1a (deep navy) |
| `--color-surface` | #F4F1EC (cream) | #16162a (dark navy) |
| `--color-text` | #1C1C1C | #f0f0f5 |
| `--color-text-muted` | #8A8680 | #9a9ab0 |

### 4.3 Typography

| Element | Font | Weight |
|---------|------|--------|
| Headings | Bellefair (serif) | 400 |
| Hero Title | Great Vibes (cursive) | 400 |
| Body Text | Heebo (sans-serif) | 300 |

### 4.4 Frontend-Backend Interaction

- **No backend:** Fully static/client-side application
- **Dev upload middleware:** `/api/upload` endpoint in `vite.config.js` for CMS image uploads (dev only)
- **localStorage:** Used by EditorContext for persisting config changes during editing mode

### 4.5 Component Interaction Flow

```
User scrolls page
  └── IntersectionObserver (SoftReveal) triggers animations
  └── Scroll listener (HamburgerMenu) shows logo badge

User clicks gallery item
  └── Lightbox opens with crossfade animation
  └── Auto-play starts (4s intervals)
  └── Keyboard/arrow navigation available

User clicks category filter
  └── GallerySection filters items
  └── LayoutEngine switches layout density

User submits contact form
  └── Client-side validation
  └── Success message (4s timeout)
  └── Note: No actual submission backend
```

---

## 5. State Management

### 5.1 Application State

| State | Location | Storage | Purpose |
|-------|----------|---------|---------|
| Theme mode | ThemeContext | React state | Light/dark toggle |
| Hero slide index | HeroSection | React useState | Slideshow position |
| Active gallery category | GallerySection | React useState | Filter selection |
| Lightbox state | Lightbox/Masonry/Stories | React useState | Open/closed, current image |
| Form data | ContactSection | React useState | Contact form fields |
| Scroll position | HamburgerMenu | React useState | Logo badge visibility |
| Editor config | EditorContext | localStorage | CMS editing state |
| FAQ accordion | FAQSection | React useState | Expanded/collapsed items |

### 5.2 Session Data Handling

- **No server-side sessions:** All state is client-side React state
- **Persistence:** Only editor config persists via `localStorage` (key: `cms-config`)
- **No cookies/auth:** No user authentication system
- **No analytics:** No tracking or analytics integration

### 5.3 Data Configuration

The entire application content is driven by [`config.json`](photographer-portfolio/src/data/config.json:1):

```json
{
  "photographer": { /* Contact info, social links */ },
  "theme": { /* Colors, typography */ },
  "layout": { /* Navigation type, gallery type */ },
  "sections": { /* Per-section enable/disable + content */ },
  "galleryItems": [ /* Array of gallery sessions */ ],
  "categories": [ /* Filter tab labels */ ]
}
```

---

## 6. Media Processing Pipeline

### 6.1 Sync Script ([`sync-gallery.mjs`](photographer-portfolio/scripts/sync-gallery.mjs:1))

**Source:** `../omershneor/` folder (sibling directory)

**Process:**
1. Reads source images from category folders (חתונות ערב, חתונות צהריים, צילומי זוגיות)
2. Processes with `sharp`:
   - Auto-rotation based on EXIF
   - Cover images: max 1600px, quality 82
   - Gallery images: max 2200px, quality 80
   - Hero covers: max 3200px, quality 88
   - About portrait: max 1800px, quality 84
   - Avatar squares: 280x280, quality 78
3. Outputs as WebP to `public/portfolio-media/`
4. Updates `config.json` with new gallery items and image paths

### 6.2 Image Organization

```
Source: ../omershneor/
  ├── חתונות ערב/
  │   ├── אפק ומיקה/
  │   ├── טל וגיל/
  │   └── ...
  ├── חתונות צהריים/
  ├── צילומי זוגיות/
  ├── תמונות לקאבר/        (hero slideshow)
  └── תמונה לעל עצמי/      (about portrait)

Output: public/portfolio-media/
  ├── gallery/
  │   ├── evening-weddings/01/cover.webp
  │   ├── evening-weddings/01/images/001.webp
  │   └── ...
  ├── hero/cover-01.webp ... cover-10.webp
  ├── about/about.webp
  └── avatars/review-01.webp ...
```

---

## 7. CMS/Editor System (Optional)

### 7.1 Architecture

The application includes an **optional in-browser CMS** for editing content:

- **EditorProvider:** Wraps app with editing context
- **localStorage persistence:** Config saved to browser storage
- **Deep-set utility:** `deepSet(obj, 'a.b.c', value)` for nested updates
- **Panel system:** Separate editors for Hero, About, and Style settings
- **Reset capability:** Revert to default config.json

### 7.2 Upload Endpoint

Dev-only middleware in `vite.config.js`:
- **Endpoint:** `POST /api/upload`
- **Storage:** `public/uploads/`
- **Response:** `{ paths: ["/uploads/filename.ext"] }`
- **Note:** Only available during `vite dev`, not in production build

---

## 8. Build & Deployment

### 8.1 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 3000, auto-open) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run sync:media` | Run gallery sync script |

### 8.2 Dev Server

- **Port:** 3000
- **Host:** 0.0.0.0 (network accessible)
- **Auto-open:** Browser opens on start
- **HMR:** React Fast Refresh enabled

---

## 9. Accessibility & Internationalization

### 9.1 RTL Support

- **HTML:** `<html lang="he" dir="rtl">`
- **CSS:** `direction: rtl` on body
- **SoftReveal:** `transform-origin: right center` for soft-open variant
- **Gallery overlay:** Text aligned for RTL reading

### 9.2 Accessibility Features

- **ARIA labels:** Navigation buttons, lightbox controls
- **Keyboard navigation:** Lightbox (arrows, escape, space)
- **Safe area insets:** iOS notch support in lightbox
- **Loading states:** Lazy loading for images
- **Error handling:** Fallback for logo image load failure

---

## 10. Summary Statistics

| Metric | Count |
|--------|-------|
| Total source files (src/) | ~25 |
| CSS lines (index.css) | 1,067 |
| Config lines (config.json) | 808 |
| Gallery sessions | 12 (4 per category × 3 categories) |
| Hero slideshow images | 10 |
| Testimonial reviews | 3 |
| FAQ questions | 5 |
| Gallery images (estimated) | 400+ |

---

## 11. File Integrity Confirmation

**No files were modified, created, or deleted during this analysis.**

This document was created as a new file (`SYSTEM_ENCYCLOPEDIA.md`) in the project directory for reference purposes. All analysis was performed through read-only operations on existing source files.

---

*End of System Encyclopedia*
