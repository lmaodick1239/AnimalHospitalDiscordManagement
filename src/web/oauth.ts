const API = "https://discord.com/api/v10";

export function authorizeUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({ response_type: "code", client_id: opts.clientId, scope: "identify guilds", redirect_uri: opts.redirectUri, state: opts.state });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

async function discordFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, init);
}

export async function exchangeCode(opts: { clientId: string; clientSecret: string; redirectUri: string; code: string }): Promise<{ accessToken: string }> {
  const response = await discordFetch("/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: opts.code, redirect_uri: opts.redirectUri, client_id: opts.clientId, client_secret: opts.clientSecret }) });
  if (!response.ok) throw new Error(`oauth token exchange failed: ${response.status}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("oauth token exchange returned no token");
  return { accessToken: data.access_token };
}

export async function fetchMe(accessToken: string): Promise<{ id: string; username: string; globalName: string | null }> {
  const response = await discordFetch("/users/@me", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`oauth user lookup failed: ${response.status}`);
  const data = await response.json() as { id: string; username: string; global_name?: string | null };
  return { id: data.id, username: data.username, globalName: data.global_name ?? null };
}

export async function fetchUserGuilds(accessToken: string): Promise<{ id: string; name: string }[]> {
  const response = await discordFetch("/users/@me/guilds", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`oauth guild lookup failed: ${response.status}`);
  return (await response.json() as { id: string; name: string }[]).map(({ id, name }) => ({ id, name }));
}

export async function fetchMemberDisplayName(opts: { botToken: string; guildId: string; userId: string }): Promise<string | null> {
  const response = await discordFetch(`/guilds/${opts.guildId}/members/${opts.userId}`, { headers: { Authorization: `Bot ${opts.botToken}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`member lookup failed: ${response.status}`);
  const data = await response.json() as { nick?: string | null; user?: { global_name?: string | null; username?: string } };
  return data.nick ?? data.user?.global_name ?? data.user?.username ?? null;
}
