const amqp = require('amqplib');
const Redis = require('ioredis');
const Redlock = require('redlock').default;
const { createClient } = require('@supabase/supabase-js');

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const redis = new Redis(REDIS_URL);
const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function processOrder(orderMessage) {
  const { orderId, items, customerId } = orderMessage;
  console.log(`[x] Processing order ${orderId} for customer ${customerId}`);

  const locks = [];
  try {
    // 1. Acquire distributed locks for all items in the order to prevent overselling
    // We sort item IDs to prevent deadlocks when concurrent orders ask for the same items
    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    
    for (const item of sortedItems) {
      const lockKey = `lock:product:${item.productId}`;
      console.log(`Acquiring lock for ${lockKey}...`);
      const lock = await redlock.acquire([lockKey], 5000);
      locks.push(lock);
    }

    // 2. Check inventory in Supabase
    let canFulfill = true;
    for (const item of items) {
      const { data, error } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .single();
        
      if (error || !data || data.stock < item.quantity) {
        console.error(`Insufficient stock for product ${item.productId}`);
        canFulfill = false;
        break;
      }
    }

    if (!canFulfill) {
      console.log(`[!] Order ${orderId} failed due to insufficient stock.`);
      await supabase.from('orders').update({ status: 'failed_inventory' }).eq('id', orderId);
      return;
    }

    // 3. Deduct inventory atomically
    for (const item of items) {
      // Swiggy/Zomato style: decrement stock directly using RPC or safe update
      const { data, error } = await supabase.rpc('decrement_stock', {
        p_id: item.productId,
        qty: item.quantity
      });
      if (error) {
        throw new Error(`Failed to deduct stock for ${item.productId}: ${error.message}`);
      }
    }

    // 4. Update order status to 'processing' (sent to vendor)
    await supabase.from('orders').update({ status: 'processing' }).eq('id', orderId);
    console.log(`[v] Order ${orderId} successfully processed and inventory deducted.`);
    
  } catch (err) {
    console.error(`[X] Error processing order ${orderId}:`, err);
    await supabase.from('orders').update({ status: 'failed_system' }).eq('id', orderId);
  } finally {
    // Release all locks
    for (const lock of locks) {
      try {
        await lock.release();
      } catch (e) {
        console.error('Failed to release lock:', e);
      }
    }
  }
}

async function startWorker() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    const queue = 'orders_queue';
    await channel.assertQueue(queue, { durable: true });
    
    // Only process one order at a time per worker instance
    channel.prefetch(1);
    
    console.log(`[*] Waiting for orders in ${queue}. To exit press CTRL+C`);
    
    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const orderData = JSON.parse(msg.content.toString());
        await processOrder(orderData);
        channel.ack(msg);
      }
    }, { noAck: false });
    
  } catch (err) {
    console.error('RabbitMQ Connection Error:', err);
    setTimeout(startWorker, 5000); // Retry connection
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.");
  process.exit(1);
}

startWorker();
