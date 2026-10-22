/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiActions from "../aiActions.js";
import type * as audit from "../audit.js";
import type * as chat from "../chat.js";
import type * as chatTools from "../chatTools.js";
import type * as commentary from "../commentary.js";
import type * as crons from "../crons.js";
import type * as forecast from "../forecast.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as ledger from "../ledger.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_chatPrompt from "../lib/chatPrompt.js";
import type * as lib_chatSpec from "../lib/chatSpec.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_engine from "../lib/engine.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_openItems from "../lib/openItems.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as orgs from "../orgs.js";
import type * as reports from "../reports.js";
import type * as scenarios from "../scenarios.js";
import type * as search from "../search.js";
import type * as sync from "../sync.js";
import type * as xero from "../xero.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiActions: typeof aiActions;
  audit: typeof audit;
  chat: typeof chat;
  chatTools: typeof chatTools;
  commentary: typeof commentary;
  crons: typeof crons;
  forecast: typeof forecast;
  http: typeof http;
  imports: typeof imports;
  ledger: typeof ledger;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/chatPrompt": typeof lib_chatPrompt;
  "lib/chatSpec": typeof lib_chatSpec;
  "lib/crypto": typeof lib_crypto;
  "lib/engine": typeof lib_engine;
  "lib/money": typeof lib_money;
  "lib/openItems": typeof lib_openItems;
  "lib/tokens": typeof lib_tokens;
  orgs: typeof orgs;
  reports: typeof reports;
  scenarios: typeof scenarios;
  search: typeof search;
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
