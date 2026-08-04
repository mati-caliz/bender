import type { HeaderOperation, ResourceType } from '@/types';

type DnrResourceType = chrome.declarativeNetRequest.ResourceType;
type DnrRuleActionType = chrome.declarativeNetRequest.RuleActionType;
type DnrHeaderOperation = chrome.declarativeNetRequest.HeaderOperation;

export const toDnrResourceTypes = (resourceTypes: ResourceType[]): DnrResourceType[] =>
  resourceTypes.map((resourceType) => resourceType as DnrResourceType);

export const toDnrHeaderOperation = (operation: HeaderOperation): DnrHeaderOperation =>
  operation as DnrHeaderOperation;

export const DNR_ACTION_BLOCK = 'block' as DnrRuleActionType;
export const DNR_ACTION_REDIRECT = 'redirect' as DnrRuleActionType;
export const DNR_ACTION_MODIFY_HEADERS = 'modifyHeaders' as DnrRuleActionType;

export const DNR_OPERATION_SET = 'set' as DnrHeaderOperation;
export const DNR_OPERATION_REMOVE = 'remove' as DnrHeaderOperation;
