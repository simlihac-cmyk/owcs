import {
  decodeBasicAuthHeader,
  getAdminAuthConfig,
  isAuthorizedAdminRequest
} from "@/lib/server/admin-auth";

describe("admin auth helpers", () => {
  it("enables admin auth in production-like environments", () => {
    expect(
      getAdminAuthConfig({
        OWCS_ENV_NAME: "production",
        OWCS_ADMIN_USERNAME: "admin",
        OWCS_ADMIN_PASSWORD: "secret"
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({
      username: "admin",
      password: "secret",
      enabled: true
    });
  });

  it("decodes valid basic auth headers", () => {
    const header = `Basic ${Buffer.from("admin:secret").toString("base64")}`;

    expect(decodeBasicAuthHeader(header)).toEqual({
      username: "admin",
      password: "secret"
    });
  });

  it("accepts matching credentials and rejects others", () => {
    const env = {
      OWCS_ENV_NAME: "production",
      OWCS_ADMIN_USERNAME: "admin",
      OWCS_ADMIN_PASSWORD: "secret"
    } as unknown as NodeJS.ProcessEnv;
    const validHeader = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    const invalidHeader = `Basic ${Buffer.from("admin:nope").toString("base64")}`;

    expect(isAuthorizedAdminRequest(validHeader, env)).toBe(true);
    expect(isAuthorizedAdminRequest(invalidHeader, env)).toBe(false);
    expect(isAuthorizedAdminRequest(null, env)).toBe(false);
  });

  it("does not enforce auth outside production-like environments", () => {
    expect(
      isAuthorizedAdminRequest(null, {
        OWCS_ENV_NAME: "development"
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});
