# Bloub Portfolio Redesign

## Goal

Redesign Suhan Sung's static portfolio into a professional, character-led experience without replacing its existing HTML, CSS, and JavaScript stack. Preserve the current bilingual content and the user's uncommitted PilloSuffer award updates, while making recent work easier to scan and the photo gallery faster to load.

The page's single job is to help a recruiter, collaborator, or fellow builder understand Suhan's focus, strongest recent work, and personality within a few minutes.

## Visual Direction: Dusty Interaction Lab

The site will feel like a carefully used robotics and AI lab notebook: warm gray paper, graphite typography, sparse ruled details, and one vivid red character. It will avoid the current generic dark gradient, glass cards, and scattered glow effects.

### Design tokens

- Dust paper: `#D7D4CB`
- Paper highlight: `#E7E4DC`
- Graphite: `#191A17`
- Soft graphite: `#5F605A`
- Bloub rouge: `#EF463D`
- Deep rouge: `#A72E2A`
- Rule: `rgba(25, 26, 23, 0.18)`

Typography will use a characterful grotesque display face for Latin headings, a Korean-capable sans for body copy, and a restrained monospace face for project state, dates, and small interface labels. Fonts must remain legible when remote font loading fails.

### Layout

The navigation becomes a compact fixed lab index rather than a row of icon pills. The hero uses an asymmetric two-column composition: identity and current focus on the left, one large interactive Bloub on the right. Subsequent sections use strong horizontal rules, generous whitespace, and fewer but more informative cards.

```text
+-----------------------------------------------------------+
| SS/26        About  Work  Field Notes  Contact       KO/EN |
|-----------------------------------------------------------|
| AI systems built for the physical world.  |               |
| Suhan Sung                                 |    BLOUB      |
| Short introduction + current focus         |   follows     |
| [Explore selected work]                    |   pointer     |
|-----------------------------------------------------------|
| Selected work: recent / awarded / research                 |
+-----------------------------------------------------------+
```

The signature element is the rouge Bloub: it introduces the site, tracks attention, and reacts to selected work. All other decoration stays quiet so the character remains memorable rather than childish.

## Bloub Interaction System

The attached `bloub-squircle-excite-rouge.gif` will be copied into the project as a user-provided visual asset. The interactive hero character will be reconstructed locally with semantic HTML and CSS/SVG so its pupils can respond independently without adding Vue or an animation library.

- On initial load, a short full-screen scene shows the supplied GIF and resolves into the hero character.
- The intro must not block content for more than about 1.2 seconds and is skipped after the first view in the same session.
- On fine-pointer devices, both pupils follow the pointer within clamped eye sockets.
- When a project card receives hover or keyboard focus, the character looks toward the card.
- Blinks are infrequent and irregular. The body has only a subtle breathing deformation.
- On touch devices, gaze drifts gently rather than following touch.
- With `prefers-reduced-motion: reduce`, the loader becomes a brief static fade and gaze/body animation is disabled.
- Interaction code must not intercept pointer events or make portfolio content dependent on animation.

The implementation is inspired by the behavior described by the Bloub project but will not copy its Vue architecture. The portfolio remains framework-free.

## Information Architecture

The page keeps six destinations but simplifies their presentation:

1. Hero: name, current focus, short introduction, primary contact action.
2. About: concise biography, education, and verified accomplishments.
3. Capabilities: grouped AI/vision, physical computing, and product-building skills.
4. Selected work: primary project narrative and project archive.
5. Field notes: optimized gallery and the existing two videos.
6. Contact: direct email and social links with a reduced form.

Korean remains the default. English continues to use the existing language switch and local preference.

## Project Update

Projects will be ordered by current relevance and evidence rather than by the order in which cards were added.

### Featured projects

- **Brave Tylenol — Latest / 2026:** Lunit L2 plus selective medical RAG for a multi-turn health assistant. Show the Conquer Health hackathon context, OpenAI-compatible API contract, HealthBench development score of 49.80, and 16/16 concurrent integration result. The copy must explicitly avoid implying an award or medical-device status.
- **PilloSuffer — Awarded / 2026:** preserve the user's current uncommitted Excellence and Encouragement award content. Emphasize the OCR, privacy masking, evidence-first RAG flow, and accessible three-level safety result.
- **Mask R-CNN Reproduction — Research / 2026:** present the ResNet-50-FPN paper reproduction, 44.3M parameter implementation, full pretrained tensor mapping, and 98% reference detection agreement. Mark the lung X-ray dataset and final mAP loop as ongoing rather than complete.
- **Code Buddy — Built / 2026:** update the summary to include multi-provider AI, role-specialized desktop pets, collaboration mode, permission feedback, and macOS delivery.

### Archive projects

The drone tourism system, Eyes-Road, Pill Good, and Signature MK1 remain available in a compact archive. Awards, source links, demos, and completion labels remain intact. Older work is visually quieter so it does not compete with the latest evidence.

Every visible state label must reflect evidence already present in the local content or public repository. Repository timestamps alone will not be presented as project completion dates.

## Gallery Performance

The gallery currently serves 15 local originals from GitHub Pages. It does not use the GitHub API. The originals total roughly 1.7MB and range from 900 to 1200 pixels wide, so a separate CDN is unnecessary at the current scale.

### Selected approach: local responsive derivatives

- Keep originals in `Img/` for the lightbox and archival quality.
- Generate WebP thumbnails at approximately 480 and 800 pixels wide in `Img/gallery/`.
- Use `<picture>` or responsive `srcset`/`sizes` so phones receive the smaller asset.
- Keep `loading="lazy"` and add explicit `width`, `height`, and `decoding="async"` to prevent layout shifts and reduce main-thread work.
- Load the original only when the lightbox opens; do not preload all originals.
- Give the first visible gallery row a slightly higher fetch priority only when it approaches the viewport.
- Preserve next/previous keyboard navigation and add meaningful alt text where the image subject can be determined.
- Add a repeatable local optimization script or documented command so future photos follow the same pipeline.

If the gallery later grows to hundreds of images or is updated outside Git, migrate the same markup to an image CDN such as Cloudflare Images. Introducing a CDN now would add upload workflow and vendor configuration without a meaningful benefit.

## Implementation Boundaries

- Continue using static `index.html`, `style.css`, and `script.js`.
- Add only local assets and small, dependency-free helper scripts required for gallery generation.
- Preserve the user's existing uncommitted changes in `index.html` and `style.css`.
- Avoid a framework migration, CMS, database, or runtime image service.
- Remote icon and font dependencies may remain initially, but the page must retain usable fallbacks.
- JavaScript enhancements must fail safely: all content and links remain available when JavaScript is disabled.

## Accessibility and Responsive Behavior

- Maintain visible keyboard focus on navigation, project cards, language controls, gallery items, and lightbox controls.
- Use buttons for interactive gallery items and provide labels that describe their action.
- Lock focus inside the lightbox while open and restore it to the triggering thumbnail on close.
- Preserve sufficient text and control contrast on the dusty background.
- Mobile layout becomes single-column; the character is smaller and does not push the primary introduction below the first viewport.
- The mobile menu reports its expanded state with `aria-expanded`.
- Motion preferences are honored across loader, reveal, gaze, hover, and smooth-scroll behavior.

## Failure Handling

- If the supplied GIF fails to load, the static CSS/SVG character is shown immediately.
- If a responsive thumbnail is absent, the original image remains a valid fallback.
- If remote fonts or icons fail, system fonts and text labels keep navigation understandable.
- If local storage is unavailable, Korean is used and the loader may replay without breaking the page.

## Verification

- Validate all internal anchors, external project links, language switching, mobile navigation, contact behavior, videos, and lightbox interactions.
- Check desktop and mobile layouts at representative narrow, tablet, and wide viewport sizes.
- Verify keyboard-only operation and reduced-motion behavior.
- Confirm that no gallery original downloads before its lightbox is opened, except when directly required as a fallback.
- Compare initial transferred image bytes before and after optimization.
- Run an automated markup/script sanity check and inspect final screenshots for spacing, hierarchy, overflow, and visual consistency.

## Success Criteria

- The portfolio has a distinctive but professional Bloub-led identity.
- The latest projects and their evidence are understandable without opening GitHub.
- The character adds one coherent interactive moment without obscuring content.
- Mobile gallery loading transfers appropriately sized thumbnails rather than all full-size originals.
- Existing bilingual content, awards, media, and user edits remain intact.
