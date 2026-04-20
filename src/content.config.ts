import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const locale = z.enum(['vi', 'en']);
const pillar = z.enum(['ai', 'backend', 'kafka', 'banking', 'other']);

const shared = z.object({
	title: z.string(),
	description: z.string(),
	locale,
	translationKey: z.string(),
	publishedAt: z.coerce.date(),
	updatedAt: z.coerce.date().optional(),
	draft: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	pillar,
	canonicalUrl: z.string().url().optional(),
});

const articles = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
	schema: shared.extend({
		type: z.literal('article'),
		readingTimeMinutes: z.number().int().positive().optional(),
	}),
});

const notes = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
	schema: shared.extend({
		type: z.literal('note'),
		indexable: z.boolean().optional(),
	}),
});

const pillars = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/pillars' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pillar,
		locale,
	}),
});

export const collections = { articles, notes, pillars };

