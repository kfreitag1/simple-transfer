// macOS packages are directories that Finder shows as one file. The app presents them the same way
import type { IconName } from "./ui/Icon.tsx";

/** Every package extension the app recognises, with the icon for its kind */
const PACKAGES: Record<string, IconName> = {
  // Apps and bundle-shaped code
  app: "app-window",
  appex: "app-window",
  bundle: "package",
  framework: "code-brackets",
  plugin: "package",
  kext: "package",
  prefpane: "package",
  qlgenerator: "package",
  mdimporter: "package",
  saver: "package",
  scptd: "package",
  workflow: "package",
  // Xcode and developer packages
  xcarchive: "code-brackets",
  xcodeproj: "code-brackets",
  xcworkspace: "code-brackets",
  xcresult: "code-brackets",
  playground: "code-brackets",
  xcdatamodeld: "code-brackets",
  xcmappingmodel: "code-brackets",
  doccarchive: "code-brackets",
  dsym: "code-brackets",
  // Document, media and VM packages
  sparsebundle: "box-iso",
  rtfd: "empty-page",
  photoslibrary: "media-image",
  photolibrary: "media-image",
  aplibrary: "media-image",
  imovielibrary: "media-video",
  musiclibrary: "music-note",
  tvlibrary: "media-video",
  theater: "media-video",
  fcpbundle: "media-video",
  fcpproject: "media-video",
  logicx: "music-note",
  band: "music-note",
  garageband: "music-note",
  motiontemplate: "media-video",
  pvm: "box-iso",
  vmwarevm: "box-iso",
  utm: "box-iso",
  scnpackage: "package",
  rcproject: "package",
  sketch: "media-image",
  key: "empty-page",
  pages: "empty-page",
  numbers: "empty-page",
  // Installers and plugin bundles
  pkg: "package",
  mpkg: "package",
  component: "music-note",
  vst: "music-note",
  vst3: "music-note",
  aaxplugin: "music-note",
  driver: "computer",
  dext: "computer",
  systemextension: "computer",
};

/** The icon of a package's kind, or undefined when `name` is not a package. Case-insensitive; `.app` alone is no package */
export function packageIcon(name: string): IconName | undefined {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? PACKAGES[name.slice(dot + 1).toLowerCase()] : undefined;
}

const isPackageName = (name: string) => packageIcon(name) !== undefined;

/** The package a `.zip` of one archives, as in `Alcove.app.zip` */
function packageArchiveName(name: string): string | undefined {
  const base = name.replace(/\.zip$/i, "");
  return base !== name && isPackageName(base) ? base : undefined;
}

/** A file's name as shown: its basename, or for a zipped package the package it archives */
export function displayName(path: string): string {
  const name = path.split("/").at(-1)!;
  return packageArchiveName(name) ?? name;
}

/**
 * The outermost package directory in a file path, if any. Only directory segments count, so a
 * literal file named `foo.app` is still a file; nested packages collapse into their outer package
 */
export function packageRootOf(path: string): string | undefined {
  const segments = path.split("/");
  const index = segments.slice(0, -1).findIndex(isPackageName);
  return index === -1 ? undefined : segments.slice(0, index + 1).join("/");
}

/** Files as the user sees them: a package is one file, however many paths it contains */
export const displayFileCount = (files: readonly { path: string }[]): number =>
  new Set(files.map((file) => packageRootOf(file.path) ?? file.path)).size;
