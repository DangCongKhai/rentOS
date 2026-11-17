import { request } from "@/lib/http/client";
import type {
  CreatePersonalAccessTokenInput,
  CreatedPersonalAccessToken,
  PersonalAccessToken,
} from "./types";

export function listPersonalAccessTokens(): Promise<PersonalAccessToken[]> {
  return request<PersonalAccessToken[]>("/api/v1/personal-access-tokens");
}

export function createPersonalAccessToken(
  input: CreatePersonalAccessTokenInput,
): Promise<CreatedPersonalAccessToken> {
  return request<CreatedPersonalAccessToken>("/api/v1/personal-access-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokePersonalAccessToken(id: string): Promise<void> {
  return request<void>(`/api/v1/personal-access-tokens/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: "{}",
  });
}
