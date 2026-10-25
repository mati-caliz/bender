import type { HeaderOperation, RequestMethod, ResourceType } from "@/types";

type DnrResourceType = chrome.declarativeNetRequest.ResourceType;
type DnrRequestMethod = chrome.declarativeNetRequest.RequestMethod;
type DnrRuleActionType = chrome.declarativeNetRequest.RuleActionType;
type DnrHeaderOperation = chrome.declarativeNetRequest.HeaderOperation;

type EnumMembers<Enum extends string> = Readonly<Record<`${Enum}`, true>>;

interface EnumNarrower<Enum extends string> {
  readonly isMember: (value: string) => value is Enum;
  readonly narrow: (value: string) => Enum;
}

const createEnumNarrower = <Enum extends string>(members: EnumMembers<Enum>): EnumNarrower<Enum> => {
  const memberValues: ReadonlySet<string> = new Set(Object.keys(members));
  const isMember = (value: string): value is Enum => memberValues.has(value);
  const narrow = (value: string): Enum => {
    if (!isMember(value)) throw new Error(`Valor desconocido para declarativeNetRequest: ${value}`);
    return value;
  };
  return { isMember, narrow };
};

const dnrResourceTypes = createEnumNarrower<DnrResourceType>({
  main_frame: true,
  sub_frame: true,
  stylesheet: true,
  script: true,
  image: true,
  font: true,
  object: true,
  xmlhttprequest: true,
  ping: true,
  csp_report: true,
  media: true,
  websocket: true,
  other: true,
});

const dnrRequestMethods = createEnumNarrower<DnrRequestMethod>({
  connect: true,
  delete: true,
  get: true,
  head: true,
  options: true,
  patch: true,
  post: true,
  put: true,
});

const dnrRuleActionTypes = createEnumNarrower<DnrRuleActionType>({
  block: true,
  redirect: true,
  allow: true,
  upgradeScheme: true,
  modifyHeaders: true,
  allowAllRequests: true,
});

const dnrHeaderOperations = createEnumNarrower<DnrHeaderOperation>({
  append: true,
  set: true,
  remove: true,
});

export const toDnrResourceTypes = (resourceTypes: ResourceType[]): DnrResourceType[] =>
  resourceTypes.filter((resourceType) => dnrResourceTypes.isMember(resourceType));

export const toDnrRequestMethods = (requestMethods: RequestMethod[]): DnrRequestMethod[] =>
  requestMethods.filter((requestMethod) => dnrRequestMethods.isMember(requestMethod));

export const toDnrHeaderOperation = (operation: HeaderOperation): DnrHeaderOperation =>
  dnrHeaderOperations.narrow(operation);

export const DNR_ACTION_BLOCK = dnrRuleActionTypes.narrow("block");
export const DNR_ACTION_REDIRECT = dnrRuleActionTypes.narrow("redirect");
export const DNR_ACTION_MODIFY_HEADERS = dnrRuleActionTypes.narrow("modifyHeaders");

export const DNR_OPERATION_SET = dnrHeaderOperations.narrow("set");
export const DNR_OPERATION_REMOVE = dnrHeaderOperations.narrow("remove");
