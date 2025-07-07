import * as qrcode from "qrcode-terminal";
import { logger } from "../logger";
import { config } from "../../config";
import { NgrokTunnelProvider } from "./ngrok-provider";
import { CloudflareTunnelProvider } from "./cloudflare";
import type { TunnelProvider, TunnelInfo } from "./types";

class TunnelManager {
  private provider: TunnelProvider | null = null;
  private currentUrl: string | null = null;

  async start(port: number): Promise<TunnelInfo | null> {
    if (!config.tunnel.enabled) {
      logger.info("Tunnel is disabled");
      return null;
    }

    // 後方互換性：ENABLE_NGROK=trueの場合
    const tunnelType =
      config.ngrok.enabled && config.tunnel.type === "none" ? "ngrok" : config.tunnel.type;

    switch (tunnelType) {
      case "ngrok":
        this.provider = new NgrokTunnelProvider();
        break;
      case "cloudflare":
        this.provider = new CloudflareTunnelProvider();
        break;
      default:
        logger.info("No tunnel type configured");
        return null;
    }

    const url = await this.provider.start(port);
    if (url) {
      this.currentUrl = url;
      if (tunnelType === "ngrok" || tunnelType === "cloudflare") {
        this.displayAccessInfo(url, tunnelType);
        return { url, type: tunnelType };
      }
    }

    return null;
  }

  async stop(): Promise<void> {
    if (this.provider) {
      await this.provider.stop();
      this.provider = null;
      this.currentUrl = null;
    }
  }

  getUrl(): string | null {
    return this.currentUrl;
  }

  /* eslint-disable no-console */
  private displayAccessInfo(tunnelUrl: string, tunnelType: "ngrok" | "cloudflare"): void {
    const apiKey = config.auth.apiKey;
    const showQRCode = config.tunnel.showQRCode;

    console.log("\n========================================");
    console.log(`🌐 External Access Information (${tunnelType})`);
    console.log("========================================");
    console.log(`\n📡 ${tunnelType === "cloudflare" ? "Cloudflare" : "ngrok"} URL: ${tunnelUrl}`);
    console.log(`🔒 API Key: ${apiKey || "Not set (authentication disabled)"}`);

    if (apiKey) {
      const webUIUrl = `${tunnelUrl}/?apiKey=${apiKey}`;

      console.log("\n🌍 Web UI Access:");
      console.log(`   ${webUIUrl}`);

      console.log("\n📱 API Access:");
      console.log(`   curl -H "X-API-Key: ${apiKey}" ${tunnelUrl}/api/tasks`);

      // QRコード表示
      if (showQRCode) {
        console.log("\n📱 Scan QR code with your phone:");
        console.log("");
        qrcode.generate(webUIUrl, { small: true }, (qrcode) => {
          console.log(qrcode);
        });
      }
    } else {
      console.log("\n⚠️  Warning: API authentication is disabled!");
      console.log("   Set API_KEY in .env to enable authentication");

      console.log("\n🌍 Web UI Access:");
      console.log(`   ${tunnelUrl}/`);

      console.log("\n📱 API Access:");
      console.log(`   curl ${tunnelUrl}/api/tasks`);

      // QRコード表示
      if (showQRCode) {
        console.log("\n📱 Scan QR code with your phone:");
        console.log("");
        qrcode.generate(tunnelUrl, { small: true }, (qrcode) => {
          console.log(qrcode);
        });
      }
    }

    console.log("\n========================================\n");
  }
  /* eslint-enable no-console */
}

export const tunnelManager = new TunnelManager();
