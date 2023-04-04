import { HttpVerb } from '@tauri-apps/api/http';
import { Response } from 'cross-fetch';
import { fetch } from '@tauri-apps/api/http';

/**
 * Fetch by tauri fetch api for cross fetching.
 */
// noinspection JSUnusedGlobalSymbols
export async function tauri_fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(
    input.toString(),
    init
      ? {
          ...init,
          method: init.method as HttpVerb,
          body: {
            type: 'Text',
            payload: init.body,
          },
        }
      : undefined,
  );
  return new Response(JSON.stringify(response.data) as BodyInit, response);
}
