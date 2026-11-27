import type { ProofOfErrorDocument } from "./proof.js";

export interface AlastorClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class AlastorClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AlastorClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://alastor.tech").replace(/\/+$/, "");
    const customFetch = options.fetchImpl;
    this.fetchImpl = customFetch ? (input, init) => customFetch(input, init) : (input, init) => fetch(input, init);
  }

  async exportProof(proofId: string): Promise<ProofOfErrorDocument> {
    if (!/^[0-9a-f-]{36}$/i.test(proofId)) {
      throw new Error("Invalid Proof UUID format");
    }
    const res = await this.fetchImpl(`${this.baseUrl}/api/proofs/${proofId}/export`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`ALASTOR Proof export failed with HTTP ${res.status}`);
    }
    return (await res.json()) as ProofOfErrorDocument;
  }
}
