/** Shared SEO HTML string builders. All functions return raw HTML safe to inject via Fragment set:html. */

/** Escape a string for use in an HTML attribute value. */
export const esc = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Build `<link rel="canonical">` HTML. */
export function buildCanonicalHtml(url: string): string {
	return `<link rel="canonical" href="${esc(url)}" />`;
}

/**
 * Build `<link rel="alternate" hreflang="…">` HTML for all locales plus x-default.
 * Items must use `localeCode` — the normalized field name across all pages.
 */
export function buildAlternateLinksHtml(
	items: Array<{ localeCode: string; href: string }>,
	xDefaultHref: string,
): string {
	const links = items.map(
		({ localeCode, href }) =>
			`<link rel="alternate" hreflang="${esc(localeCode)}" href="${esc(href)}" />`,
	);
	links.push(`<link rel="alternate" hreflang="x-default" href="${esc(xDefaultHref)}" />`);
	return links.join('');
}

/** Build Google Fonts preconnect + stylesheet link HTML. */
export function buildFontHeadHtml(stylesheetUrl: string): string {
	return [
		'<link rel="preconnect" href="https://fonts.googleapis.com" />',
		'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
		`<link rel="stylesheet" href="${esc(stylesheetUrl)}" />`,
	].join('');
}
