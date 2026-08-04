import { useEffect, useState } from 'react';

export interface ActiveTab {
  id: number | null;
  url: string;
  origin: string;
  hostname: string;
  injectable: boolean;
}

const EMPTY_TAB: ActiveTab = { id: null, url: '', origin: '', hostname: '', injectable: false };
const HTTP_URL_PATTERN = /^https?:/;

const describeTab = (tab: chrome.tabs.Tab | undefined): ActiveTab => {
  if (!tab?.url || typeof tab.id !== 'number') return EMPTY_TAB;
  if (!HTTP_URL_PATTERN.test(tab.url)) return { ...EMPTY_TAB, id: tab.id, url: tab.url };
  const parsed = new URL(tab.url);
  return { id: tab.id, url: tab.url, origin: parsed.origin, hostname: parsed.hostname, injectable: true };
};

export const useActiveTab = (): ActiveTab => {
  const [tab, setTab] = useState<ActiveTab>(EMPTY_TAB);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void chrome.tabs.query({ active: true, currentWindow: true }).then(([current]) => {
        if (active) setTab(describeTab(current));
      });
    };
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    return () => {
      active = false;
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
    };
  }, []);

  return tab;
};
