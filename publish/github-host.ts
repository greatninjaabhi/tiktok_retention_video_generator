/**
 * Hosts a finished video as a GitHub release asset, because Buffer takes video by public URL only.
 * Needs a public repo and GITHUB_TOKEN (fine-grained, this repo only, Contents: read and write).
 */
import type { Fetch } from './tiktok-api';

type Asset = { id: number; name: string; browser_download_url: string };
type Release = { upload_url: string; assets: Asset[] };

/** "owner/repo" from a GitHub remote URL (https or ssh). */
export function repoFromRemote(remote: string): string {
  const m = remote.trim().match(/github\.com[/:]([^/]+\/[^/]+?)(\.git)?$/);
  if (!m) throw new Error(`not a GitHub remote: ${remote}`);
  return m[1]!;
}

export async function hostOnGitHub(f: Fetch, token: string, repo: string, id: string, video: Uint8Array): Promise<string> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tiktok-retention-video-generator' };
  const api = `https://api.github.com/repos/${repo}`;
  const check = async (res: Response, doing: string) => {
    if (!res.ok) throw new Error(`GitHub answered ${res.status} while ${doing}: ${(await res.text()).slice(0, 200)}`);
    return res;
  };

  const tag = `video-${id}`;
  const found = await f(`${api}/releases/tags/${tag}`, { headers });
  let release: Release;
  if (found.status === 404) {
    const made = await f(`${api}/releases`, { method: 'POST', headers, body: JSON.stringify({ tag_name: tag, name: id, body: 'Hosted for Buffer to fetch.' }) });
    release = (await (await check(made, 'creating the release')).json()) as Release;
  } else {
    release = (await (await check(found, 'finding the release')).json()) as Release;
  }

  const name = 'video.mp4';
  const old = release.assets.find((a) => a.name === name);
  if (old) await check(await f(`${api}/releases/assets/${old.id}`, { method: 'DELETE', headers }), 'replacing the old video');
  const uploadUrl = `${release.upload_url.replace(/\{.*$/, '')}?name=${name}`;
  const up = await f(uploadUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'video/mp4' }, body: video as BodyInit });
  const asset = (await (await check(up, 'uploading the video')).json()) as Asset;
  return asset.browser_download_url;
}
