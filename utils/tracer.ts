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

export class NestedStepTracer extends TracerStatus implements Tracer {
  // Stack of steps. Each step is a sub-step of the previous one. The last one
  // is the current step.
  stepStack: Ref<Step[]> = ref([]);

  constructor() {
    // compute the title by concatenating the topic of each step
    const title = computed(() => {
      return (
        this.stepStack.value
          .map((step) => {
            return `${step.topic} ` + (step.total ? `[${step.completed}/${step.total}] ` : '');
          })
          .join('') || 'Preparing...'
      );
    });

    // compute the latest message by taking the last log entry.
    const message = computed(() => {
      const log = this.logs.value.at(-1);
      return log?.message || '...';
    });

    // compute the percentage by accumulating the weighted completed/total of each step,
    const percentage = computed(() => {
      // compute the percentage by accumulating the completed/total of each step,
      //   weighted by the percentage of the step in the parent step
      const percentage = this.stepStack.value
        .flatMap((step) => {
          return step.total ? [[step.completed / step.total, 1 / step.total]] : [];
        })
        .reduce(
          ([acc, prevUnit], [completed, unit]) => {
            return [acc + completed * prevUnit, unit * prevUnit];
          },
          [0, 100],
        )
        .at(0);
      return percentage ? Number(percentage.toFixed(1)) : percentage;
    });

    super(ref(''), ref([]), ref(0), title, message, percentage);
  }

  start() {
    this.reset();
    this.updated.value += 1;
  }

  finish() {
    this.reset();
  }

  fail() {}

  /**
   * Push a new log entry.
   *
   * @param message
   */
  log(...message: any[]): void {
    this.logs.value.push({
      level: 'info',
      message: message.map((e) => e.toString()).join(' '),
      timestamp: new Date(),
    });
    this.updated.value += 1;
  }

  /**
   * Push a new step to the stack.
   *
   * Each step has a topic and a message. If the step has sub-steps, it will
   * have a total and an initial completed as 0. It will be computed as a part
   * of percentage.
   *
   * @param topic This will be shown in a breadcrumb-like fashion.
   * @param message This will be shown if it is the latest one.
   * @param total If this step has sub-steps, this will be the total number of sub-steps.
   */
  onStepStart(topic: string, message: string, total: number | undefined): void {
    this.stepStack.value.push({ topic, message, completed: 0, total });
    this.updated.value += 1;
  }

  /**
   * Pop the last step from the stack and increment the completed count of the previous step.
   */
  onStepEnd(): void {
    this.stepStack.value.pop();
    const lastStep = this.stepStack.value.at(-1);
    if (lastStep) {
      lastStep.completed += 1;
    }
    this.updated.value += 1;
  }

  /**
   * Reset the status.
   */
  reset() {
    this.stepStack.value = [];
    this.logs.value = [];
    this.updated.value = 0;
  }
}
