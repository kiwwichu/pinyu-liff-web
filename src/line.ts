type VerifiedAccessToken = {
  client_id: string;
  expires_in: number;
};

export type VerifiedLineProfile = {
  userId: string;
  displayName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseVerifiedToken(value: unknown): VerifiedAccessToken | null {
  if (!isRecord(value)) return null;
  if (typeof value.client_id !== "string") return null;
  if (typeof value.expires_in !== "number") return null;
  return { client_id: value.client_id, expires_in: value.expires_in };
}

function parseLineProfile(value: unknown): VerifiedLineProfile | null {
  if (!isRecord(value) || typeof value.userId !== "string") return null;
  return {
    userId: value.userId,
    displayName: typeof value.displayName === "string" ? value.displayName.trim().slice(0, 100) : "",
  };
}

export async function getVerifiedLineProfile(
  accessToken: string,
  expectedChannelId: string,
): Promise<VerifiedLineProfile | null> {
  const verifyUrl = new URL("https://api.line.me/oauth2/v2.1/verify");
  verifyUrl.searchParams.set("access_token", accessToken);

  const verifyResponse = await fetch(verifyUrl, {
    headers: { Accept: "application/json" },
  });
  if (!verifyResponse.ok) return null;

  const verified = parseVerifiedToken(await verifyResponse.json());
  if (
    !verified ||
    verified.client_id !== expectedChannelId ||
    verified.expires_in <= 0
  ) {
    return null;
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!profileResponse.ok) return null;

  return parseLineProfile(await profileResponse.json());
}

export async function getVerifiedLineUserId(
  accessToken: string,
  expectedChannelId: string,
): Promise<string | null> {
  return (await getVerifiedLineProfile(accessToken, expectedChannelId))?.userId ?? null;
}
