import { Ref } from "vue";

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
    apiKey: string,
    indexName: string,
    environment: string,
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
