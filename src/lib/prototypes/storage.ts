import { put, del } from '@vercel/blob'

export const MAX_PROTOTYPE_BYTES = 15 * 1024 * 1024 // 15MB — prototypes often inline base64 assets

export function isHtmlFileName(name: string): boolean {
  return /\.html?$/i.test(name)
}

// Pathname is stable per prototype (prototypes/<slug>.html) and never changes after
// creation, so "replace file" is just put()'ing again to the same pathname.
export async function storePrototypeHtml(pathname: string, html: string) {
  return put(pathname, html, {
    access: 'private',
    contentType: 'text/html; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function deletePrototypeBlob(pathname: string): Promise<void> {
  await del(pathname)
}
