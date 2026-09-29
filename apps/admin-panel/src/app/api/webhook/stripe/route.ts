import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (!signature || !endpointSecret) {
      console.warn("⚠️ Stripe webhook secret not configured. Operating in insecure mode for local testing.");
      event = JSON.parse(payload);
    } else {
      event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    }
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`💰 PaymentIntent status: ${paymentIntent.status}`);
      
      const orderId = paymentIntent.metadata.orderId;
      console.log(`✅ Order ${orderId} has been successfully paid!`);
      
      // TODO: AWS Celery/RabbitMQ integration goes here!
      // Example: 
      // await publishToRabbitMQ('order.paid', { orderId, amount: paymentIntent.amount });
      // OR update Supabase directly:
      // await supabase.from('orders').update({ status: 'accepted' }).eq('id', orderId);
      
      break;
      
    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed: ${failedIntent.last_payment_error?.message}`);
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
