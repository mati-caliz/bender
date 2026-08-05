import type { ScriptError } from '@/lib/script-errors';
import type { CapturedBodies, EngineStatus, NetworkEntry, UserScriptsStatus } from '@/types';

export interface MockHitPayload {
  url: string;
  method: string;
  status: number;
  ruleName: string;
  tabUrl: string;
}

export type ExtensionMessage =
  | { type: 'engine/refresh' }
  | { type: 'engine/status' }
  | { type: 'network/list' }
  | { type: 'network/clear' }
  | { type: 'network/hit'; payload: MockHitPayload }
  | { type: 'network/bodies'; payload: CapturedBodies }
  | { type: 'userscripts/sync' }
  | { type: 'scripts/error'; payload: ScriptError }
  | { type: 'scripts/errors' }
  | { type: 'scripts/errors-clear' };

export interface MessageResultMap {
  'engine/refresh': EngineStatus;
  'engine/status': EngineStatus;
  'network/list': NetworkEntry[];
  'network/clear': null;
  'network/hit': null;
  'network/bodies': null;
  'userscripts/sync': UserScriptsStatus;
  'scripts/error': null;
  'scripts/errors': ScriptError[];
  'scripts/errors-clear': null;
}

export const sendMessage = async <TType extends ExtensionMessage['type']>(
  message: Extract<ExtensionMessage, { type: TType }>
): Promise<MessageResultMap[TType]> => await chrome.runtime.sendMessage(message);
