=== Flavor Block Visibility ===
Contributors: wpspacenerd
Donate link: https://www.spacenerd.space/
Tags: gutenberg, responsive, visibility, columns, mobile
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 2.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Hide any block on Mobile, Tablet or Desktop, and set a different Columns order per device. Lightweight, CSS-first, native editor UI.

== Description ==

Flavor Block Visibility adds two responsive tools to the block editor — without page builders, extra blocks or a build step.

= Responsive visibility =

Every block gets three toggles in its **Advanced** panel: **Hide on Desktop**, **Hide on Tablet** and **Hide on Mobile**. Hiding is done with CSS media queries — no JavaScript.

= Responsive column order =

The core **Columns** block gets a **Responsive Column Order** panel. Give each device its own order — for example, show the image above the text on mobile and next to it on desktop. Reorder by drag and drop or with the arrow buttons, or use Reverse and Reset.

The order is applied with CSS, so it is correct from the first paint. An optional tiny script also reorders the HTML, so keyboard navigation and screen readers follow what visitors see.

= Features =

* Works with every core and third-party block
* Controls live in the native block settings — no extra sidebars
* Editor preview: blocks hidden on the current device are dimmed, and columns show the order of the current device preview
* Hovering a column in the order list highlights it on the canvas
* Column order follows columns when they are added, removed or moved
* Customizable breakpoints in **Settings → Block Visibility**
* CSS and scripts load only on pages that need them
* No build step, no external requests
* Clean uninstall — removes all plugin data

= Default Breakpoints =

* Mobile: 0 – 767px
* Tablet: 768px – 1024px
* Desktop: 1025px and above

Breakpoints can be customized in **Settings → Block Visibility**.

== Installation ==

1. Upload the `flavor-block-visibility` folder to `/wp-content/plugins/`
2. Activate through the **Plugins** menu in WordPress
3. Select any block → open the **Advanced** panel in the sidebar → use the toggles
4. Optionally adjust breakpoints in **Settings → Block Visibility**

== Frequently Asked Questions ==

= Does this work with third-party blocks? =

Yes. The plugin adds responsive controls to every registered Gutenberg block, including blocks from other plugins and themes.

= How does the hiding work? =

The plugin uses CSS media queries with `display: none !important`. No JavaScript is used for hiding. The CSS is only loaded on pages where at least one block uses a visibility toggle.

= How does the column order work? =

Select a Columns block and open **Responsive Column Order** in the block settings. Pick a device tab and reorder the columns. The order is applied with CSS `order` inside media queries, so it is correct immediately on page load.

By default, a tiny script (loaded only on pages that use a custom column order) then moves the column elements in the HTML, so keyboard navigation and screen readers follow the same order as what is shown. You can disable this in **Settings → Block Visibility**. In browsers without `moveBefore()` support, columns that contain iframes or videos keep the CSS-only order, so embeds are not reloaded.

= Does a column keep its width when moved? =

Yes. Order changes the position, not the width, so each column takes its width with it.

= Can I customize the breakpoints? =

Yes. Go to **Settings → Block Visibility** to change the pixel values for mobile, tablet, and desktop breakpoints.

= Will this affect SEO? =

CSS-based responsive hiding is a standard web practice. Search engines understand media queries and do not penalize content that is responsively hidden.

= Does it work with Full Site Editing (FSE)? =

Yes. The plugin supports both classic themes and block themes with Full Site Editing.

== Screenshots ==

1. Hide any block on Desktop, Tablet or Mobile with the Responsive Conditions toggles in the block settings.
2. Settings page: breakpoints for each device and the accessible DOM order option.
3. Responsive Column Order panel for the Columns block: a separate order for each device, with drag and drop, Reverse and Reset.

== Changelog ==

= 2.0.0 =
* New: Responsive Column Order panel for the core Columns block — different column order for Mobile, Tablet and Desktop.
* New: reorder by drag and drop or with arrow buttons; Reverse and Reset per device.
* New: the editor canvas shows the column order of the current device preview; hovering a column in the list highlights it.
* New: stored order follows columns when they are added, removed or moved.
* New: optional accessible DOM order (Settings → Block Visibility), enabled by default.
* New: refreshed settings page design — breakpoints grouped by device. Same settings and saving as before.
* Improved: block themes now load the CSS only on pages that use it.
* Improved: the editor reads the preview device from core/editor (WP 6.5+), avoiding deprecated selectors.
* Fix: editor indicators no longer wrap blocks in an extra element, which broke Columns widths in the editor.
* Requires WordPress 6.2 or later.

= 1.1.0 =
* Editor: blocks hidden on the current preview device now display a grey overlay with a label — so it's clear they won't appear on that device.
* Editor: blocks with any hide rule show a thin blue outline and a small badge on other devices — visual confirmation the plugin is active.
* Removed the old dashed outline in favour of the new per-device-aware indicators.


= 1.0.0 =
* Initial release.
* Hide on Desktop, Tablet, and Mobile toggles for all Gutenberg blocks.
* Customizable breakpoints via Settings page.
* Conditional CSS loading — styles only load when needed.
* Visual editor indicators for hidden blocks.

== Upgrade Notice ==

= 2.0.0 =
Major update: per-device column order for the Columns block, redesigned settings page. Existing visibility settings keep working. Requires WordPress 6.2+.

= 1.0.0 =
Initial release.
