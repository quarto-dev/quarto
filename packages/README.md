## `@quarto/_*` vs. `@quarto/*`

You might have noticed the presence of repeated packages like @quarto/mapped-string and @quarto/_mapped-string in this repo.
Why do they exist?

### Resolving packages from different projects

The packages in `package/_*` (that is, with a leading _) are copies of their namesakes that lack underscores.
They exist to allow code reuse among bundlers that don't agree in how to resolve modules.

The files in `packages/_*/src/*.ts` will be identical to those in `packages/*/src/*.ts`, _except_ for the `imports.ts` file.
This `imports.ts` file centralizes all the import syntax that must differ between the two package versions.

Ideally, we would keep the common files across the two packages as symbolic links of each other.
Unfortunately, symbolic links apparently trigger a compilation bug in `vite build` (which we use in apps/vscode-editor) where files end up being resolved from the wrong location.
As a result, we are forced to maintain explicit copies that need to be in sync with each other.

### packages/_*

These packages are private, have no build steps and are "pure typescript".

### packages/*

The packages without underscore will have more typical package.json setups, and can be published directly to npm.

## Other solutions

Ideally we wouldn't need anything like this horrendous hack.

We first experienced a problem trying to import a library like mapped-string from both inside apps/vscode-editor and from a typical npm library that uses mapped-string (like annotated-json).

It is clearly possible to have a single library that can resolve correctly in these settings.
Concrete examples are `ansi-colors` and `markdown-it`.
We could learn how to make this technique work in our monorepo, but I believe that these libraries end "overbundling" some of their npm exports by running a bundler and pushing the bundled JS.
I would like to avoid this problem because it causes a large degree of bloat in the resulting JS.

Conclusion: we need to study the problem more.
