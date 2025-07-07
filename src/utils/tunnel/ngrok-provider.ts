import ngrok from "ngrok";
import { logger } from "../logger";
import type { TunnelProvider } from "./types";

export class NgrokTunnelProvider implements TunnelProvider {
  private tunnelUrl: string | null = null;

  async start(port: number): Promise<string | null> {
    try {
      // ngrok tunnel を開始
      this.tunnelUrl = await ngrok.connect({
        addr: port,
        proto: "http",
      });

      logger.info("ngrok tunnel established", { url: this.tunnelUrl });
      return this.tunnelUrl;
    } catch (error) {
      logger.error("Failed to start ngrok", { error });
      return null;
    }
  }

  async stop(): Promise<void> {
    try {
      await ngrok.disconnect();
      await ngrok.kill();
      this.tunnelUrl = null;
      logger.info("ngrok tunnel stopped");
    } catch (error) {
      logger.error("Failed to stop ngrok", { error });
    }
  }

  getUrl(): string | null {
    return this.tunnelUrl;
  }
}

// プロセス終了時のクリーンアップ
const provider = new NgrokTunnelProvider();

process.on("SIGINT", () => {
  void provider.stop();
});

process.on("SIGTERM", () => {
  void provider.stop();
});

export const ngrokTunnelProvider = provider;
