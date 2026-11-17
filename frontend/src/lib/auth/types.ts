export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  is_admin: boolean;
};
