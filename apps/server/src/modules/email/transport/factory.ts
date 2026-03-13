/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { ensureValidAccessToken } from "../oauth/tokenManager";
import { GmailTransportAdapter } from "./gmailAdapter";
import { GraphTransportAdapter } from "./graphAdapter";
import { ImapTransportAdapter } from "./imapAdapter";
import type { EmailTransportAdapter } from "./types";

export type TransportAccountConfig = {
  emailAddress: string;
  auth:
    | { type: "password"; envKey: string }
    | { type: "oauth2-graph"; refreshTokenEnvKey: string; accessTokenEnvKey: string; expiresAtEnvKey: string }
    | { type: "oauth2-gmail"; refreshTokenEnvKey: string; accessTokenEnvKey: string; expiresAtEnvKey: string };
  imap?: { host: string; port: number; tls: boolean };
  smtp?: { host: string; port: number; tls: boolean };
};

export function createTransport(
  account: TransportAccountConfig,
  options?: { password?: string },
): EmailTransportAdapter {
  switch (account.auth.type) {
    case "oauth2-graph": {
      return new GraphTransportAdapter({
        getAccessToken: async () => {
          const tokens = await ensureValidAccessToken(
            account.emailAddress,
            "microsoft",
          );
          return tokens.accessToken;
        },
      });
    }
    case "oauth2-gmail": {
      return new GmailTransportAdapter({
        getAccessToken: async () => {
          const tokens = await ensureValidAccessToken(
            account.emailAddress,
            "google",
          );
          return tokens.accessToken;
        },
      });
    }
    default: {
      if (!account.imap) throw new Error("IMAP configuration required for password auth");
      if (!options?.password) throw new Error("Password required for IMAP auth");
      return new ImapTransportAdapter({
        user: account.emailAddress,
        password: options.password,
        host: account.imap.host,
        port: account.imap.port,
        tls: account.imap.tls,
      });
    }
  }
}
