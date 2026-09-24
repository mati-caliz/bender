import type { ReactElement } from "react";
import { MAX_FAIL_RATE, MIN_FAIL_RATE, NETWORK_ERROR_STATUS, describeChaos } from "@/lib/chaos";
import { Field, Notice, Select, TextInput } from "@/ui/components/primitives";
import {
  chaosPatcher,
  clamp,
  parseDecimal,
  type ChaosAction,
  type MutateBoundRule,
} from "@/ui/views/rules/rule-actions";

const MAX_DELAY_MS = 60000;

const FAILURE_OPTIONS = [
  { value: String(NETWORK_ERROR_STATUS), label: "Error de red" },
  { value: "500", label: "500 Server Error" },
  { value: "503", label: "503 Service Unavailable" },
  { value: "429", label: "429 Too Many Requests" },
  { value: "401", label: "401 Unauthorized" },
  { value: "404", label: "404 Not Found" },
];

const parseDelay = (value: string): number => {
  const parsed = parseDecimal(value);
  return Number.isNaN(parsed) ? 0 : clamp(parsed, 0, MAX_DELAY_MS);
};

const parseFailRate = (value: string): number => {
  const parsed = parseDecimal(value);
  return Number.isNaN(parsed) ? 0 : clamp(parsed, MIN_FAIL_RATE, MAX_FAIL_RATE);
};

const parseFailStatus = (value: string): number => {
  const parsed = parseDecimal(value);
  return Number.isNaN(parsed) || parsed === 0 ? NETWORK_ERROR_STATUS : parsed;
};

interface ChaosActionEditorProps {
  action: ChaosAction;
  mutateRule: MutateBoundRule;
}

export const ChaosActionEditor = ({ action, mutateRule }: ChaosActionEditorProps): ReactElement => {
  const patchAction = chaosPatcher(mutateRule);
  const hasEffect = action.failRate > 0 || action.delayMs > 0;
  return (
    <>
      <div className="grid-3">
        <Field label="Delay (ms)" hint="Se suma a toda request que matchee">
          <TextInput
            type="number"
            value={String(action.delayMs)}
            onChange={(value) => {
              patchAction({ delayMs: parseDelay(value) });
            }}
          />
        </Field>
        <Field label="Fallos (%)" hint="0 = nunca, 100 = siempre">
          <TextInput
            type="number"
            value={String(action.failRate)}
            onChange={(value) => {
              patchAction({ failRate: parseFailRate(value) });
            }}
          />
        </Field>
        <Field label="Como falla">
          <Select
            value={String(action.failStatus)}
            options={FAILURE_OPTIONS}
            onChange={(value) => {
              patchAction({ failStatus: parseFailStatus(value) });
            }}
          />
        </Field>
      </div>

      <Notice tone={hasEffect ? "info" : "warning"}>
        {hasEffect
          ? `Efecto: ${describeChaos(action)}. Solo alcanza a fetch, XHR y sendBeacon que dispare el JavaScript de la pagina.`
          : "Con delay 0 y 0% de fallos la regla no hace nada."}
      </Notice>
    </>
  );
};
