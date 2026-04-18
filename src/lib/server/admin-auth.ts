export interface AdminAuthConfig {
  username: string | null;
  password: string | null;
  enabled: boolean;
}

function normalizeSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getAdminAuthConfig(env: NodeJS.ProcessEnv = process.env): AdminAuthConfig {
  const username = normalizeSecret(env.OWCS_ADMIN_USERNAME);
  const password = normalizeSecret(env.OWCS_ADMIN_PASSWORD);
  const envName = env.OWCS_ENV_NAME ?? env.NODE_ENV ?? "development";
  const productionLike = envName === "production";

  return {
    username,
    password,
    enabled: productionLike
  };
}

export function decodeBasicAuthHeader(value: string | null): {
  username: string;
  password: string;
} | null {
  if (!value?.startsWith("Basic ")) {
    return null;
  }

  const encoded = value.slice("Basic ".length).trim();

  if (!encoded) {
    return null;
  }

  try {
    const decoded =
      typeof atob === "function"
        ? atob(encoded)
        : Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function secureEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function isAuthorizedAdminRequest(
  authorizationHeader: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const config = getAdminAuthConfig(env);

  if (!config.enabled) {
    return true;
  }

  if (!config.username || !config.password) {
    return false;
  }

  const credentials = decodeBasicAuthHeader(authorizationHeader);

  if (!credentials) {
    return false;
  }

  return secureEqual(credentials.username, config.username) && secureEqual(credentials.password, config.password);
}
