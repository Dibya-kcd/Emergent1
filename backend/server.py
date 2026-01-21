from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class Table(BaseModel):
    id: Optional[str] = None
    tableNumber: int
    capacity: int
    status: str = "available"  # available, occupied, preparing, serving, billing
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
    orderType: str  # dine-in, takeout
    tableNumber: Optional[int] = None
    tokenNumber: Optional[int] = None
    items: List[OrderItem]
    status: str = "pending"  # pending, preparing, ready, completed, cancelled
    subtotal: float
    tax: float = 0
    total: float
    paymentMethod: Optional[str] = None
    paymentStatus: str = "unpaid"  # unpaid, paid
    kotSent: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class KOTBatch(BaseModel):
    id: Optional[str] = None
    orderId: str
    orderType: str
    tableNumber: Optional[int] = None
    tokenNumber: Optional[int] = None
    items: List[OrderItem]
    status: str = "pending"  # pending, preparing, completed, cancelled
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
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class Settings(BaseModel):
    id: Optional[str] = None
    restaurantName: str = "RestoPOS"
    currency: str = "₹"
    taxRate: float = 0.05
    printers: List[Dict[str, Any]] = []
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

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
            # Initialize default tables
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
        return serialize_doc(table_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Orders Endpoints ====================

@api_router.get("/orders")
async def get_orders():
    try:
        orders = await db.orders.find().sort("createdAt", -1).to_list(1000)
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
        result = await db.orders.insert_one(order_dict)
        order_dict['_id'] = str(result.inserted_id)
        
        # Update table status if dine-in
        if order.orderType == "dine-in" and order.tableNumber:
            await db.tables.update_one(
                {"tableNumber": order.tableNumber},
                {"$set": {"status": "occupied", "currentOrder": str(result.inserted_id)}}
            )
        
        return serialize_doc(order_dict)
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
        return serialize_doc(order_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    try:
        # Get order to find table
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if order and order.get('orderType') == 'dine-in':
            # Free up table
            await db.tables.update_one(
                {"tableNumber": order.get('tableNumber')},
                {"$set": {"status": "available", "currentOrder": None}}
            )
        
        await db.orders.delete_one({"_id": ObjectId(order_id)})
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== KOT Endpoints ====================

@api_router.get("/kot")
async def get_kot_batches():
    try:
        kots = await db.kot_batches.find().sort("createdAt", -1).to_list(1000)
        return [serialize_doc(kot) for kot in kots]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/kot")
async def create_kot(kot: KOTBatch):
    try:
        kot_dict = kot.dict(exclude={'id'})
        result = await db.kot_batches.insert_one(kot_dict)
        kot_dict['_id'] = str(result.inserted_id)
        
        # Update order to mark KOT sent
        await db.orders.update_one(
            {"_id": ObjectId(kot.orderId)},
            {"$set": {"kotSent": True, "status": "preparing"}}
        )
        
        return serialize_doc(kot_dict)
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
        return serialize_doc(kot_dict)
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
async def get_expenses():
    try:
        expenses = await db.expenses.find().sort("date", -1).to_list(1000)
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
        return [serialize_doc(item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/inventory")
async def create_inventory_item(item: Inventory):
    try:
        item_dict = item.dict(exclude={'id'})
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
        await db.inventory.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item_dict}
        )
        item_dict['_id'] = item_id
        return serialize_doc(item_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Settings Endpoints ====================

@api_router.get("/settings")
async def get_settings():
    try:
        settings = await db.settings.find_one()
        if not settings:
            # Create default settings
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
        
        return {
            "totalSales": total_sales,
            "totalOrders": total_orders,
            "averageOrderValue": total_sales / total_orders if total_orders > 0 else 0,
            "orders": [serialize_doc(order) for order in orders]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "RestoPOS API", "version": "1.0"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
