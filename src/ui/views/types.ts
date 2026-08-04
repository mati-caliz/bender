import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { ToolkitState } from '@/types';

export type UpdateState = (mutate: (state: ToolkitState) => ToolkitState) => void;

export interface ViewProps {
  state: ToolkitState;
  update: UpdateState;
  activeTab: ActiveTab;
}
