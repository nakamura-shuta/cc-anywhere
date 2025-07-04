import ngrok from "ngrok";
import * as qrcode from "qrcode-terminal";
import { logger } from "./logger";
import { config } from "../config";

export async function startNgrok(port: number): Promise<string | null> {
  try {
    // ngrok tunnel を開始
    const url = await ngrok.connect({
      addr: port,
      proto: "http",
    });

    logger.info("ngrok tunnel established", { url });

    // プロセス終了時にngrokを切断
    process.on("SIGINT", () => {
      void (async () => {
        await ngrok.disconnect();
        await ngrok.kill();
      })();
    });

    process.on("SIGTERM", () => {
      void (async () => {
        await ngrok.disconnect();
        await ngrok.kill();
      })();
    });

    return url;
  } catch (error) {
    logger.error("Failed to start ngrok", { error });
    return null;
  }
}

/* eslint-disable no-console */
export function displayAccessInfo(ngrokUrl: string): void {
  const apiKey = config.auth.apiKey;
  const showQRCode = process.env.SHOW_QR_CODE === "true";

  console.log("\n========================================");
  console.log("🌐 External Access Information");
  console.log("========================================");
  console.log(`\n📡 ngrok URL: ${ngrokUrl}`);
  console.log(`🔒 API Key: ${apiKey || "Not set (authentication disabled)"}`);

  if (apiKey) {
    const webUIUrl = `${ngrokUrl}/?apiKey=${apiKey}`;
    
    console.log("\n🌍 Web UI Access:");
    console.log(`   ${webUIUrl}`);

    console.log("\n📱 API Access:");
    console.log(`   curl -H "X-API-Key: ${apiKey}" ${ngrokUrl}/api/tasks`);
    
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
    console.log(`   ${ngrokUrl}/`);

    console.log("\n📱 API Access:");
    console.log(`   curl ${ngrokUrl}/api/tasks`);
    
    // QRコード表示
    if (showQRCode) {
      console.log("\n📱 Scan QR code with your phone:");
      console.log("");
      qrcode.generate(ngrokUrl, { small: true }, (qrcode) => {
        console.log(qrcode);
      });
    }
  }

  console.log("\n========================================\n");
}
/* eslint-enable no-console */
