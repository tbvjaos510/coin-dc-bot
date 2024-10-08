import * as crypto from "crypto";

class AppIdGenerator {
  private static readonly DC_APP_SIGNATURE = "ReOo4u96nnv8Njd7707KpYiIVYQ3FlcKHDJE046Pg6s=";
  private static readonly DC_APP_PACKAGE = "com.dcinside.app.android";
  private static readonly DC_APP_VERSION_CODE = "100051";
  private static readonly DC_APP_VERSION_NAME = "4.8.1";
  private static readonly FIREBASE_APP_ID = "1:477369754343:android:d2ffdd960120a207727842";
  private static readonly FIREBASE_PROJECT_ID = "dcinside-b3f40";

  private static readonly seoulTimeZone = "Asia/Seoul";

  private lastRefreshTime: Date | null = null;
  private time: string = "";
  private fid: string = "";
  private refreshToken: string | null = null;
  private seoulTimeZone: string = "Asia/Seoul";

  constructor() {
    this.fid = this.createRandomFid();
  }

  private async generateHashedAppKey(): Promise<string> {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: this.seoulTimeZone }));

    if (!this.lastRefreshTime || this.needsRefresh(this.lastRefreshTime, now)) {
      try {
        const response = await fetch("http://json2.dcinside.com/json0/app_check_A_rina_one_new.php");
        const data = await response.json();
        this.lastRefreshTime = now;
        this.time = data[0].date;
      } catch (error) {
        console.error("Error fetching app check:", error);
        this.time = this.dateToString(now);
      }
    }

    const hash = crypto.createHash("sha256");
    hash.update(`dcArdchk_${this.time}`);
    return hash.digest("hex");
  }

  private needsRefresh(old: Date, newDate: Date): boolean {
    return old.getFullYear() !== newDate.getFullYear() ||
      old.getMonth() !== newDate.getMonth() ||
      old.getDate() !== newDate.getDate() ||
      old.getHours() !== newDate.getHours();
  }

  private dateToString(date: Date): string {
    const dayOfYear = this.getDayOfYear(date);
    const dayOfWeek = date.getDay();
    const weekOfYear = this.getWeekOfYear(date);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${dayNames[dayOfWeek]}${dayOfYear - 1}d${this.getDayOfWeekMonday(dayOfWeek)}${dayOfWeek}${weekOfYear.toString().padStart(2, "0")}MddMM`;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  private getWeekOfYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getDayOfWeekMonday(day: number): number {
    const daysOrder = [1, 2, 3, 4, 5, 6, 7];
    return daysOrder[day];
  }

  private createRandomFid(): string {
    const uuidBytes = Buffer.alloc(17);
    crypto.randomFillSync(uuidBytes);
    uuidBytes[16] = uuidBytes[0];
    uuidBytes[0] = (0x0F & uuidBytes[0]) | 0x70;
    return this.encodeFidBase64UrlSafe(uuidBytes);
  }

  private encodeFidBase64UrlSafe(rawValue: Buffer): string {
    return rawValue.toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
      .substring(0, 22);
  }

  private async fetchFirebaseInstallations(): Promise<{ fid: string, refreshToken: string, authToken: string }> {
    const response = await fetch(`https://firebaseinstallations.googleapis.com/v1/projects/${AppIdGenerator.FIREBASE_PROJECT_ID}/installations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Android-Package": AppIdGenerator.DC_APP_PACKAGE,
        "X-Android-Cert": AppIdGenerator.DC_APP_SIGNATURE,
        "x-goog-api-key": "AIzaSyDcbVof_4Bi2GwJ1H8NjSwSTaMPPZeCE38",
      },
      body: JSON.stringify({
        fid: this.fid,
        appId: AppIdGenerator.FIREBASE_APP_ID,
        authVersion: "FIS_v2",
        sdkVersion: "a:17.1.0",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      fid: data.fid,
      refreshToken: data.refreshToken,
      authToken: data.authToken.token,
    };
  }

  private async fetchFcmToken(fid: string, authToken: string): Promise<string> {
    const response = await fetch("https://android.clients.google.com/c2dm/register3", {
      method: "POST",
      headers: {
        "Authorization": `AidLogin ${fid}:${authToken}`,
        "app": AppIdGenerator.DC_APP_PACKAGE,
        "User-Agent": "Android-GCM/1.5 (generic_x86 KK)",
      },
      body: new URLSearchParams({
        "app": AppIdGenerator.DC_APP_PACKAGE,
        "X-subtype": "477369754343",
        "device": fid,
        "sender": "477369754343",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    return data.split("=")[1];
  }

  public async getAppId(): Promise<string> {
    const hashedAppKey = await this.generateHashedAppKey();
    const { fid, authToken } = await this.fetchFirebaseInstallations();
    const fcmToken = await this.fetchFcmToken(fid, authToken);

    const response = await fetch("https://msign.dcinside.com/auth/mobile_app_verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "value_token": hashedAppKey,
        "signature": AppIdGenerator.DC_APP_SIGNATURE,
        "pkg": AppIdGenerator.DC_APP_PACKAGE,
        "vCode": AppIdGenerator.DC_APP_VERSION_CODE,
        "vName": AppIdGenerator.DC_APP_VERSION_NAME,
        "client_token": fcmToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.app_id;
  }
}

export default AppIdGenerator;
