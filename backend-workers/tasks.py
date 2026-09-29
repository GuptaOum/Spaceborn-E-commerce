import os
from celery import Celery
from supabase import create_client, Client
import time

# RabbitMQ configuration
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/')
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Supabase configuration
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

app = Celery('spaceborn_tasks', broker=RABBITMQ_URL, backend=REDIS_URL)

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Warning: Supabase credentials not found. Running in mock mode.")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

@app.task(bind=True, max_retries=3)
def process_new_order(self, order_id: str):
    """
    Handles background processing for a newly placed order.
    - Validates inventory in Supabase
    - Triggers push notification to Vendor
    - Initiates Rider search mechanism
    """
    print(f"[Spaceborn Worker] Processing new order: {order_id}")
    supabase = get_supabase()
    
    try:
        # Simulate processing delay
        time.sleep(2)
        
        if supabase:
            # 1. Update order status to 'PROCESSING'
            response = supabase.table('orders').update({'status': 'PROCESSING'}).eq('id', order_id).execute()
            print(f"[Spaceborn Worker] Order {order_id} marked as processing.")
            
            # 2. Trigger vendor notification logic (mocked)
            # send_firebase_notification(vendor_id, "New Order Received!")
            
            # 3. Schedule next step: Fleet dispatch
            dispatch_rider.apply_async(args=[order_id], countdown=10)
        else:
            print(f"[Spaceborn Worker] (Mock) Processed order: {order_id}")
            
        return {'status': 'success', 'order_id': order_id}
        
    except Exception as exc:
        print(f"[Spaceborn Worker] Error processing order {order_id}: {exc}")
        self.retry(exc=exc, countdown=5)

@app.task
def dispatch_rider(order_id: str):
    """
    Simulates finding a delivery rider via a geospatial query in Redis/Supabase.
    """
    print(f"[Spaceborn Worker] Dispatching rider for order: {order_id}")
    
    supabase = get_supabase()
    if supabase:
        supabase.table('orders').update({'status': 'RIDER_ASSIGNED', 'rider_id': 'mock-rider-789'}).eq('id', order_id).execute()
        
    return {'status': 'rider_assigned', 'order_id': order_id}
