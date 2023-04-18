import { Ref } from 'vue';

declare global {
  interface CreateEmbeddingsClientFormState {
    name: string;
    type: string;
    info: any;
  }

  interface CreateEmbeddingsConfigFormState {
    clientType: string;
    name: string;
    meta: any;
  }

  interface CreateVectorDbConfigFormState {
    clientType: string;
    name: string;
    meta: any;
  }

  interface OpenAIEmbeddingsConfigMeta {
    dimension: number;
  }

  interface PineconeVectorstoreConfigMeta {
    apiKey: string;
    indexName: string;
    environment: string;
    dimension: string;
    metric: string;
  }

  type LogLevel = 'info' | 'error' | 'warning';

  interface LogMessage {
    level: LogLevel;
    message: string;
    timestamp: Date;
  }
}

export class ProgressLogger {
  status: Ref<'ready' | 'processing' | 'done' | 'error'>;
  step: Ref<number>;
  inlineMessage: Ref<string>;
  processing: Ref<boolean>;

  constructor(
    public completedNum: Ref<number> = ref(0),
    public totalNum: Ref<number | null> = ref(100),
    public percentage: Ref<number> = ref(0),
    public logs: Ref<LogMessage[]> = ref([]),
    public updated: Ref<number> = ref(0),
  ) {
    this.status = ref('ready');
    this.step = computed(() => (this.totalNum.value ? 100 / this.totalNum.value : 0));
    this.inlineMessage = computed(() => {
      const log = this.logs.value.at(-1);
      if (log == null) {
        return '...';
      }
      return `[${this.completedNum.value}/${this.totalNum.value}] ${log.level}: ${log.message}`;
    });
    this.processing = computed(() => this.status.value == 'processing');
  }

  log(level: LogLevel, message: string) {
    ++this.updated.value;
    const timestamp = new Date()
    this.logs.value.push({ level, message, timestamp });
  }

  info(message: string) {
    this.log('info', message);
  }

  error(message: string) {
    this.log('error', message);
  }

  warning(message: string) {
    this.log('warning', message);
  }

  start() {
    ++this.updated.value;
    this.status.value = 'processing';
  }

  advance(log: {level: LogLevel | undefined, message: string } | undefined = undefined, delta: number = 1) {
    ++this.updated.value;
    this.completedNum.value += delta;
    this.percentage.value += parseFloat((delta * this.step.value).toPrecision(3));
    if (log) {
      this.log(log.level || 'info', log.message);
    }
  }

  fail() {
    ++this.updated.value;
    this.status.value = 'error';
  }

  finish() {
    ++this.updated.value;
    this.totalNum.value = this.totalNum.value || this.completedNum.value;
    this.completedNum.value = this.totalNum.value;
    this.percentage.value = 100;
    this.status.value = 'done';
  }

  reset() {
    this.updated.value = 0;
    this.completedNum.value = 0;
    this.totalNum.value = null;
    this.logs.value = [];
    this.percentage.value = 0;
    this.status.value = 'ready';
  }
}
