import * as qrcode from "qrcode-terminal";
import { logger } from "../logger";
import { config } from "../../config";
import { NgrokTunnelProvider } from "./ngrok-provider";
import { CloudflareTunnelProvider } from "./cloudflare";
import { QRFileManager } from "./qr-file-manager";
import type { TunnelProvider, TunnelInfo } from "./types";

class TunnelManager {
  private provider: TunnelProvider | null = null;
  private currentUrl: string | null = null;

  async start(port: number): Promise<TunnelInfo | null> {
    if (!config.tunnel.enabled) {
      logger.info("Tunnel is disabled");
      return null;
    }

    switch (config.tunnel.type) {
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
      this.displayAccessInfo(url, config.tunnel.type);
      return { url, type: config.tunnel.type };
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
    const qrEnabled = config.qrAuth.enabled;

    console.log("\n========================================");
    console.log(`🌐 External Access Information (${tunnelType})`);
    console.log("========================================");
    console.log(`\n📡 ${tunnelType === "cloudflare" ? "Cloudflare" : "ngrok"} URL: ${tunnelUrl}`);
    console.log(`🔒 API Key: ${apiKey || "Not set (authentication disabled)"}`);

    if (qrEnabled && showQRCode) {
      console.log(`📱 QR Code Display: Enabled`);
    }

    // URLに認証トークンを付与
    let webUIUrl = tunnelUrl;
    if (apiKey) {
      webUIUrl = `${tunnelUrl}/?api_key=${apiKey}`;
    }

    if (apiKey) {
      console.log("\n🌍 Web UI Access:");
      console.log(`   ${webUIUrl}`);

      console.log("\n📱 API Access:");
      console.log(`   curl -H "X-API-Key: ${apiKey}" ${tunnelUrl}/api/tasks`);

      // QRコード表示
      if (showQRCode) {
        console.log("\n📱 Scan QR code with your phone:");
        console.log("");
        qrcode.generate(webUIUrl, { small: true }, (qrcode) => {
          // 改行を追加してPM2のタイムスタンプとQRコードを分離
          console.log("\n" + qrcode);
        });

        // QRコードをファイルに保存
        QRFileManager.saveQRCode(webUIUrl).catch((err) => {
          logger.error("Failed to save QR code:", err);
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
          // 改行を追加してPM2のタイムスタンプとQRコードを分離
          console.log("\n" + qrcode);
        });

        // QRコードをファイルに保存
        QRFileManager.saveQRCode(tunnelUrl).catch((err) => {
          logger.error("Failed to save QR code:", err);
        });
      }
    }

    console.log("\n========================================\n");

    // アクセス情報をファイルに保存
    QRFileManager.saveAccessInfo({
      url: tunnelUrl,
      type: tunnelType,
      apiKey,
      webUIUrl,
      qrEnabled,
      timestamp: new Date(),
    });
  }
  /* eslint-enable no-console */
}

export const tunnelManager = new TunnelManager();
