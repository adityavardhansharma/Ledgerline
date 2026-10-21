/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as commentary from "../commentary.js";
import type * as crons from "../crons.js";
import type * as forecast from "../forecast.js";
import type * as http from "../http.js";
import type * as ledger from "../ledger.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_engine from "../lib/engine.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as orgs from "../orgs.js";
import type * as reports from "../reports.js";
import type * as scenarios from "../scenarios.js";
import type * as sync from "../sync.js";
import type * as xero from "../xero.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  commentary: typeof commentary;
  crons: typeof crons;
  forecast: typeof forecast;
  http: typeof http;
  ledger: typeof ledger;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/crypto": typeof lib_crypto;
  "lib/engine": typeof lib_engine;
  "lib/money": typeof lib_money;
  "lib/tokens": typeof lib_tokens;
  orgs: typeof orgs;
  reports: typeof reports;
  scenarios: typeof scenarios;
  sync: typeof sync;
  xero: typeof xero;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
