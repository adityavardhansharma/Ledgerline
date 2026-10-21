/// <reference types="vite/client" />
// convex-test loads every Convex module (including _generated) through Vite's glob import.
export const modules = import.meta.glob("./**/*.*s");
