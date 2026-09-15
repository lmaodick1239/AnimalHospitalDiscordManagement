export function layout(opts: { title: string; body: string; extraHead?: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title><link rel="stylesheet" href="/static/app.css">${opts.extraHead ?? ""}</head><body>${opts.body}</body></html>`;
}

export function esc(value: string): string {
  return value.replace(/[&<>\u0022']/g, (character) => ({
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    "\u0022": "\u0026quot;",
    "'": "\u0026#39;",
  })[character] ?? character);
}
