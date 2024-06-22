export async function getFile(url: string): Promise<Buffer> {
  const resp = await fetch(new URL(url));
  if (!resp.ok) {
    console.error(await resp.text());
    throw new Error(`Failed to fetch file: ${url} ${resp.status} ${resp.statusText}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}
