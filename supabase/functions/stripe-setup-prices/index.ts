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

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const plans = [
      { name: 'Monitacc Starter', planKey: 'Starter', amount: 5000, currency: 'myr' },
      { name: 'Monitacc Growth', planKey: 'Growth', amount: 10000, currency: 'myr' },
      { name: 'Monitacc Ultimate', planKey: 'Ultimate', amount: 15000, currency: 'myr' },
    ];

    const result: Record<string, string> = {};

    for (const plan of plans) {
      const existingProducts = await stripe.products.search({
        query: `name:'${plan.name}' AND active:'true'`,
        limit: 1,
      });

      let productId: string;
      if (existingProducts.data.length > 0) {
        productId = existingProducts.data[0].id;
      } else {
        const product = await stripe.products.create({
          name: plan.name,
          metadata: { plan: plan.planKey },
        });
        productId = product.id;
      }

      const existingPrices = await stripe.prices.list({
        product: productId,
        active: true,
        recurring: { interval: 'month' },
        limit: 1,
      });

      let priceId: string;
      if (existingPrices.data.length > 0) {
        priceId = existingPrices.data[0].id;
      } else {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: plan.amount,
          currency: plan.currency,
          recurring: { interval: 'month' },
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
