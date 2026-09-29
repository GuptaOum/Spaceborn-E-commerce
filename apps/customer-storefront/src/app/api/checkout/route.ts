import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();
    
    // Quick validation
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    // Connect to RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    const queue = 'orders_queue';
    await channel.assertQueue(queue, { durable: true });
    
    // Push the order to the queue
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(orderData)), {
      persistent: true // Ensure messages survive broker restarts
    });
    
    // Close connection
    setTimeout(() => {
      connection.close();
    }, 500);

    return NextResponse.json({ success: true, message: 'Order queued successfully' });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to process order' }, { status: 500 });
  }
}
