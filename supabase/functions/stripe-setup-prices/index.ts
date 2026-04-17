import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: { name: 'Monitacc', version: '1.0.0' },
});

const PRODUCT_ID = 'prod_ULpfJPERV2aEFm';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const plans = [
      { planKey: 'Starter', amount: 5000, currency: 'myr', nickname: 'Monitacc Starter' },
      { planKey: 'Growth', amount: 10000, currency: 'myr', nickname: 'Monitacc Growth' },
      { planKey: 'Ultimate', amount: 15000, currency: 'myr', nickname: 'Monitacc Ultimate' },
    ];

    const result: Record<string, string> = {};

    for (const plan of plans) {
      const existingPrices = await stripe.prices.list({
        product: PRODUCT_ID,
        active: true,
        limit: 100,
      });

      const found = existingPrices.data.find(
        (p) => p.metadata?.plan === plan.planKey && p.recurring?.interval === 'month'
      );

      let priceId: string;
      if (found) {
        priceId = found.id;
      } else {
        const price = await stripe.prices.create({
          product: PRODUCT_ID,
          unit_amount: plan.amount,
          currency: plan.currency,
          recurring: { interval: 'month' },
          nickname: plan.nickname,
          metadata: { plan: plan.planKey },
        });
        priceId = price.id;
      }

      result[plan.planKey] = priceId;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Setup error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
