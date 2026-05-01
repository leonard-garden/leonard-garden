/** Google Fonts CSS URL kept out of `.astro` markup so `..` in `wght@0,400..800` does not break the parser. Name avoids `href` substring — esbuild can misparse `href={…}` when the identifier ends with `href`. */
export const fontStylesheetUrl =
	'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap';

export const siteConfig = {
	name: 'Learning Hub',
	description:
		'Bilingual (VI/EN) notes and deep dives on AI tools, backend engineering, Kafka, and banking systems.',
	baseUrl: 'https://leonard.garden',
	languages: ['vi', 'en'] as const,
	/** Default locale for redirects and `x-default` hreflang. Renamed from `defaultLang` — esbuild mis-parses `<html lang>` in the same file when `defaultLang` appears in expressions. */
	primaryLocale: 'vi' as const,
	social: {
		github: 'https://github.com/your-handle',
	},
	analytics: {
		ga4MeasurementId: 'G-XXXXXXXXXX',
	},
};

