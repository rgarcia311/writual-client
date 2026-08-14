/**
 * Ambient typing for WebSpatial's `enable-xr` attribute.
 *
 * The JSX runtime is `@webspatial/react-sdk` (see tsconfig's `jsxImportSource`), whose custom
 * runtime intercepts any element carrying `enable-xr` and turns it into a spatial region on
 * WebSpatial runtimes (visionOS, PICO OS 6). On flat browsers the attribute is inert.
 *
 * The SDK only declares `'enable-xr'` on its own 3D containers (`Model`, `SpatializedContainer`,
 * …), not on ordinary HTML or MUI elements — the existing usages across the app compile purely
 * by loose inference, so a typo like `enable-xr={0}` or `enablexr` would pass silently. This
 * augmentation makes the attribute a real, checked prop everywhere it is actually used:
 *
 *   - directly on DOM/MUI elements — `<Paper enable-xr />`
 *   - through MUI portal slot props — `PaperProps={{ 'enable-xr': true }}` — since `PaperProps`
 *     and friends extend `React.HTMLAttributes`.
 *
 * Note the two spellings are not interchangeable: JSX allows the bare attribute form
 * (`enable-xr`) only on intrinsic elements, so object-literal slot props must quote the key.
 */

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    'enable-xr'?: boolean;
  }

  interface SVGAttributes<T> {
    'enable-xr'?: boolean;
  }
}
