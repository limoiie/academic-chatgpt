import { Ref } from 'vue';

export type LogLevel = 'info' | 'error' | 'warning';

export interface Step {
  topic: string;
  message: string;
  completed: number;
  total: number | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
}

export abstract class TracerStatus {
  protected constructor(
    public status: Ref<string>,
    public logs: Ref<LogEntry[]>,
    public updated: Ref<number>,
    public title: Ref<string>,
    public message: Ref<string>,
    public percentage: Ref<number | undefined>,
  ) {}
}

export abstract class Tracer {
  /**
   * Log a message.
   *
   * @param message The message to log.
   */
  abstract log(...message: any[]): void;

  /**
   * Start a new step.
   *
   * @param topic The topic of the step which will be sticky on ui.
   * @param message The transient message of the step.
   * @param total The total number of steps. If undefined, the step is not progressable.
   */
  abstract onStepStart(topic: string, message: string, total: number | undefined): void;

  /**
   * End the current step.
   */
  abstract onStepEnd(): void;
}