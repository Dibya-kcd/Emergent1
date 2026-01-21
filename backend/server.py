from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Socket.IO for real-time updates
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Helper function to convert ObjectId to string
def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

# ==================== Models ====================

class MenuItem(BaseModel):
    id: Optional[str] = None
    name: str
    category: str
    price: float
    emoji: Optional[str] = "🍽️"
    image: Optional[str] = None
    stock: int = 0
    soldOut: bool = False
    description: Optional[str] = ""
    modifiers: List[Dict[str, Any]] = []
    specialFlags: List[str] = []
    ingredients: List[Dict[str, Any]] = []  # {ingredientId, quantity, unit}
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class Table(BaseModel):
    id: Optional[str] = None
    tableNumber: int
    capacity: int
    status: str = "available"
    currentOrder: Optional[str] = None
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class OrderItem(BaseModel):
    menuItemId: str
    name: str
    quantity: int
    price: float
    modifiers: List[str] = []
    instructions: Optional[str] = ""

class Order(BaseModel):
    id: Optional[str] = None
    orderType: str
    tableNumber: Optional[int] = None
    tokenNumber: Optional[int] = None
    items: List[OrderItem]
    status: str = "pending"
    subtotal: float
    tax: float = 0
    total: float
    paymentMethod: Optional[str] = None
    paymentStatus: str = "unpaid"
    kotSent: bool = False
    syncStatus: str = "synced"  # synced, pending, failed
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class KOTBatch(BaseModel):
    id: Optional[str] = None
    orderId: str
    orderType: str
    tableNumber: Optional[int] = None
    tokenNumber: Optional[int] = None
    items: List[OrderItem]
    status: str = "pending"
    printerUsed: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class Employee(BaseModel):
    id: Optional[str] = None
    name: str
    role: str
    pin: str
    phone: Optional[str] = ""
    salary: float = 0
    photo: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class Expense(BaseModel):
    id: Optional[str] = None
    category: str
    amount: float
    description: Optional[str] = ""
    date: datetime = Field(default_factory=datetime.utcnow)

class Inventory(BaseModel):
    id: Optional[str] = None
    name: str
    category: str
    unit: str
    stock: float
    minThreshold: float = 0
    lowStock: bool = False
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class InventoryTransaction(BaseModel):
    id: Optional[str] = None
    inventoryId: str
    type: str  # deduct, refill, wastage, adjustment
    quantity: float
    reason: Optional[str] = ""
    orderId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class Settings(BaseModel):
    id: Optional[str] = None
    restaurantName: str = "RestoPOS"
    currency: str = "₹"
    taxRate: float = 0.05
    printers: List[Dict[str, Any]] = []
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class Printer(BaseModel):
    id: str
    name: str
    type: str  # bluetooth, network
    address: str  # MAC address or IP
    role: str  # KOT, Bill, Both
    isDefault: bool = False
    lastConnected: Optional[datetime] = None

# ==================== Socket.IO Events ====================

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    await sio.emit('connected', {'status': 'success'}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def subscribe_orders(sid):
    await sio.enter_room(sid, 'orders')
    print(f"Client {sid} subscribed to orders")

@sio.event
async def subscribe_kitchen(sid):
    await sio.enter_room(sid, 'kitchen')
    print(f"Client {sid} subscribed to kitchen")

async def broadcast_order_update(order):
    await sio.emit('order_updated', serialize_doc(order), room='orders')

async def broadcast_kot_update(kot):
    await sio.emit('kot_updated', serialize_doc(kot), room='kitchen')

async def broadcast_table_update(table):
    await sio.emit('table_updated', serialize_doc(table), room='orders')

# ==================== Menu Endpoints ====================

@api_router.get("/menu")
async def get_menu():
    try:
        items = await db.menu_items.find().to_list(1000)
        return [serialize_doc(item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/menu")
async def create_menu_item(item: MenuItem):
    try:
        item_dict = item.dict(exclude={'id'})
        result = await db.menu_items.insert_one(item_dict)
        item_dict['_id'] = str(result.inserted_id)
        return serialize_doc(item_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/menu/{item_id}")
async def update_menu_item(item_id: str, item: MenuItem):
    try:
        item_dict = item.dict(exclude={'id'})
        await db.menu_items.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item_dict}
        )
        item_dict['_id'] = item_id
        return serialize_doc(item_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str):
    try:
        await db.menu_items.delete_one({"_id": ObjectId(item_id)})
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Tables Endpoints ====================

@api_router.get("/tables")
async def get_tables():
    try:
        tables = await db.tables.find().to_list(100)
        if not tables:
            default_tables = [
                {"tableNumber": i, "capacity": 4, "status": "available", "currentOrder": None, "updatedAt": datetime.utcnow()}
                for i in range(1, 21)
            ]
            await db.tables.insert_many(default_tables)
            tables = await db.tables.find().to_list(100)
        return [serialize_doc(table) for table in tables]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/tables/{table_id}")
async def update_table(table_id: str, table: Table):
    try:
        table_dict = table.dict(exclude={'id'})
        table_dict['updatedAt'] = datetime.utcnow()
        await db.tables.update_one(
            {"_id": ObjectId(table_id)},
            {"$set": table_dict}
        )
        table_dict['_id'] = table_id
        updated_table = serialize_doc(table_dict)
        await broadcast_table_update(updated_table)
        return updated_table
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Orders Endpoints ====================

@api_router.get("/orders")
async def get_orders(status: Optional[str] = None, limit: int = 100):
    try:
        query = {}
        if status:
            query['status'] = status
        orders = await db.orders.find(query).sort("createdAt", -1).to_list(limit)
        return [serialize_doc(order) for order in orders]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return serialize_doc(order)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders")
async def create_order(order: Order):
    try:
        order_dict = order.dict(exclude={'id'})
        
        # Generate token number for takeout
        if order.orderType == "takeout" and not order.tokenNumber:
            last_order = await db.orders.find_one(
                {"orderType": "takeout"},
                sort=[("tokenNumber", -1)]
            )
            order_dict['tokenNumber'] = (last_order.get('tokenNumber', 0) + 1) if last_order else 1
        
        result = await db.orders.insert_one(order_dict)
        order_dict['_id'] = str(result.inserted_id)
        
        # Update table status if dine-in
        if order.orderType == "dine-in" and order.tableNumber:
            await db.tables.update_one(
                {"tableNumber": order.tableNumber},
                {"$set": {"status": "occupied", "currentOrder": str(result.inserted_id)}}
            )
        
        # Deduct inventory for ingredients
        for item in order.items:
            menu_item = await db.menu_items.find_one({"_id": ObjectId(item.menuItemId)})
            if menu_item and menu_item.get('ingredients'):
                for ingredient in menu_item['ingredients']:
                    # Deduct stock
                    await db.inventory.update_one(
                        {"_id": ObjectId(ingredient['ingredientId'])},
                        {"$inc": {"stock": -ingredient['quantity'] * item.quantity}}
                    )
                    # Log transaction
                    await db.inventory_transactions.insert_one({
                        "inventoryId": ingredient['ingredientId'],
                        "type": "deduct",
                        "quantity": ingredient['quantity'] * item.quantity,
                        "reason": f"Order {str(result.inserted_id)}",
                        "orderId": str(result.inserted_id),
                        "createdAt": datetime.utcnow()
                    })
        
        created_order = serialize_doc(order_dict)
        await broadcast_order_update(created_order)
        return created_order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/orders/{order_id}")
async def update_order(order_id: str, order: Order):
    try:
        order_dict = order.dict(exclude={'id'})
        order_dict['updatedAt'] = datetime.utcnow()
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": order_dict}
        )
        order_dict['_id'] = order_id
        updated_order = serialize_doc(order_dict)
        await broadcast_order_update(updated_order)
        return updated_order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if order and order.get('orderType') == 'dine-in':
            await db.tables.update_one(
                {"tableNumber": order.get('tableNumber')},
                {"$set": {"status": "available", "currentOrder": None}}
            )
        
        await db.orders.delete_one({"_id": ObjectId(order_id)})
        await sio.emit('order_deleted', {'orderId': order_id}, room='orders')
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== KOT Endpoints ====================

@api_router.get("/kot")
async def get_kot_batches(status: Optional[str] = None):
    try:
        query = {}
        if status:
            query['status'] = status
        kots = await db.kot_batches.find(query).sort("createdAt", -1).to_list(1000)
        return [serialize_doc(kot) for kot in kots]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/kot")
async def create_kot(kot: KOTBatch):
    try:
        kot_dict = kot.dict(exclude={'id'})
        result = await db.kot_batches.insert_one(kot_dict)
        kot_dict['_id'] = str(result.inserted_id)
        
        # Update order
        await db.orders.update_one(
            {"_id": ObjectId(kot.orderId)},
            {"$set": {"kotSent": True, "status": "preparing"}}
        )
        
        created_kot = serialize_doc(kot_dict)
        await broadcast_kot_update(created_kot)
        return created_kot
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/kot/{kot_id}")
async def update_kot(kot_id: str, kot: KOTBatch):
    try:
        kot_dict = kot.dict(exclude={'id'})
        await db.kot_batches.update_one(
            {"_id": ObjectId(kot_id)},
            {"$set": kot_dict}
        )
        kot_dict['_id'] = kot_id
        updated_kot = serialize_doc(kot_dict)
        await broadcast_kot_update(updated_kot)
        return updated_kot
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Takeout Endpoints ====================

@api_router.get("/takeout/next-token")
async def get_next_token():
    try:
        last_order = await db.orders.find_one(
            {"orderType": "takeout"},
            sort=[("tokenNumber", -1)]
        )
        next_token = (last_order.get('tokenNumber', 0) + 1) if last_order else 1
        return {"nextToken": next_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Employees Endpoints ====================

@api_router.get("/employees")
async def get_employees():
    try:
        employees = await db.employees.find().to_list(100)
        return [serialize_doc(emp) for emp in employees]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/employees")
async def create_employee(employee: Employee):
    try:
        employee_dict = employee.dict(exclude={'id'})
        result = await db.employees.insert_one(employee_dict)
        employee_dict['_id'] = str(result.inserted_id)
        return serialize_doc(employee_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/login")
async def login(data: dict):
    try:
        pin = data.get('pin')
        employee = await db.employees.find_one({"pin": pin})
        if not employee:
            raise HTTPException(status_code=401, detail="Invalid PIN")
        return serialize_doc(employee)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Expenses Endpoints ====================

@api_router.get("/expenses")
async def get_expenses(start_date: Optional[str] = None, end_date: Optional[str] = None):
    try:
        query = {}
        if start_date and end_date:
            query["date"] = {
                "$gte": datetime.fromisoformat(start_date),
                "$lte": datetime.fromisoformat(end_date)
            }
        expenses = await db.expenses.find(query).sort("date", -1).to_list(1000)
        return [serialize_doc(exp) for exp in expenses]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/expenses")
async def create_expense(expense: Expense):
    try:
        expense_dict = expense.dict(exclude={'id'})
        result = await db.expenses.insert_one(expense_dict)
        expense_dict['_id'] = str(result.inserted_id)
        return serialize_doc(expense_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Inventory Endpoints ====================

@api_router.get("/inventory")
async def get_inventory():
    try:
        items = await db.inventory.find().to_list(1000)
        # Check for low stock
        for item in items:
            if item['stock'] <= item.get('minThreshold', 0):
                await db.inventory.update_one(
                    {"_id": item['_id']},
                    {"$set": {"lowStock": True}}
                )
                item['lowStock'] = True
        return [serialize_doc(item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/inventory")
async def create_inventory_item(item: Inventory):
    try:
        item_dict = item.dict(exclude={'id'})
        item_dict['lowStock'] = item_dict['stock'] <= item_dict.get('minThreshold', 0)
        result = await db.inventory.insert_one(item_dict)
        item_dict['_id'] = str(result.inserted_id)
        return serialize_doc(item_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/inventory/{item_id}")
async def update_inventory_item(item_id: str, item: Inventory):
    try:
        item_dict = item.dict(exclude={'id'})
        item_dict['updatedAt'] = datetime.utcnow()
        item_dict['lowStock'] = item_dict['stock'] <= item_dict.get('minThreshold', 0)
        await db.inventory.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item_dict}
        )
        item_dict['_id'] = item_id
        return serialize_doc(item_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/inventory/{item_id}/adjust")
async def adjust_inventory(item_id: str, data: dict):
    try:
        adjustment_type = data.get('type')  # refill, wastage, adjustment
        quantity = data.get('quantity', 0)
        reason = data.get('reason', '')
        
        # Update stock
        multiplier = 1 if adjustment_type in ['refill', 'adjustment'] else -1
        await db.inventory.update_one(
            {"_id": ObjectId(item_id)},
            {"$inc": {"stock": quantity * multiplier}}
        )
        
        # Log transaction
        await db.inventory_transactions.insert_one({
            "inventoryId": item_id,
            "type": adjustment_type,
            "quantity": quantity,
            "reason": reason,
            "createdAt": datetime.utcnow()
        })
        
        # Get updated item
        item = await db.inventory.find_one({"_id": ObjectId(item_id)})
        return serialize_doc(item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/inventory/{item_id}/transactions")
async def get_inventory_transactions(item_id: str, limit: int = 50):
    try:
        transactions = await db.inventory_transactions.find(
            {"inventoryId": item_id}
        ).sort("createdAt", -1).to_list(limit)
        return [serialize_doc(t) for t in transactions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Settings Endpoints ====================

@api_router.get("/settings")
async def get_settings():
    try:
        settings = await db.settings.find_one()
        if not settings:
            default_settings = {
                "restaurantName": "RestoPOS",
                "currency": "₹",
                "taxRate": 0.05,
                "printers": [],
                "updatedAt": datetime.utcnow()
            }
            result = await db.settings.insert_one(default_settings)
            settings = await db.settings.find_one({"_id": result.inserted_id})
        return serialize_doc(settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings")
async def update_settings(settings: Settings):
    try:
        settings_dict = settings.dict(exclude={'id'})
        settings_dict['updatedAt'] = datetime.utcnow()
        existing = await db.settings.find_one()
        if existing:
            await db.settings.update_one(
                {"_id": existing['_id']},
                {"$set": settings_dict}
            )
            settings_dict['_id'] = str(existing['_id'])
        else:
            result = await db.settings.insert_one(settings_dict)
            settings_dict['_id'] = str(result.inserted_id)
        return serialize_doc(settings_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Printers Endpoints ====================

@api_router.post("/printers")
async def add_printer(printer: Printer):
    try:
        settings = await db.settings.find_one()
        if not settings:
            settings = {"printers": []}
        
        printer_dict = printer.dict()
        printer_dict['lastConnected'] = datetime.utcnow()
        
        printers = settings.get('printers', [])
        printers.append(printer_dict)
        
        await db.settings.update_one(
            {},
            {"$set": {"printers": printers}},
            upsert=True
        )
        
        return {"success": True, "printer": printer_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/printers")
async def get_printers():
    try:
        settings = await db.settings.find_one()
        return settings.get('printers', []) if settings else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/printers/{printer_id}")
async def delete_printer(printer_id: str):
    try:
        settings = await db.settings.find_one()
        if settings:
            printers = [p for p in settings.get('printers', []) if p['id'] != printer_id]
            await db.settings.update_one(
                {"_id": settings['_id']},
                {"$set": {"printers": printers}}
            )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Reports Endpoints ====================

@api_router.get("/reports/sales")
async def get_sales_report(start_date: Optional[str] = None, end_date: Optional[str] = None):
    try:
        query = {"paymentStatus": "paid"}
        if start_date and end_date:
            query["createdAt"] = {
                "$gte": datetime.fromisoformat(start_date),
                "$lte": datetime.fromisoformat(end_date)
            }
        
        orders = await db.orders.find(query).to_list(10000)
        
        total_sales = sum(order.get('total', 0) for order in orders)
        total_orders = len(orders)
        total_tax = sum(order.get('tax', 0) for order in orders)
        
        # Category breakdown
        category_sales = defaultdict(float)
        for order in orders:
            for item in order.get('items', []):
                menu_item = await db.menu_items.find_one({"_id": ObjectId(item['menuItemId'])})
                if menu_item:
                    category_sales[menu_item['category']] += item['price'] * item['quantity']
        
        # Top items
        item_sales = defaultdict(lambda: {'name': '', 'quantity': 0, 'revenue': 0})
        for order in orders:
            for item in order.get('items', []):
                item_sales[item['menuItemId']]['name'] = item['name']
                item_sales[item['menuItemId']]['quantity'] += item['quantity']
                item_sales[item['menuItemId']]['revenue'] += item['price'] * item['quantity']
        
        top_items = sorted(item_sales.values(), key=lambda x: x['revenue'], reverse=True)[:10]
        
        return {
            "totalSales": total_sales,
            "totalOrders": total_orders,
            "totalTax": total_tax,
            "averageOrderValue": total_sales / total_orders if total_orders > 0 else 0,
            "categorySales": dict(category_sales),
            "topItems": top_items,
            "orders": [serialize_doc(order) for order in orders[:100]]  # Limit for performance
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports/kitchen-performance")
async def get_kitchen_performance():
    try:
        # Get KOTs from last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        kots = await db.kot_batches.find(
            {"createdAt": {"$gte": yesterday}}
        ).to_list(10000)
        
        total_kots = len(kots)
        completed = len([k for k in kots if k['status'] == 'completed'])
        pending = len([k for k in kots if k['status'] == 'pending'])
        preparing = len([k for k in kots if k['status'] == 'preparing'])
        
        return {
            "totalKOTs": total_kots,
            "completed": completed,
            "pending": pending,
            "preparing": preparing,
            "completionRate": (completed / total_kots * 100) if total_kots > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports/inventory-status")
async def get_inventory_status():
    try:
        items = await db.inventory.find().to_list(1000)
        
        low_stock_items = [serialize_doc(i) for i in items if i['stock'] <= i.get('minThreshold', 0)]
        total_value = sum(i['stock'] * i.get('price', 0) for i in items if 'price' in i)
        
        return {
            "totalItems": len(items),
            "lowStockItems": low_stock_items,
            "lowStockCount": len(low_stock_items),
            "totalValue": total_value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Live Dashboard ====================

@api_router.get("/dashboard/live")
async def get_live_dashboard():
    try:
        # Active orders
        active_orders = await db.orders.find(
            {"status": {"$in": ["pending", "preparing", "ready"]}}
        ).to_list(100)
        
        # Pending KOTs
        pending_kots = await db.kot_batches.find(
            {"status": {"$in": ["pending", "preparing"]}}
        ).to_list(100)
        
        # Occupied tables
        occupied_tables = await db.tables.find(
            {"status": {"$ne": "available"}}
        ).to_list(100)
        
        # Today's stats
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_orders = await db.orders.find(
            {"createdAt": {"$gte": today_start}}
        ).to_list(10000)
        
        today_revenue = sum(o.get('total', 0) for o in today_orders if o.get('paymentStatus') == 'paid')
        
        return {
            "activeOrders": [serialize_doc(o) for o in active_orders],
            "pendingKOTs": [serialize_doc(k) for k in pending_kots],
            "occupiedTables": [serialize_doc(t) for t in occupied_tables],
            "todayStats": {
                "totalOrders": len(today_orders),
                "revenue": today_revenue,
                "averageOrder": today_revenue / len(today_orders) if today_orders else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "RestoPOS API v2.0", "features": ["Real-time", "Offline Sync", "Multi-Printer", "Analytics"]}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
