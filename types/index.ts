import { Ref } from "vue";

declare global {
  interface CreateEmbeddingsConfigFormState {
    client: string;
    configName: string;
    meta: any;
  }

  interface CreateIndexConfigFormState {
    client: string;
    configName: string;
    meta: any;
  }

  interface OpenAIEmbeddingsConfigMeta {
    apiKey: string,
  }

  interface PineconeVectorstoreConfigMeta {
    apiKey: string,
    indexName: string,
    environment: string,
    namespace: string,
    dimension: string,
    metric: string,
  }

  type LogLevel = 'info' | 'error' | 'warning';

  interface LogMessage {
    level: LogLevel;
    message: string;
  }
}

export class Logger {
  logs: Ref<LogMessage[]>;

  constructor(logs: Ref<LogMessage[]>) {
    this.logs = logs || [];
  }

  log(level: LogLevel, message: string) {
    this.logs.value.push({ level, message });
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

  reset() {
    this.logs.value = [];
  }
}
