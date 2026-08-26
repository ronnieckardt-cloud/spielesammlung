// Minimale Ambient-Deklarationen für die Handvoll Node-Kernfunktionen, die
// vite.config.ts zum Bauzeitpunkt braucht — statt einer zusätzlichen
// Abhängigkeit (`@types/node`) nur für ein paar Zeilen Verzeichnis-Auflistung.
// Nur diese Datei ohne eigene `import`/`export` zählt für TypeScript als
// global — ein `declare module` in vite.config.ts selbst (das hat eigene
// Imports, ist also selbst ein Modul) würde als Erweiterung eines
// *vorhandenen* Moduls gelesen, nicht als neue Deklaration.

declare module 'node:fs' {
  export function readdirSync(pfad: string): string[];
  export function statSync(pfad: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...teile: string[]): string;
  export function relative(von: string, nach: string): string;
  export const sep: string;
}
