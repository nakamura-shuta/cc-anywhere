import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { logger } from "../logger";
import { config } from "../../config";
import type { TunnelProvider } from "./types";

export class CloudflareTunnelProvider implements TunnelProvider {
  private tunnelUrl: string | null = null;
  private process: ChildProcess | null = null;

  async start(port: number): Promise<string | null> {
    try {
      if (config.cloudflare.token) {
        // トークンを使った既存トンネルの実行
        return this.startWithToken(port);
      } else {
        // 新規トンネルの作成（cloudflared loginが必要）
        return this.startQuickTunnel(port);
      }
    } catch (error) {
      logger.error("Failed to start Cloudflare tunnel", { error });
      return null;
    }
  }

  private async startWithToken(_port: number): Promise<string | null> {
    return new Promise((resolve) => {
      const args = ["tunnel", "--no-autoupdate", "run", "--token", config.cloudflare.token!];

      this.process = spawn("cloudflared", args, {
        env: { ...process.env },
      });

      let resolved = false;
      let tunnelRegistered = false;

      // トークンモードでは、固定のURLを使用するため、
      // トンネルが登録されたことを確認して、カスタムURLを返す
      const checkTunnelRegistered = () => {
        if (tunnelRegistered && !resolved) {
          resolved = true;
          // 環境変数でカスタムURLを設定できるようにする
          const customUrl = process.env.CLOUDFLARE_TUNNEL_URL;
          if (customUrl) {
            this.tunnelUrl = customUrl;
            logger.info("Cloudflare tunnel with custom URL", { url: this.tunnelUrl });
          } else {
            logger.info(
              "Cloudflare tunnel registered (using token mode - URL configured in Cloudflare dashboard)",
            );
          }
          resolve(this.tunnelUrl);
        }
      };

      this.process.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        logger.debug("Cloudflare tunnel output", { output });
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const error = data.toString();
        // stderrはエラーではなく情報メッセージも含まれる
        logger.debug("Cloudflare tunnel output", { output: error });

        // トンネルが登録されたことを確認
        if (
          error.includes("Registered tunnel connection") ||
          error.includes("Connection registered")
        ) {
          tunnelRegistered = true;
          checkTunnelRegistered();
        }
      });

      this.process.on("error", (error) => {
        logger.error("Failed to start cloudflared process", { error });
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      // タイムアウト設定
      setTimeout(() => {
        if (!resolved) {
          if (tunnelRegistered) {
            checkTunnelRegistered();
          } else {
            logger.warn(
              "Cloudflare tunnel startup timeout - tunnel may be working but URL not detected",
            );
            resolved = true;
            resolve(null);
          }
        }
      }, 30000); // 30秒のタイムアウト
    });
  }

  private async startQuickTunnel(port: number): Promise<string | null> {
    return new Promise((resolve) => {
      const args = ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`];

      this.process = spawn("cloudflared", args, {
        env: { ...process.env },
      });

      let resolved = false;

      this.process.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        // stderrはcloudflaredのメイン出力チャンネル
        logger.debug("Cloudflare quick tunnel output", { output });

        // Quick tunnelのURLを抽出
        const urlMatch = output.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
        if (urlMatch && !resolved) {
          this.tunnelUrl = urlMatch[0];
          resolved = true;
          logger.info("Cloudflare quick tunnel established", { url: this.tunnelUrl });
          resolve(this.tunnelUrl);
        }
      });

      this.process.on("error", (error) => {
        logger.error("Failed to start cloudflared process", { error });
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      this.process.on("exit", (code) => {
        logger.info("Cloudflare tunnel process exited", { code });
      });

      // タイムアウト設定
      setTimeout(() => {
        if (!resolved) {
          logger.error("Cloudflare tunnel startup timeout");
          resolved = true;
          resolve(null);
        }
      }, 30000); // 30秒のタイムアウト
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.tunnelUrl = null;
      logger.info("Cloudflare tunnel stopped");
    }
  }

  getUrl(): string | null {
    return this.tunnelUrl;
  }
}

// プロセス終了時のクリーンアップ
const provider = new CloudflareTunnelProvider();

process.on("SIGINT", () => {
  void provider.stop();
});

process.on("SIGTERM", () => {
  void provider.stop();
});

export const cloudflareTunnelProvider = provider;
