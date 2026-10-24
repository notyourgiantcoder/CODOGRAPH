import { UNCLASSIFIED, type RailKey, type Role } from "../roles.ts";

// How each rail category looks: one of the landing page's six category
// colours, picked by what kind of thing the role is, so a Next.js page and an
// Express router read as the same family. The colours were validated for
// separation on the dark panels; grey is for what no convention named.

export type RoleFamily = "route" | "api" | "hook" | "type" | "utility" | "component" | "test" | "none";

export const FAMILY_COLOR: Record<RoleFamily, string> = {
  route: "#3987e5",
  api: "#d95926",
  hook: "#199e70",
  type: "#c98500",
  utility: "#d55181",
  component: "#9085e9",
  test: "#7d8496",
  none: "#5d6274",
};

const FAMILY: Record<Role, RoleFamily> = {
  "page-route": "route",
  layout: "route",
  "route-ui": "route",
  metadata: "route",
  "api-endpoint": "api",
  "server-action": "api",
  router: "api",
  controller: "api",
  resolver: "api",
  gateway: "api",
  hook: "hook",
  entity: "type",
  model: "type",
  dto: "type",
  types: "type",
  util: "utility",
  store: "utility",
  script: "utility",
  service: "utility",
  repository: "utility",
  module: "utility",
  config: "utility",
  middleware: "utility",
  guard: "utility",
  interceptor: "utility",
  pipe: "utility",
  filter: "utility",
  instrumentation: "utility",
  "theme-override": "utility",
  component: "component",
  test: "test",
};

export function familyOf(key: RailKey): RoleFamily {
  return key === UNCLASSIFIED ? "none" : FAMILY[key];
}

export function roleColor(key: RailKey): string {
  return FAMILY_COLOR[familyOf(key)];
}
