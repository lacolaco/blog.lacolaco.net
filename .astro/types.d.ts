declare module 'astro:content' {
	interface Render {
		'.mdx': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
		}>;
	}
}

declare module 'astro:content' {
	interface Render {
		'.md': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
		}>;
	}
}

declare module 'astro:content' {
	export { z } from 'astro/zod';
	export type CollectionEntry<C extends keyof AnyEntryMap> = AnyEntryMap[C][keyof AnyEntryMap[C]];

	// TODO: Remove this when having this fallback is no longer relevant. 2.3? 3.0? - erika, 2023-04-04
	/**
	 * @deprecated
	 * `astro:content` no longer provide `image()`.
	 *
	 * Please use it through `schema`, like such:
	 * ```ts
	 * import { defineCollection, z } from "astro:content";
	 *
	 * defineCollection({
	 *   schema: ({ image }) =>
	 *     z.object({
	 *       image: image(),
	 *     }),
	 * });
	 * ```
	 */
	export const image: never;

	// This needs to be in sync with ImageMetadata
	export type ImageFunction = () => import('astro/zod').ZodObject<{
		src: import('astro/zod').ZodString;
		width: import('astro/zod').ZodNumber;
		height: import('astro/zod').ZodNumber;
		format: import('astro/zod').ZodUnion<
			[
				import('astro/zod').ZodLiteral<'png'>,
				import('astro/zod').ZodLiteral<'jpg'>,
				import('astro/zod').ZodLiteral<'jpeg'>,
				import('astro/zod').ZodLiteral<'tiff'>,
				import('astro/zod').ZodLiteral<'webp'>,
				import('astro/zod').ZodLiteral<'gif'>,
				import('astro/zod').ZodLiteral<'svg'>
			]
		>;
	}>;

	type BaseSchemaWithoutEffects =
		| import('astro/zod').AnyZodObject
		| import('astro/zod').ZodUnion<import('astro/zod').AnyZodObject[]>
		| import('astro/zod').ZodDiscriminatedUnion<string, import('astro/zod').AnyZodObject[]>
		| import('astro/zod').ZodIntersection<
				import('astro/zod').AnyZodObject,
				import('astro/zod').AnyZodObject
		  >;

	type BaseSchema =
		| BaseSchemaWithoutEffects
		| import('astro/zod').ZodEffects<BaseSchemaWithoutEffects>;

	export type SchemaContext = { image: ImageFunction };

	type DataCollectionConfig<S extends BaseSchema> = {
		type: 'data';
		schema?: S | ((context: SchemaContext) => S);
	};

	type ContentCollectionConfig<S extends BaseSchema> = {
		type?: 'content';
		schema?: S | ((context: SchemaContext) => S);
	};

	type CollectionConfig<S> = ContentCollectionConfig<S> | DataCollectionConfig<S>;

	export function defineCollection<S extends BaseSchema>(
		input: CollectionConfig<S>
	): CollectionConfig<S>;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {})
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {})
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {})
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {})
	>(
		collection: C,
		slug: E
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {})
	>(
		collection: C,
		id: E
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[]
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[]
	): Promise<CollectionEntry<C>[]>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
			  }
			: {
					collection: C;
					id: keyof DataEntryMap[C];
			  }
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"blog": {
"20-lines-simple-store-with-rxjs.mdx": {
	id: "20-lines-simple-store-with-rxjs.mdx";
  slug: "20-lines-simple-store-with-rxjs";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"access-to-global-variables-in-angular-2.mdx": {
	id: "access-to-global-variables-in-angular-2.mdx";
  slug: "access-to-global-variables-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-16-jest.mdx": {
	id: "angular-16-jest.mdx";
  slug: "angular-16-jest";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-2-how-detect-object-changes.mdx": {
	id: "angular-2-how-detect-object-changes.mdx";
  slug: "angular-2-how-detect-object-changes";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-app-reactiveness-en.mdx": {
	id: "angular-app-reactiveness-en.mdx";
  slug: "angular-app-reactiveness-en";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-atomic-design-and-ngmodule.mdx": {
	id: "angular-atomic-design-and-ngmodule.mdx";
  slug: "angular-atomic-design-and-ngmodule";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-basic-terms-change-detection.mdx": {
	id: "angular-basic-terms-change-detection.mdx";
  slug: "angular-basic-terms-change-detection";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-basic-ui-components.mdx": {
	id: "angular-basic-ui-components.mdx";
  slug: "angular-basic-ui-components";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-common-pattern-part-1.mdx": {
	id: "angular-common-pattern-part-1.mdx";
  slug: "angular-common-pattern-part-1";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-component-style-with-emotion.mdx": {
	id: "angular-component-style-with-emotion.mdx";
  slug: "angular-component-style-with-emotion";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-component-testing-declarations.mdx": {
	id: "angular-component-testing-declarations.mdx";
  slug: "angular-component-testing-declarations";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-component-visual-testing-with-cypress.mdx": {
	id: "angular-component-visual-testing-with-cypress.mdx";
  slug: "angular-component-visual-testing-with-cypress";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-content-projection-101.mdx": {
	id: "angular-content-projection-101.mdx";
  slug: "angular-content-projection-101";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-dynamic-importing-large-libraries.mdx": {
	id: "angular-dynamic-importing-large-libraries.mdx";
  slug: "angular-dynamic-importing-large-libraries";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-elements-composable-definition-pattern.mdx": {
	id: "angular-elements-composable-definition-pattern.mdx";
  slug: "angular-elements-composable-definition-pattern";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-eliminate-render-blocking-requests.mdx": {
	id: "angular-eliminate-render-blocking-requests.mdx";
  slug: "angular-eliminate-render-blocking-requests";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-flex-layout-flexbox-and-grid-layout-for-angular-component.mdx": {
	id: "angular-flex-layout-flexbox-and-grid-layout-for-angular-component.mdx";
  slug: "angular-flex-layout-flexbox-and-grid-layout-for-angular-component";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-host-directives-observer-directive.mdx": {
	id: "angular-host-directives-observer-directive.mdx";
  slug: "angular-host-directives-observer-directive";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-how-to-use-action-creator-introduced-in-ngrx-v7-4-ja.mdx": {
	id: "angular-how-to-use-action-creator-introduced-in-ngrx-v7-4-ja.mdx";
  slug: "angular-how-to-use-action-creator-introduced-in-ngrx-v7-4-ja";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-how-to-use-action-creator-introduced-in-ngrx-v7-4.mdx": {
	id: "angular-how-to-use-action-creator-introduced-in-ngrx-v7-4.mdx";
  slug: "angular-how-to-use-action-creator-introduced-in-ngrx-v7-4";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-http-with-axios.mdx": {
	id: "angular-http-with-axios.mdx";
  slug: "angular-http-with-axios";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-inputs-stream-pattern.mdx": {
	id: "angular-inputs-stream-pattern.mdx";
  slug: "angular-inputs-stream-pattern";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-ivy-experimental-note.mdx": {
	id: "angular-ivy-experimental-note.mdx";
  slug: "angular-ivy-experimental-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-ivy-library-compilation-design-in-depth-en.mdx": {
	id: "angular-ivy-library-compilation-design-in-depth-en.mdx";
  slug: "angular-ivy-library-compilation-design-in-depth-en";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-ivy-library-compilation-design-in-depth.mdx": {
	id: "angular-ivy-library-compilation-design-in-depth.mdx";
  slug: "angular-ivy-library-compilation-design-in-depth";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-jest-setup.mdx": {
	id: "angular-jest-setup.mdx";
  slug: "angular-jest-setup";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-learning-costs.mdx": {
	id: "angular-learning-costs.mdx";
  slug: "angular-learning-costs";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-lightweight-injection-token-overview.mdx": {
	id: "angular-lightweight-injection-token-overview.mdx";
  slug: "angular-lightweight-injection-token-overview";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-loading-with-cdk-portal.mdx": {
	id: "angular-loading-with-cdk-portal.mdx";
  slug: "angular-loading-with-cdk-portal";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-new-input-transforms.mdx": {
	id: "angular-new-input-transforms.mdx";
  slug: "angular-new-input-transforms";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-new-provide-router-api.mdx": {
	id: "angular-new-provide-router-api.mdx";
  slug: "angular-new-provide-router-api";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-ngif-composing-feature-toggle.mdx": {
	id: "angular-ngif-composing-feature-toggle.mdx";
  slug: "angular-ngif-composing-feature-toggle";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-ngmodule-and-directories.mdx": {
	id: "angular-ngmodule-and-directories.mdx";
  slug: "angular-ngmodule-and-directories";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-privider-function-pattern.mdx": {
	id: "angular-privider-function-pattern.mdx";
  slug: "angular-privider-function-pattern";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-property-binding-atttribute-binding.mdx": {
	id: "angular-property-binding-atttribute-binding.mdx";
  slug: "angular-property-binding-atttribute-binding";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-router-title-strategy.mdx": {
	id: "angular-router-title-strategy.mdx";
  slug: "angular-router-title-strategy";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-single-state-stream-pattern.mdx": {
	id: "angular-single-state-stream-pattern.mdx";
  slug: "angular-single-state-stream-pattern";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-state-management-patterns.mdx": {
	id: "angular-state-management-patterns.mdx";
  slug: "angular-state-management-patterns";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-state-of-linting-2020.mdx": {
	id: "angular-state-of-linting-2020.mdx";
  slug: "angular-state-of-linting-2020";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-strict-property-initialization-best-practice.mdx": {
	id: "angular-strict-property-initialization-best-practice.mdx";
  slug: "angular-strict-property-initialization-best-practice";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-tailwindcss-styling-thoughts.mdx": {
	id: "angular-tailwindcss-styling-thoughts.mdx";
  slug: "angular-tailwindcss-styling-thoughts";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-trusted-types.mdx": {
	id: "angular-trusted-types.mdx";
  slug: "angular-trusted-types";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-using-ngrx-with-redux-toolkit.mdx": {
	id: "angular-using-ngrx-with-redux-toolkit.mdx";
  slug: "angular-using-ngrx-with-redux-toolkit";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-v15-optin-browserslist.mdx": {
	id: "angular-v15-optin-browserslist.mdx";
  slug: "angular-v15-optin-browserslist";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-v6-tree-shakable-di.mdx": {
	id: "angular-v6-tree-shakable-di.mdx";
  slug: "angular-v6-tree-shakable-di";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular-zoneless-router-activation-en.mdx": {
	id: "angular-zoneless-router-activation-en.mdx";
  slug: "angular-zoneless-router-activation-en";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"angular2-view-encapsulation-fallback.mdx": {
	id: "angular2-view-encapsulation-fallback.mdx";
  slug: "angular2-view-encapsulation-fallback";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"aot-compilation-with-webpack.mdx": {
	id: "aot-compilation-with-webpack.mdx";
  slug: "aot-compilation-with-webpack";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"async-pipe-initial-null-problem-en.mdx": {
	id: "async-pipe-initial-null-problem-en.mdx";
  slug: "async-pipe-initial-null-problem-en";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"async-pipe-initial-null-problem.mdx": {
	id: "async-pipe-initial-null-problem.mdx";
  slug: "async-pipe-initial-null-problem";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"bloc-design-pattern-with-angular.mdx": {
	id: "bloc-design-pattern-with-angular.mdx";
  slug: "bloc-design-pattern-with-angular";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"change-blog-title-2023.mdx": {
	id: "change-blog-title-2023.mdx";
  slug: "change-blog-title-2023";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"custom-elements-event-target.mdx": {
	id: "custom-elements-event-target.mdx";
  slug: "custom-elements-event-target";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"deep-dive-angular-components-mat-divider.mdx": {
	id: "deep-dive-angular-components-mat-divider.mdx";
  slug: "deep-dive-angular-components-mat-divider";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"design-and-equilibration.mdx": {
	id: "design-and-equilibration.mdx";
  slug: "design-and-equilibration";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"differential-loading-a-new-feature-of-angular-cli-v8.mdx": {
	id: "differential-loading-a-new-feature-of-angular-cli-v8.mdx";
  slug: "differential-loading-a-new-feature-of-angular-cli-v8";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"dirty-checking-misunderstanding.mdx": {
	id: "dirty-checking-misunderstanding.mdx";
  slug: "dirty-checking-misunderstanding";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"enjoyable-webworkers-in-angular.ja.mdx": {
	id: "enjoyable-webworkers-in-angular.ja.mdx";
  slug: "enjoyable-webworkers-in-angularja";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"enjoyable-webworkers-in-angular.mdx": {
	id: "enjoyable-webworkers-in-angular.mdx";
  slug: "enjoyable-webworkers-in-angular";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"esmodule-export-import.mdx": {
	id: "esmodule-export-import.mdx";
  slug: "esmodule-export-import";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"event-broadcasting-in-angular-2.mdx": {
	id: "event-broadcasting-in-angular-2.mdx";
  slug: "event-broadcasting-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"firebase-hosting-production-staging-with-targets.mdx": {
	id: "firebase-hosting-production-staging-with-targets.mdx";
  slug: "firebase-hosting-production-staging-with-targets";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"for-sustainable-angular-development.mdx": {
	id: "for-sustainable-angular-development.mdx";
  slug: "for-sustainable-angular-development";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"forget-compile-in-angular-2.mdx": {
	id: "forget-compile-in-angular-2.mdx";
  slug: "forget-compile-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"github-actions-oidc-google-cloud.mdx": {
	id: "github-actions-oidc-google-cloud.mdx";
  slug: "github-actions-oidc-google-cloud";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"github-actions-setup-node-engines.mdx": {
	id: "github-actions-setup-node-engines.mdx";
  slug: "github-actions-setup-node-engines";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"github-actions-yarn-cache.mdx": {
	id: "github-actions-yarn-cache.mdx";
  slug: "github-actions-yarn-cache";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"graphql-and-restful-backend.mdx": {
	id: "graphql-and-restful-backend.mdx";
  slug: "graphql-and-restful-backend";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"graphql-schema-thought.mdx": {
	id: "graphql-schema-thought.mdx";
  slug: "graphql-schema-thought";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"how-to-trace-angular.mdx": {
	id: "how-to-trace-angular.mdx";
  slug: "how-to-trace-angular";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"how-to-try-angular-cli-with-bazel.mdx": {
	id: "how-to-try-angular-cli-with-bazel.mdx";
  slug: "how-to-try-angular-cli-with-bazel";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"how-to-use-angular-2-nightly-builds.mdx": {
	id: "how-to-use-angular-2-nightly-builds.mdx";
  slug: "how-to-use-angular-2-nightly-builds";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"initial.mdx": {
	id: "initial.mdx";
  slug: "initial";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"introduce-angular-cdk-dnd.mdx": {
	id: "introduce-angular-cdk-dnd.mdx";
  slug: "introduce-angular-cdk-dnd";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"introduce-router-scroller-in-angular-v6-1.mdx": {
	id: "introduce-router-scroller-in-angular-v6-1.mdx";
  slug: "introduce-router-scroller-in-angular-v6-1";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"introducing-contributors-img-keep-contributors-in-readme-md.mdx": {
	id: "introducing-contributors-img-keep-contributors-in-readme-md.mdx";
  slug: "introducing-contributors-img-keep-contributors-in-readme-md";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"io2023-angular-summary.mdx": {
	id: "io2023-angular-summary.mdx";
  slug: "io2023-angular-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"leaning-curve-and-angular-app-architecture.mdx": {
	id: "leaning-curve-and-angular-app-architecture.mdx";
  slug: "leaning-curve-and-angular-app-architecture";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"learn-ngrx.mdx": {
	id: "learn-ngrx.mdx";
  slug: "learn-ngrx";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"list-component-design.mdx": {
	id: "list-component-design.mdx";
  slug: "list-component-design";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"local-variables-and-exportas-of-angular-2.mdx": {
	id: "local-variables-and-exportas-of-angular-2.mdx";
  slug: "local-variables-and-exportas-of-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"managing-key-value-constants-in-typescript.mdx": {
	id: "managing-key-value-constants-in-typescript.mdx";
  slug: "managing-key-value-constants-in-typescript";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"merge-graphql-schemas.mdx": {
	id: "merge-graphql-schemas.mdx";
  slug: "merge-graphql-schemas";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"merging-objects-with-partial-type.mdx": {
	id: "merging-objects-with-partial-type.mdx";
  slug: "merging-objects-with-partial-type";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"migrate-angular-cli-from-1-7-to-6-0.mdx": {
	id: "migrate-angular-cli-from-1-7-to-6-0.mdx";
  slug: "migrate-angular-cli-from-1-7-to-6-0";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"migrate-circleci-to-github-actions.mdx": {
	id: "migrate-circleci-to-github-actions.mdx";
  slug: "migrate-circleci-to-github-actions";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"modular-graphql-schema-documentation.mdx": {
	id: "modular-graphql-schema-documentation.mdx";
  slug: "modular-graphql-schema-documentation";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"network-aware-preloading-strategy-for-angular-lazy-loading.mdx": {
	id: "network-aware-preloading-strategy-for-angular-lazy-loading.mdx";
  slug: "network-aware-preloading-strategy-for-angular-lazy-loading";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng-conf-2017-day-1-note.mdx": {
	id: "ng-conf-2017-day-1-note.mdx";
  slug: "ng-conf-2017-day-1-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng-conf-2017-day-3-note.mdx": {
	id: "ng-conf-2017-day-3-note.mdx";
  slug: "ng-conf-2017-day-3-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng4-feature-core-update.mdx": {
	id: "ng4-feature-core-update.mdx";
  slug: "ng4-feature-core-update";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng4-feature-forms-update.mdx": {
	id: "ng4-feature-forms-update.mdx";
  slug: "ng4-feature-forms-update";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng4-feature-libs-update.mdx": {
	id: "ng4-feature-libs-update.mdx";
  slug: "ng4-feature-libs-update";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng4-feature-meta-service.mdx": {
	id: "ng4-feature-meta-service.mdx";
  slug: "ng4-feature-meta-service";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ng4-feature-ngif.mdx": {
	id: "ng4-feature-ngif.mdx";
  slug: "ng4-feature-ngif";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ngconf2020-day1-note.mdx": {
	id: "ngconf2020-day1-note.mdx";
  slug: "ngconf2020-day1-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ngconf2020-day2-note.mdx": {
	id: "ngconf2020-day2-note.mdx";
  slug: "ngconf2020-day2-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"ngconf2020-day3-note.mdx": {
	id: "ngconf2020-day3-note.mdx";
  slug: "ngconf2020-day3-note";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"notion-headless-cms-1.mdx": {
	id: "notion-headless-cms-1.mdx";
  slug: "notion-headless-cms-1";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"notion-headless-cms-2.mdx": {
	id: "notion-headless-cms-2.mdx";
  slug: "notion-headless-cms-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"notion-headless-cms-3.mdx": {
	id: "notion-headless-cms-3.mdx";
  slug: "notion-headless-cms-3";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"npm-new-package-name-rules.mdx": {
	id: "npm-new-package-name-rules.mdx";
  slug: "npm-new-package-name-rules";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"nx-dockerize-angular-nest-app.mdx": {
	id: "nx-dockerize-angular-nest-app.mdx";
  slug: "nx-dockerize-angular-nest-app";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"perspective-of-angular-in-2020.mdx": {
	id: "perspective-of-angular-in-2020.mdx";
  slug: "perspective-of-angular-in-2020";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"platform-prividers-of-angular-2.mdx": {
	id: "platform-prividers-of-angular-2.mdx";
  slug: "platform-prividers-of-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"pre-order-jsprimer.mdx": {
	id: "pre-order-jsprimer.mdx";
  slug: "pre-order-jsprimer";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"presentation-angular-standalone-based-app.mdx": {
	id: "presentation-angular-standalone-based-app.mdx";
  slug: "presentation-angular-standalone-based-app";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"professional-and-expert.mdx": {
	id: "professional-and-expert.mdx";
  slug: "professional-and-expert";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"proposal-angular-partial-form-injection-pattern.mdx": {
	id: "proposal-angular-partial-form-injection-pattern.mdx";
  slug: "proposal-angular-partial-form-injection-pattern";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"read-ivy-design-doc-separate-compilation.mdx": {
	id: "read-ivy-design-doc-separate-compilation.mdx";
  slug: "read-ivy-design-doc-separate-compilation";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"renovate-config-for-angular-cli.mdx": {
	id: "renovate-config-for-angular-cli.mdx";
  slug: "renovate-config-for-angular-cli";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"rethink-template-driven-forms.mdx": {
	id: "rethink-template-driven-forms.mdx";
  slug: "rethink-template-driven-forms";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"rust-wasm-svg-rendering.mdx": {
	id: "rust-wasm-svg-rendering.mdx";
  slug: "rust-wasm-svg-rendering";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"rx-angular-component-state-management.mdx": {
	id: "rx-angular-component-state-management.mdx";
  slug: "rx-angular-component-state-management";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"rxjs-and-webworker.mdx": {
	id: "rxjs-and-webworker.mdx";
  slug: "rxjs-and-webworker";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"setting-up-angular-2-testing-environment-with-karma-and-webpack.mdx": {
	id: "setting-up-angular-2-testing-environment-with-karma-and-webpack.mdx";
  slug: "setting-up-angular-2-testing-environment-with-karma-and-webpack";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"state-management-library.mdx": {
	id: "state-management-library.mdx";
  slug: "state-management-library";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"state-of-angular-elements-2020-summer.mdx": {
	id: "state-of-angular-elements-2020-summer.mdx";
  slug: "state-of-angular-elements-2020-summer";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"system-design-and-philosophical-thinking.mdx": {
	id: "system-design-and-philosophical-thinking.mdx";
  slug: "system-design-and-philosophical-thinking";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"template-syntax-in-angular-2.mdx": {
	id: "template-syntax-in-angular-2.mdx";
  slug: "template-syntax-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"theory-of-state-01.mdx": {
	id: "theory-of-state-01.mdx";
  slug: "theory-of-state-01";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"translation-angular-2-change-detection-explained.mdx": {
	id: "translation-angular-2-change-detection-explained.mdx";
  slug: "translation-angular-2-change-detection-explained";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"translation-angular-2-component-styles.mdx": {
	id: "translation-angular-2-component-styles.mdx";
  slug: "translation-angular-2-component-styles";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"translation-crunchbase-and-angular-why-we-made-the-transition.mdx": {
	id: "translation-crunchbase-and-angular-why-we-made-the-transition.mdx";
  slug: "translation-crunchbase-and-angular-why-we-made-the-transition";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"translation-template-driven-form-in-angular-2.mdx": {
	id: "translation-template-driven-form-in-angular-2.mdx";
  slug: "translation-template-driven-form-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"translation-view-children-and-content-children-in-angular-2.mdx": {
	id: "translation-view-children-and-content-children-in-angular-2.mdx";
  slug: "translation-view-children-and-content-children-in-angular-2";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"trusted-types-and-angular-security.mdx": {
	id: "trusted-types-and-angular-security.mdx";
  slug: "trusted-types-and-angular-security";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"try-angular-2-aot-compilation.mdx": {
	id: "try-angular-2-aot-compilation.mdx";
  slug: "try-angular-2-aot-compilation";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"two-sides-of-tailwindcss.mdx": {
	id: "two-sides-of-tailwindcss.mdx";
  slug: "two-sides-of-tailwindcss";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"upgrading-angularjs-app-with-angular-elements.mdx": {
	id: "upgrading-angularjs-app-with-angular-elements.mdx";
  slug: "upgrading-angularjs-app-with-angular-elements";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"use-ionic-components-as-web-components-in-angular.mdx": {
	id: "use-ionic-components-as-web-components-in-angular.mdx";
  slug: "use-ionic-components-as-web-components-in-angular";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"webbundles-with-angular.mdx": {
	id: "webbundles-with-angular.mdx";
  slug: "webbundles-with-angular";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"webpack-esm-import-assertions.mdx": {
	id: "webpack-esm-import-assertions.mdx";
  slug: "webpack-esm-import-assertions";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"why-angular-has-not-static-site-generators.mdx": {
	id: "why-angular-has-not-static-site-generators.mdx";
  slug: "why-angular-has-not-static-site-generators";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"why-angularjs-needs-http-service.mdx": {
	id: "why-angularjs-needs-http-service.mdx";
  slug: "why-angularjs-needs-http-service";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"why-entrycomponents-will-be-deprecated.mdx": {
	id: "why-entrycomponents-will-be-deprecated.mdx";
  slug: "why-entrycomponents-will-be-deprecated";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"why-inject-function-wins.mdx": {
	id: "why-inject-function-wins.mdx";
  slug: "why-inject-function-wins";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"yapc-kyoto-2023.mdx": {
	id: "yapc-kyoto-2023.mdx";
  slug: "yapc-kyoto-2023";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	type ContentConfig = typeof import("../src/content/config");
}
