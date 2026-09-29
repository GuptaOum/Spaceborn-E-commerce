import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = !getApps().length
  ? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
  : getApps()[0];

const auth = getAuth(app);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    
    const { cart, total, userId, shippingAddress } = await req.json();
    if (decoded.uid !== userId && userId !== 'guest-session') {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Insert Order
    const orderId = '00000000-0000-0000-0000-000000000000'.replace(/0/g, () => (~~(Math.random()*16)).toString(16));
    await supabase.from('orders').insert([{
      id: orderId,
      user_id: userId,
      total_amount: total,
      status: 'processing'
    }]);

    // Update Cart
    await supabase.from('carts').update({ status: 'checked_out' })
      .eq('user_id', userId).eq('status', 'active');

    // Safely Decrement Stock Using Service Key
    if (cart && Array.isArray(cart)) {
      for (const item of cart) {
        const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
        if (prodData) {
          const newStock = Math.max(0, prodData.stock - item.quantity);
          await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
        }
      }
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
