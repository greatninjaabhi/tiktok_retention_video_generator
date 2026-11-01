/** Licensed stock photos for the top panel (brief §1.7). */
export type ProviderId = 'pexels' | 'pixabay' | 'wikimedia' | 'openverse' | 'local';

export type StockCandidate = {
  /** Globally unique: `<provider>:<id>`. */
  id: string;
  provider: ProviderId;
  pageUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  creator: string;
  license: string;
  licenseUrl: string;
  attributionRequired: boolean;
  /** Free text used for the AI-content filter (tags, alt text, title). */
  text: string;
};

export interface StockProvider {
  id: ProviderId;
  /** False when the provider needs an API key that isn't set. */
  available(): boolean;
  search(query: string, perPage: number): Promise<StockCandidate[]>;
}
