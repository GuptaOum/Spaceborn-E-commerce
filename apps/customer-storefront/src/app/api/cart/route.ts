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

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    let { data: cartData } = await supabase.from('carts').select('id').eq('user_id', userId).eq('status', 'active').single();
    
    if (!cartData) {
      const { data: newCart } = await supabase.from('carts').insert([{ user_id: userId, status: 'active' }]).select().single();
      cartData = newCart;
    }
    
    if (cartData) {
      const { data: items } = await supabase.from('cart_items').select('*, product:products(*)').eq('cart_id', cartData.id);
      return NextResponse.json({ cartId: cartData.id, items });
    }
    
    return NextResponse.json({ cartId: null, items: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split('Bearer ')[1];
    await auth.verifyIdToken(token);
    
    const { cartId, items } = await req.json();
    
    // Wipe existing
    await supabase.from('cart_items').delete().eq('cart_id', cartId);
    
    // Insert new
    if (items && items.length > 0) {
      const inserts = items.map((i: any) => ({ cart_id: cartId, product_id: i.product.id, quantity: i.quantity }));
      await supabase.from('cart_items').insert(inserts);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
