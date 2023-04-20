import { PineconeClient } from '@pinecone-database/pinecone';
import {
  Configuration,
  ConfigurationParameters,
  ResponseError,
  VectorOperationsApi,
} from '@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch';
import { useTauriFetch } from '~/composables/useTauriFetch';

class ErrorWithoutStackTrace extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorWithoutStackTrace';
    Object.setPrototypeOf(this, new.target.prototype);
    this.stack = '';
  }
}

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  let result = new Uint8Array(0);
  const reader = stream.getReader();
  while (true) {
    // eslint-disable-line no-constant-condition
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const newResult = new Uint8Array(result.length + value.length);
    newResult.set(result);
    newResult.set(value, result.length);
    result = newResult;
  }
  return result;
}

async function handler(func: Function, args: any) {
  try {
    return await func(args);
  } catch (e) {
    const error = e as ResponseError;
    if (error && error.response) {
      const body = error.response?.body as ReadableStream;
      const buffer = body && (await streamToArrayBuffer(body));
      const text = buffer && new TextDecoder().decode(buffer);
      try {
        // Handle "RAW" call errors
        const json = text && JSON.parse(text);
        return Promise.reject(new ErrorWithoutStackTrace(`${json?.message}`));
      } catch (e) {
        return Promise.reject(
          new ErrorWithoutStackTrace(`PineconeClient: Error calling ${func.name.replace('bound ', '')}: ${text}`),
        );
      }
    } else {
      return Promise.reject(
        new ErrorWithoutStackTrace(`PineconeClient: Error calling ${func.name.replace('bound ', '')}: ${error}`),
      );
    }
  }
}

function attachHandler(instance: VectorOperationsApi): VectorOperationsApi {
  for (const prop of Object.keys(Object.getPrototypeOf(instance))) {
    // @ts-ignore
    let descriptor = instance[prop];
    if (descriptor && typeof descriptor === 'function' && prop !== 'constructor') {
      // @ts-ignore
      instance[prop] = async (args?) => {
        Object.defineProperty(descriptor, 'name', { value: prop });
        let boundFunction: Function = descriptor.bind(instance);
        return handler(boundFunction, args);
      };
    }
  }
  return instance;
}

export class CrossPineconeClient extends PineconeClient {
  public Index(index: string) {
    if (!this.apiKey) throw new Error('PineconeClient: API key not set. Call init() first.');
    if (!this.projectName) throw new Error('PineconeClient: Project name not set. Call init() first.');
    if (!this.environment) throw new Error('PineconeClient: Environment not set. Call init() first.');

    const indexConfigurationParameters: ConfigurationParameters = {
      basePath: `https://${index}-${this.projectName}.svc.${this.environment}.pinecone.io`,
      apiKey: this.apiKey,
      fetchApi: useTauriFetch,
    };

    const indexConfiguration = new Configuration(indexConfigurationParameters);
    const vectorOperations = new VectorOperationsApi(indexConfiguration);
    return attachHandler(vectorOperations);
  }
}
