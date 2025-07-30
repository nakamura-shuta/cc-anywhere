// Tunnel provider interface
export interface TunnelProvider {
  start(port: number): Promise<string | null>;
  stop(): Promise<void>;
  getUrl(): string | null;
}

export interface TunnelInfo {
  url: string;
  type: "ngrok" | "cloudflare";
}
