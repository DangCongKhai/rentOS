export const tokenAbilities = [
  "account:read",
  "favourites:read",
  "favourites:write",
  "rental-requests:read",
] as const;

export type TokenAbility = (typeof tokenAbilities)[number];
export type PersonalAccessToken = {
  id: string;
  name: string;
  abilities: TokenAbility[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  status: "ACTIVE" | "EXPIRED";
};

export type CreatePersonalAccessTokenInput = {
  name: string;
  abilities: TokenAbility[];
  expires_at: string | null;
};

export type CreatedPersonalAccessToken = {
  message: string;
  data: PersonalAccessToken;
  plain_text_token: string;
};
