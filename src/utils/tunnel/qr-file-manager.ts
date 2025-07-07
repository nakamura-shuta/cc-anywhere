import * as fs from "fs";
import * as path from "path";
import * as qrcode from "qrcode-terminal";

export class QRFileManager {
  private static QR_FILE_PATH = path.join(process.cwd(), "data", "last-qr.txt");
  private static INFO_FILE_PATH = path.join(process.cwd(), "data", "last-access-info.json");

  static ensureDataDir(): void {
    const dataDir = path.dirname(this.QR_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  static saveQRCode(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ensureDataDir();
      
      qrcode.generate(url, { small: true }, (qrcode) => {
        try {
          fs.writeFileSync(this.QR_FILE_PATH, qrcode, "utf8");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  static saveAccessInfo(info: {
    url: string;
    type: string;
    apiKey?: string;
    webUIUrl?: string;
    timestamp: Date;
  }): void {
    this.ensureDataDir();
    fs.writeFileSync(this.INFO_FILE_PATH, JSON.stringify(info, null, 2), "utf8");
  }

  static readQRCode(): string | null {
    try {
      if (fs.existsSync(this.QR_FILE_PATH)) {
        return fs.readFileSync(this.QR_FILE_PATH, "utf8");
      }
    } catch (error) {
      console.error("Failed to read QR code:", error);
    }
    return null;
  }

  static readAccessInfo(): any | null {
    try {
      if (fs.existsSync(this.INFO_FILE_PATH)) {
        const content = fs.readFileSync(this.INFO_FILE_PATH, "utf8");
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("Failed to read access info:", error);
    }
    return null;
  }

  static cleanup(): void {
    try {
      if (fs.existsSync(this.QR_FILE_PATH)) {
        fs.unlinkSync(this.QR_FILE_PATH);
      }
      if (fs.existsSync(this.INFO_FILE_PATH)) {
        fs.unlinkSync(this.INFO_FILE_PATH);
      }
    } catch (error) {
      console.error("Failed to cleanup QR files:", error);
    }
  }
}