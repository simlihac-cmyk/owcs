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

  return credentials.username === config.username && credentials.password === config.password;
}
