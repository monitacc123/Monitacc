import { supabase } from '../lib/supabase';

export const STRIPE_PRODUCT_IDS = {
  Starter: 'prod_ULpX4LtYc0l5PO',
  Growth: 'prod_ULpX2O1F3RgyKE',
  Ultimate: 'prod_ULpXjF1N7a9rKP',
} as const;

export type PaidPlan = keyof typeof STRIPE_PRODUCT_IDS;

export async function openCustomerPortal(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sila log masuk terlebih dahulu');

  const returnUrl = `${window.location.origin}/?view=plans`;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-customer-portal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ return_url: returnUrl }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Gagal membuka portal pengurusan');
  if (!data.url) throw new Error('Tiada URL portal diterima');

  return data.url;
}

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
        product_id: STRIPE_PRODUCT_IDS[plan],
        success_url: `${baseUrl}/?payment=success&plan=${plan}`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        mode: 'subscription',
      }),
    }
  );

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Gagal mencipta sesi pembayaran (HTTP ${response.status})`);
  }
  if (!response.ok) throw new Error(data?.error || `Gagal mencipta sesi pembayaran (HTTP ${response.status})`);
  if (!data.url) throw new Error('Tiada URL pembayaran diterima');

  return data.url;
}
