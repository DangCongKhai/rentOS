export type NewlyCreatedToken = {
  name: string;
  plainTextToken: string;
};

let newlyCreatedToken: NewlyCreatedToken | null = null;

export function saveNewlyCreatedToken(token: NewlyCreatedToken): void {
  newlyCreatedToken = token;
}

export function getNewlyCreatedToken(): NewlyCreatedToken | null {
  return newlyCreatedToken;
}

export function clearNewlyCreatedToken(): void {
  newlyCreatedToken = null;
}
