/**
 * AnchorMarks - Logging Utility
 * Centralized logging that respects environment and log levels
 */

type LogLevel = "debug" | "info" | "warn" | "error";



class Logger {
  private isDevelopment(): boolean {
    return (
      import.meta.env.DEV ||
      import.meta.env.MODE === "development" ||
      localStorage.getItem("anchormarks_debug") === "true"
    );
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment()) return true;

    // In production, only log warnings and errors
    return level === "warn" || level === "error";
  }

  private formatMessage(message: string, context?: string): string {
    return context ? `[${context}] ${message}` : message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      const formattedMessage = this.formatMessage(message);
      if (error instanceof Error) {
        console.error(formattedMessage, error, ...args);
      } else if (error) {
        console.error(formattedMessage, error, ...args);
      } else {
        console.error(formattedMessage, ...args);
      }
    }
  }

  log(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export function logDebug(message: string, ...args: unknown[]): void {
  logger.debug(message, ...args);
}

export function logInfo(message: string, ...args: unknown[]): void {
  logger.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  logger.warn(message, ...args);
}

export function logError(
  message: string,
  error?: unknown,
  ...args: unknown[]
): void {
  logger.error(message, error, ...args);
}

export default logger;
