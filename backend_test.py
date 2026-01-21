#!/usr/bin/env python3
"""
RestoPOS Backend API Test Suite
Tests all backend endpoints with focus on critical order flow
"""

import requests
import json
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    base_url = line.split('=')[1].strip()
                    return f"{base_url}/api"
        return "http://localhost:8001/api"  # fallback
    except:
        return "http://localhost:8001/api"  # fallback

BASE_URL = get_backend_url()
print(f"Testing backend at: {BASE_URL}")

class RestoPOSAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_items = {
            'menu_items': [],
            'orders': [],
            'kot_batches': [],
            'employees': [],
            'expenses': [],
            'inventory': []
        }
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'RestoPOS' in data['message']:
                    self.log_result("Root Endpoint", True, "API root accessible")
                    return True
                else:
                    self.log_result("Root Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_result("Root Endpoint", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Root Endpoint", False, f"Connection error: {str(e)}")
        return False
        
    def test_get_menu(self):
        """Test GET /api/menu"""
        try:
            response = self.session.get(f"{self.base_url}/menu")
            if response.status_code == 200:
                menu_items = response.json()
                self.log_result("GET Menu", True, f"Retrieved {len(menu_items)} menu items")
                return menu_items
            else:
                self.log_result("GET Menu", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET Menu", False, f"Error: {str(e)}")
        return []
        
    def test_create_menu_item(self):
        """Test POST /api/menu"""
        try:
            new_item = {
                "name": "Butter Chicken",
                "category": "Main Course",
                "price": 299.0,
                "emoji": "🍛",
                "stock": 50,
                "soldOut": False,
                "description": "Creamy tomato-based chicken curry"
            }
            
            response = self.session.post(f"{self.base_url}/menu", json=new_item)
            if response.status_code == 200:
                created_item = response.json()
                if '_id' in created_item:
                    self.created_items['menu_items'].append(created_item['_id'])
                    self.log_result("POST Menu", True, f"Created menu item: {created_item['name']}")
                    return created_item
                else:
                    self.log_result("POST Menu", False, "No ID returned in response")
            else:
                self.log_result("POST Menu", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST Menu", False, f"Error: {str(e)}")
        return None
        
    def test_update_menu_item(self, item_id):
        """Test PUT /api/menu/{id}"""
        try:
            updated_item = {
                "name": "Butter Chicken Deluxe",
                "category": "Main Course", 
                "price": 349.0,
                "emoji": "🍛",
                "stock": 30,
                "soldOut": False,
                "description": "Premium creamy tomato-based chicken curry with extra butter"
            }
            
            response = self.session.put(f"{self.base_url}/menu/{item_id}", json=updated_item)
            if response.status_code == 200:
                updated = response.json()
                self.log_result("PUT Menu", True, f"Updated menu item: {updated.get('name', 'Unknown')}")
                return updated
            else:
                self.log_result("PUT Menu", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("PUT Menu", False, f"Error: {str(e)}")
        return None
        
    def test_delete_menu_item(self, item_id):
        """Test DELETE /api/menu/{id}"""
        try:
            response = self.session.delete(f"{self.base_url}/menu/{item_id}")
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_result("DELETE Menu", True, "Menu item deleted successfully")
                    return True
                else:
                    self.log_result("DELETE Menu", False, "Delete operation failed")
            else:
                self.log_result("DELETE Menu", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("DELETE Menu", False, f"Error: {str(e)}")
        return False
        
    def test_get_tables(self):
        """Test GET /api/tables"""
        try:
            response = self.session.get(f"{self.base_url}/tables")
            if response.status_code == 200:
                tables = response.json()
                available_tables = [t for t in tables if t.get('status') == 'available']
                self.log_result("GET Tables", True, f"Retrieved {len(tables)} tables, {len(available_tables)} available")
                return tables
            else:
                self.log_result("GET Tables", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET Tables", False, f"Error: {str(e)}")
        return []
        
    def test_get_orders(self):
        """Test GET /api/orders"""
        try:
            response = self.session.get(f"{self.base_url}/orders")
            if response.status_code == 200:
                orders = response.json()
                self.log_result("GET Orders", True, f"Retrieved {len(orders)} orders")
                return orders
            else:
                self.log_result("GET Orders", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET Orders", False, f"Error: {str(e)}")
        return []
        
    def test_create_order(self, menu_items, tables):
        """Test POST /api/orders - Critical order flow test"""
        try:
            if not menu_items or len(menu_items) < 2:
                self.log_result("POST Orders", False, "Need at least 2 menu items for testing")
                return None
                
            if not tables:
                self.log_result("POST Orders", False, "No tables available for testing")
                return None
                
            # Find available table
            available_table = None
            for table in tables:
                if table.get('status') == 'available':
                    available_table = table
                    break
                    
            if not available_table:
                self.log_result("POST Orders", False, "No available tables found")
                return None
                
            # Create order with 2-3 menu items
            order_items = []
            total = 0
            
            for i, menu_item in enumerate(menu_items[:3]):  # Take first 3 items
                quantity = 2 if i == 0 else 1  # First item quantity 2, others 1
                item_total = menu_item['price'] * quantity
                total += item_total
                
                order_items.append({
                    "menuItemId": menu_item['_id'],
                    "name": menu_item['name'],
                    "quantity": quantity,
                    "price": menu_item['price'],
                    "modifiers": [],
                    "instructions": f"Special instructions for {menu_item['name']}" if i == 0 else ""
                })
                
            new_order = {
                "orderType": "dine-in",
                "tableNumber": available_table['tableNumber'],
                "items": order_items,
                "status": "pending",
                "subtotal": total,
                "tax": total * 0.05,  # 5% tax
                "total": total * 1.05,
                "paymentMethod": None,
                "paymentStatus": "unpaid",
                "kotSent": False
            }
            
            response = self.session.post(f"{self.base_url}/orders", json=new_order)
            if response.status_code == 200:
                created_order = response.json()
                if '_id' in created_order:
                    self.created_items['orders'].append(created_order['_id'])
                    self.log_result("POST Orders", True, 
                                  f"Created order {created_order['_id']} for table {available_table['tableNumber']} with {len(order_items)} items")
                    return created_order
                else:
                    self.log_result("POST Orders", False, "No ID returned in response")
            else:
                self.log_result("POST Orders", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST Orders", False, f"Error: {str(e)}")
        return None
        
    def test_create_kot(self, order):
        """Test POST /api/kot - Critical KOT flow test"""
        try:
            if not order:
                self.log_result("POST KOT", False, "No order provided for KOT creation")
                return None
                
            kot_data = {
                "orderId": order['_id'],
                "orderType": order['orderType'],
                "tableNumber": order.get('tableNumber'),
                "tokenNumber": order.get('tokenNumber'),
                "items": order['items'],
                "status": "pending"
            }
            
            response = self.session.post(f"{self.base_url}/kot", json=kot_data)
            if response.status_code == 200:
                created_kot = response.json()
                if '_id' in created_kot:
                    self.created_items['kot_batches'].append(created_kot['_id'])
                    self.log_result("POST KOT", True, 
                                  f"Created KOT {created_kot['_id']} for order {order['_id']}")
                    return created_kot
                else:
                    self.log_result("POST KOT", False, "No ID returned in response")
            else:
                self.log_result("POST KOT", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("POST KOT", False, f"Error: {str(e)}")
        return None
        
    def test_get_kot(self):
        """Test GET /api/kot"""
        try:
            response = self.session.get(f"{self.base_url}/kot")
            if response.status_code == 200:
                kot_batches = response.json()
                pending_kots = [k for k in kot_batches if k.get('status') == 'pending']
                self.log_result("GET KOT", True, 
                              f"Retrieved {len(kot_batches)} KOT batches, {len(pending_kots)} pending")
                return kot_batches
            else:
                self.log_result("GET KOT", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET KOT", False, f"Error: {str(e)}")
        return []
        
    def test_update_kot_status(self, kot_id):
        """Test PUT /api/kot/{id} - Update KOT status"""
        try:
            # First update to 'preparing'
            update_data = {
                "orderId": "test",  # Will be overridden by existing data
                "orderType": "dine-in",
                "items": [],
                "status": "preparing"
            }
            
            response = self.session.put(f"{self.base_url}/kot/{kot_id}", json=update_data)
            if response.status_code == 200:
                self.log_result("PUT KOT (preparing)", True, f"Updated KOT {kot_id} to preparing")
                
                # Then update to 'completed'
                update_data["status"] = "completed"
                response = self.session.put(f"{self.base_url}/kot/{kot_id}", json=update_data)
                if response.status_code == 200:
                    self.log_result("PUT KOT (completed)", True, f"Updated KOT {kot_id} to completed")
                    return True
                else:
                    self.log_result("PUT KOT (completed)", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_result("PUT KOT (preparing)", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("PUT KOT", False, f"Error: {str(e)}")
        return False
        
    def test_table_status_update(self, tables):
        """Test table status updates"""
        try:
            # Find an occupied table (should be from our order)
            occupied_table = None
            for table in tables:
                if table.get('status') == 'occupied':
                    occupied_table = table
                    break
                    
            if not occupied_table:
                # Get fresh table data
                fresh_tables = self.test_get_tables()
                for table in fresh_tables:
                    if table.get('status') == 'occupied':
                        occupied_table = table
                        break
                        
            if occupied_table:
                self.log_result("Table Status Update", True, 
                              f"Table {occupied_table['tableNumber']} correctly marked as occupied")
                return True
            else:
                self.log_result("Table Status Update", False, "No occupied tables found after order creation")
        except Exception as e:
            self.log_result("Table Status Update", False, f"Error: {str(e)}")
        return False
        
    def test_employees_endpoints(self):
        """Test employee endpoints"""
        try:
            # Test GET employees
            response = self.session.get(f"{self.base_url}/employees")
            if response.status_code == 200:
                employees = response.json()
                self.log_result("GET Employees", True, f"Retrieved {len(employees)} employees")
                
                # Test POST employee
                new_employee = {
                    "name": "John Doe",
                    "role": "Waiter",
                    "pin": "5678",
                    "phone": "9876543210",
                    "salary": 25000.0
                }
                
                response = self.session.post(f"{self.base_url}/employees", json=new_employee)
                if response.status_code == 200:
                    created_emp = response.json()
                    if '_id' in created_emp:
                        self.created_items['employees'].append(created_emp['_id'])
                        self.log_result("POST Employees", True, f"Created employee: {created_emp['name']}")
                        return True
                    else:
                        self.log_result("POST Employees", False, "No ID returned")
                else:
                    self.log_result("POST Employees", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_result("GET Employees", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Employees Endpoints", False, f"Error: {str(e)}")
        return False
        
    def test_expenses_endpoints(self):
        """Test expense endpoints"""
        try:
            # Test GET expenses
            response = self.session.get(f"{self.base_url}/expenses")
            if response.status_code == 200:
                expenses = response.json()
                self.log_result("GET Expenses", True, f"Retrieved {len(expenses)} expenses")
                
                # Test POST expense
                new_expense = {
                    "category": "Utilities",
                    "amount": 5000.0,
                    "description": "Monthly electricity bill"
                }
                
                response = self.session.post(f"{self.base_url}/expenses", json=new_expense)
                if response.status_code == 200:
                    created_exp = response.json()
                    if '_id' in created_exp:
                        self.created_items['expenses'].append(created_exp['_id'])
                        self.log_result("POST Expenses", True, f"Created expense: {created_exp['category']}")
                        return True
                    else:
                        self.log_result("POST Expenses", False, "No ID returned")
                else:
                    self.log_result("POST Expenses", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_result("GET Expenses", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Expenses Endpoints", False, f"Error: {str(e)}")
        return False
        
    def test_inventory_endpoints(self):
        """Test inventory endpoints"""
        try:
            # Test GET inventory
            response = self.session.get(f"{self.base_url}/inventory")
            if response.status_code == 200:
                inventory = response.json()
                self.log_result("GET Inventory", True, f"Retrieved {len(inventory)} inventory items")
                
                # Test POST inventory
                new_item = {
                    "name": "Chicken Breast",
                    "category": "Meat",
                    "unit": "kg",
                    "stock": 50.0,
                    "minThreshold": 10.0
                }
                
                response = self.session.post(f"{self.base_url}/inventory", json=new_item)
                if response.status_code == 200:
                    created_item = response.json()
                    if '_id' in created_item:
                        self.created_items['inventory'].append(created_item['_id'])
                        self.log_result("POST Inventory", True, f"Created inventory item: {created_item['name']}")
                        return True
                    else:
                        self.log_result("POST Inventory", False, "No ID returned")
                else:
                    self.log_result("POST Inventory", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_result("GET Inventory", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Inventory Endpoints", False, f"Error: {str(e)}")
        return False
        
    def test_settings_endpoints(self):
        """Test settings endpoints"""
        try:
            # Test GET settings
            response = self.session.get(f"{self.base_url}/settings")
            if response.status_code == 200:
                settings = response.json()
                self.log_result("GET Settings", True, f"Retrieved settings: {settings.get('restaurantName', 'Unknown')}")
                
                # Test PUT settings
                updated_settings = {
                    "restaurantName": "RestoPOS Test Restaurant",
                    "currency": "₹",
                    "taxRate": 0.08,
                    "printers": []
                }
                
                response = self.session.put(f"{self.base_url}/settings", json=updated_settings)
                if response.status_code == 200:
                    updated = response.json()
                    self.log_result("PUT Settings", True, f"Updated settings: {updated.get('restaurantName', 'Unknown')}")
                    return True
                else:
                    self.log_result("PUT Settings", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_result("GET Settings", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Settings Endpoints", False, f"Error: {str(e)}")
        return False
        
    def test_auth_login(self):
        """Test authentication login"""
        try:
            # Test with demo PIN
            login_data = {"pin": "1234"}
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            if response.status_code == 200:
                employee = response.json()
                self.log_result("Auth Login", True, f"Login successful for employee: {employee.get('name', 'Unknown')}")
                return True
            else:
                self.log_result("Auth Login", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Auth Login", False, f"Error: {str(e)}")
        return False
        
    def run_all_tests(self):
        """Run all tests in priority order"""
        print("=" * 60)
        print("RestoPOS Backend API Test Suite")
        print("=" * 60)
        
        # Priority 1: Core Order Flow (CRITICAL)
        print("\n🔥 PRIORITY 1: CORE ORDER FLOW (CRITICAL)")
        print("-" * 40)
        
        # Basic connectivity
        if not self.test_root_endpoint():
            print("❌ Cannot connect to API - stopping tests")
            return
            
        # Get initial data
        menu_items = self.test_get_menu()
        tables = self.test_get_tables()
        
        # Test complete order flow
        order = self.test_create_order(menu_items, tables)
        if order:
            kot = self.test_create_kot(order)
            if kot:
                self.test_get_kot()
                self.test_update_kot_status(kot['_id'])
            self.test_table_status_update(tables)
        
        # Priority 2: Menu Management
        print("\n📋 PRIORITY 2: MENU MANAGEMENT")
        print("-" * 40)
        created_menu_item = self.test_create_menu_item()
        if created_menu_item:
            self.test_update_menu_item(created_menu_item['_id'])
            self.test_delete_menu_item(created_menu_item['_id'])
            
        # Priority 3: Other Endpoints
        print("\n⚙️ PRIORITY 3: OTHER ENDPOINTS")
        print("-" * 40)
        self.test_get_orders()
        self.test_employees_endpoints()
        self.test_expenses_endpoints()
        self.test_inventory_endpoints()
        self.test_settings_endpoints()
        self.test_auth_login()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\nFailed Tests:")
        for result in self.test_results:
            if not result['success']:
                print(f"  ❌ {result['test']}: {result['message']}")
                
        print("\nPassed Tests:")
        for result in self.test_results:
            if result['success']:
                print(f"  ✅ {result['test']}: {result['message']}")

if __name__ == "__main__":
    tester = RestoPOSAPITester()
    tester.run_all_tests()