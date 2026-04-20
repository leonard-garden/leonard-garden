/** Build `<link rel="alternate" hreflang="…">` HTML without raw `<` in `.astro` frontmatter (esbuild can mis-tokenize). */

const esc = (s: string) => s.replace(/"/g, '&quot;');

export function alternateHreflangLinksHtml(
	items: Array<{ href: string; localeCode: string }>,
	xDefaultHref: string,
): string {
	const lt = '\u003c';
	const gt = '\u003e';
	const parts: string[] = [];
	for (const item of items) {
		parts.push(
			`${lt}link rel="alternate" href="${esc(item.href)}" hreflang="${esc(item.localeCode)}" /${gt}`,
		);
	}
	parts.push(
		`${lt}link rel="alternate" href="${esc(xDefaultHref)}" hreflang="x-default" /${gt}`,
	);
	return parts.join('');
}
