export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase public environment is not configured.");
  return { url, key };
}

export function serverEnv() {
  const values = publicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  return { ...values, secret };
}
