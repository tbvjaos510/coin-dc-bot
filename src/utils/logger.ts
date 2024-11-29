
export class Logger {
  private static log(type: "info" | "error" | "warn" | "debug" = "info", message: string, ...args: any[]) {
    console[type](`[${type}]`, message, ...args);
  }

  public static info(message: string, ...args: any[]) {
    this.log("info", message, ...args);
  }

  public static error(message: string, ...args: any[]) {
    this.log("error", message, ...args);
  }

  public static warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args);
  }
}
