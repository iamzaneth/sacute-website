import { readFile, writeFile } from 'node:fs/promises';

// Embed the original avatar so the standalone icon needs no external resources.
// SVG clipping keeps the original pixels and makes all four corners transparent.
const directory = new URL('../public/branding/profile/', import.meta.url);
const avatar = await readFile(new URL('avatar.jpg', directory));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><clipPath id="avatar-circle"><circle cx="100" cy="100" r="100"/></clipPath></defs><image width="200" height="200" clip-path="url(#avatar-circle)" href="data:image/jpeg;base64,${avatar.toString('base64')}"/></svg>\n`;
await writeFile(new URL('favicon.svg', directory), svg);
console.log('Circular favicon prepared from the current avatar.');
