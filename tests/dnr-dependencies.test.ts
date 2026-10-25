import { describe, expect, it } from "vitest";
import { DEFAULT_CORS_CONFIG, createEmptyScope } from "@/lib/constants";
import { type CompileContext, compileRules, dependsOnTabs } from "@/lib/dnr";
import { EMPTY_CONTEXT, header, profileWith, stateWith, trafficRuleWith } from "./support/dnr-fixtures";

describe("dependsOnTabs", () => {
  it("es falso cuando nada depende de la pestaña activa", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-test", "1")] })],
      trafficRules: [trafficRuleWith({ kind: "block" })],
    });

    expect(dependsOnTabs(state)).toBe(false);
  });

  it("es verdadero si un perfil activo usa solo la pestaña activa", () => {
    const state = stateWith({
      profiles: [profileWith({ scope: { ...createEmptyScope(), activeTabOnly: true } })],
    });

    expect(dependsOnTabs(state)).toBe(true);
  });

  it("ignora los perfiles apagados", () => {
    const state = stateWith({
      profiles: [profileWith({ enabled: false, scope: { ...createEmptyScope(), activeTabOnly: true } })],
    });

    expect(dependsOnTabs(state)).toBe(false);
  });

  it("es verdadero si CORS refleja el origen", () => {
    const state = stateWith({
      cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: "reflect" },
    });

    expect(dependsOnTabs(state)).toBe(true);
  });

  it("es falso con el motor apagado", () => {
    const state = stateWith({
      globalEnabled: false,
      cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: "reflect" },
    });

    expect(dependsOnTabs(state)).toBe(false);
  });
});

describe("compileRules con metodos e iniciador", () => {
  it("lleva metodos y dominios iniciadores a la condicion de la regla", () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [header("x-test", "1")],
          scope: {
            ...createEmptyScope(),
            requestMethods: ["post", "put"],
            initiatorDomains: ["app.local"],
            excludedInitiatorDomains: ["admin.local"],
          },
        }),
      ],
    });
    const [rule] = compileRules(state, EMPTY_CONTEXT).rules;

    expect(rule?.condition.requestMethods).toEqual(["post", "put"]);
    expect(rule?.condition.initiatorDomains).toEqual(["app.local"]);
    expect(rule?.condition.excludedInitiatorDomains).toEqual(["admin.local"]);
  });

  it("no manda metodos ni iniciador cuando el alcance no los define", () => {
    const state = stateWith({ profiles: [profileWith({ requestHeaders: [header("x-test", "1")] })] });
    const [rule] = compileRules(state, EMPTY_CONTEXT).rules;

    expect(rule?.condition.requestMethods).toBeUndefined();
    expect(rule?.condition.initiatorDomains).toBeUndefined();
  });
});

describe("compileRules con valores dinamicos", () => {
  const tabContext: CompileContext = {
    activeTabId: 1,
    tabs: [{ id: 1, origin: "https://app.local", url: "https://app.local/panel?x=1" }],
  };

  it("resuelve los marcadores de pestaña y de tiempo", () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [
            header("x-origen", "{{tabOrigin}}"),
            header("x-host", "{{tabHostname}}"),
            header("x-url", "{{tabUrl}}"),
            header("x-unix", "{{unix}}"),
          ],
        }),
      ],
    });
    const [rule] = compileRules(state, tabContext).rules;
    const values = rule?.action.requestHeaders?.map((entry) => entry.value);

    expect(values?.[0]).toBe("https://app.local");
    expect(values?.[1]).toBe("app.local");
    expect(values?.[2]).toBe("https://app.local/panel?x=1");
    expect(values?.[3]).toMatch(/^\d+$/);
  });

  it("genera un uuid distinto por ocurrencia", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-par", "{{uuid}}|{{uuid}}")] })],
    });
    const [rule] = compileRules(state, tabContext).rules;
    const [primero, segundo] = (rule?.action.requestHeaders?.[0]?.value ?? "").split("|");

    expect(primero).toBeTruthy();
    expect(segundo).toBeTruthy();
    expect(primero).not.toBe(segundo);
  });

  it("deja el marcador desconocido tal cual y avisa", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-test", "{{noExiste}}")] })],
    });
    const compiled = compileRules(state, tabContext);

    expect(compiled.rules[0]?.action.requestHeaders?.[0]?.value).toBe("{{noExiste}}");
    expect(compiled.diagnostics.some((diagnostic) => diagnostic.message.includes("noExiste"))).toBe(true);
  });

  it("vacia los marcadores de pestaña cuando no hay pestaña activa y avisa", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-url", "pre-{{tabUrl}}-post")] })],
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);

    expect(compiled.rules[0]?.action.requestHeaders?.[0]?.value).toBe("pre--post");
    expect(compiled.diagnostics.some((diagnostic) => diagnostic.message.includes("tabUrl"))).toBe(true);
  });

  it("obliga a recompilar por pestaña si un header usa un marcador de pestaña", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-url", "{{tabUrl}}")] })],
    });

    expect(dependsOnTabs(state)).toBe(true);
  });

  it("no obliga a recompilar por pestaña con marcadores que no dependen de ella", () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("x-id", "{{uuid}}")] })],
    });

    expect(dependsOnTabs(state)).toBe(false);
  });
});
