import type { UiAlert } from "$lib/components/alerts/types";
import { alertEntityKey } from "$lib/components/alerts/display";

export type M365AlertModuleId =
  | "identities"
  | "licenses"
  | "exchange"
  | "other";

export type M365AlertModule = {
  id: M365AlertModuleId;
  label: string;
  href: string;
};

const MODULES: Record<M365AlertModuleId, M365AlertModule> = {
  identities: {
    id: "identities",
    label: "Identities",
    href: "/microsoft-365/identities",
  },
  licenses: {
    id: "licenses",
    label: "Licenses",
    href: "/microsoft-365/licenses",
  },
  exchange: {
    id: "exchange",
    label: "Exchange",
    href: "/microsoft-365/exchange",
  },
  other: { id: "other", label: "Other", href: "/microsoft-365/alerts" },
};

export function moduleForAlert(alert: UiAlert): M365AlertModule {
  const definitionId = alert.definitionId ?? "";
  if (definitionId.startsWith("microsoft-365.identities."))
    return MODULES.identities;
  if (definitionId.startsWith("microsoft-365.licenses."))
    return MODULES.licenses;
  if (definitionId.startsWith("microsoft-365.mailboxForwarding."))
    return MODULES.exchange;
  if (definitionId.startsWith("microsoft-365.inboxRules."))
    return MODULES.exchange;
  return MODULES.other;
}

export type EntityInsight = {
  entityKey: string;
  alerts: UiAlert[];
  highestSeverity: number;
};

function entityKeyFromAlert(alert: UiAlert): string {
  return alertEntityKey(alert);
}

export function groupByEntity(alerts: UiAlert[]): EntityInsight[] {
  const map = new Map<string, EntityInsight>();

  for (const alert of alerts) {
    const key = entityKeyFromAlert(alert);
    const existing = map.get(key);

    if (existing) {
      existing.alerts.push(alert);
      existing.highestSeverity = Math.max(
        existing.highestSeverity,
        alert.severity,
      );
    } else {
      map.set(key, {
        entityKey: key,
        alerts: [alert],
        highestSeverity: alert.severity,
      });
    }
  }

  return [...map.values()]
    .map((entity) => ({
      ...entity,
      alerts: entity.alerts.sort((a, b) => b.severity - a.severity),
    }))
    .sort((a, b) => {
      if (a.highestSeverity !== b.highestSeverity)
        return b.highestSeverity - a.highestSeverity;
      return b.alerts.length - a.alerts.length;
    });
}
