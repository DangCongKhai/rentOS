import { request } from "@/lib/http/client";
import type { CurrentUser } from "./types";

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await request<void>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<void> {
  await request<void>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await request<void>("/logout", { method: "POST", body: "{}" });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>("/api/v1/me");
}

export async function updateProfile(input: {
  name: string;
  phone: string | null;
}): Promise<CurrentUser> {
  return request<CurrentUser>("/api/v1/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updatePassword(input: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await request<void>("/user/password", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function resendVerification(): Promise<void> {
  await request<void>("/email/verification-notification", {
    method: "POST",
    body: "{}",
  });
}

export async function forgotPassword(input: {
  email: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resetPassword(input: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
