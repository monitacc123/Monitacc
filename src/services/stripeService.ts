import { supabase } from '../lib/supabase';

export const STRIPE_PRICE_IDS = {
  Starter: 'price_1TN805AWhTSR0PgOln3BX8V5',
  Growth: 'price_1TN806AWhTSR0PgO52mdKu32',
  Ultimate: 'price_1TN806AWhTSR0PgOSQ9JyXsK',
} as const;

export type PaidPlan = keyof typeof STRIPE_PRICE_IDS;

export async function createCheckoutSession(plan: PaidPlan, accessToken?: string | null): Promise<string> {
  let token = accessToken;
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sila log masuk terlebih dahulu');
    token = session.access_token;
  }

  const baseUrl = window.location.origin;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        price_id: STRIPE_PRICE_IDS[plan],
        success_url: `${baseUrl}/?payment=success&plan=${plan}`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        mode: 'subscription',
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Gagal mencipta sesi pembayaran');
  if (!data.url) throw new Error('Tiada URL pembayaran diterima');

  return data.url;
}
