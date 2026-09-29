import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with the secret key placeholder
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency = 'inr', orderId, customerId } = body;

    // Validate the amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects amounts in cents/paise
      currency,
      metadata: {
        orderId: orderId || 'test_order',
        customerId: customerId || 'test_customer',
      },
      // In India, specific export rules might apply, so we enable automatic payment methods
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Stripe PaymentIntent Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
