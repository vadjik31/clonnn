#!/usr/bin/env python3
"""
Test script specifically for Suppliers Assignment System
"""

import requests
import sys
import json
from datetime import datetime

class SuppliersAssignmentTester:
    def __init__(self, base_url: str = "https://notifybrands.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.admin_user_id = "f41bdabf-7a8b-4db6-8a8c-694407544480"  # azamat's ID from review request

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data=None, token=None) -> tuple[bool, dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"   Response: {response.text[:200]}", "FAIL")
                try:
                    return False, response.json()
                except:
                    return False, {"error": response.text}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def login_users(self):
        """Login super admin and admin users"""
        self.log("=== LOGGING IN USERS ===")
        
        # Super Admin Login
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "admin@procto13.com",
                "password": "admin123",
                "secret_code": "PROCTO13"
            }
        )
        
        if not success or 'token' not in response:
            self.log("❌ Failed to login super admin")
            return False
        
        self.super_admin_token = response['token']
        self.log(f"✅ Super Admin logged in")
        
        # Admin Login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "azamat@gmail.com",
                "password": "azamat",
                "secret_code": "AZAMAT"
            }
        )
        
        if not success or 'token' not in response:
            self.log("❌ Failed to login admin")
            return False
        
        self.admin_token = response['token']
        self.admin_user_id = response['user']['id']
        self.log(f"✅ Admin logged in with ID: {self.admin_user_id}")
        
        return True

    def test_suppliers_assignment_system(self):
        """Test the complete suppliers assignment system"""
        self.log("=== TESTING SUPPLIERS ASSIGNMENT SYSTEM ===")
        
        # Test 1: GET /api/suppliers as Super Admin (should see ALL suppliers)
        success, response = self.run_test(
            "Get All Suppliers (Super Admin)",
            "GET",
            "suppliers",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        all_suppliers = response.get('suppliers', [])
        self.log(f"✅ Super Admin sees {len(all_suppliers)} suppliers")
        
        if not all_suppliers:
            self.log("❌ No suppliers found - cannot test assignment system")
            return False
        
        # Get a supplier ID for testing
        test_supplier_id = all_suppliers[0]['id']
        self.log(f"✅ Using supplier ID for testing: {test_supplier_id}")
        
        # Test 2: GET /api/suppliers as Admin (should see ONLY assigned suppliers - initially empty)
        success, response = self.run_test(
            "Get Admin Suppliers (Initially Empty)",
            "GET",
            "suppliers",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_suppliers_before = response.get('suppliers', [])
        self.log(f"✅ Admin initially sees {len(admin_suppliers_before)} suppliers")
        
        # Test 3: POST /api/suppliers/bulk-assign - Assign supplier to admin
        success, response = self.run_test(
            "Bulk Assign Supplier to Admin",
            "POST",
            "suppliers/bulk-assign",
            200,
            data={
                "supplier_ids": [test_supplier_id],
                "admin_id": self.admin_user_id,
                "reason": "Test assignment for suppliers system"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Verify response shows assigned_count = 1
        assigned_count = response.get('assigned_count', 0)
        if assigned_count != 1:
            self.log(f"❌ Expected assigned_count=1, got {assigned_count}")
            return False
        
        self.log(f"✅ Successfully assigned {assigned_count} supplier to admin")
        
        # Test 4: Verify Admin receives notification
        success, response = self.run_test(
            "Check Admin Notifications After Assignment",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Look for brand_assigned notification
        notifications = response.get('notifications', [])
        assignment_notification = None
        for notif in notifications:
            if notif.get('type') == 'brand_assigned':
                assignment_notification = notif
                break
        
        if not assignment_notification:
            self.log("❌ Admin did not receive assignment notification")
            return False
        
        self.log("✅ Admin received assignment notification")
        
        # Test 5: Verify Admin now sees assigned supplier
        success, response = self.run_test(
            "Get Admin Suppliers After Assignment",
            "GET",
            "suppliers",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_suppliers_after = response.get('suppliers', [])
        if len(admin_suppliers_after) != len(admin_suppliers_before) + 1:
            self.log(f"❌ Admin supplier count should increase by 1. Before: {len(admin_suppliers_before)}, After: {len(admin_suppliers_after)}")
            return False
        
        # Verify the assigned supplier is in the list
        assigned_supplier_found = False
        for supplier in admin_suppliers_after:
            if supplier['id'] == test_supplier_id:
                assigned_supplier_found = True
                break
        
        if not assigned_supplier_found:
            self.log("❌ Assigned supplier not found in admin's supplier list")
            return False
        
        self.log(f"✅ Admin now sees {len(admin_suppliers_after)} suppliers (including assigned one)")
        
        # Test 6: POST /api/suppliers/bulk-release - Release supplier from admin
        success, response = self.run_test(
            "Bulk Release Supplier from Admin",
            "POST",
            "suppliers/bulk-release",
            200,
            data=[test_supplier_id],
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Verify response shows released_count = 1
        released_count = response.get('released_count', 0)
        if released_count != 1:
            self.log(f"❌ Expected released_count=1, got {released_count}")
            return False
        
        self.log(f"✅ Successfully released {released_count} supplier from admin")
        
        # Test 7: Verify Admin no longer sees supplier
        success, response = self.run_test(
            "Get Admin Suppliers After Release",
            "GET",
            "suppliers",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_suppliers_final = response.get('suppliers', [])
        if len(admin_suppliers_final) != len(admin_suppliers_before):
            self.log(f"❌ Admin supplier count should return to original. Expected: {len(admin_suppliers_before)}, Got: {len(admin_suppliers_final)}")
            return False
        
        # Verify the released supplier is no longer in the list
        released_supplier_found = False
        for supplier in admin_suppliers_final:
            if supplier['id'] == test_supplier_id:
                released_supplier_found = True
                break
        
        if released_supplier_found:
            self.log("❌ Released supplier still found in admin's supplier list")
            return False
        
        self.log(f"✅ Admin now sees {len(admin_suppliers_final)} suppliers (released supplier removed)")
        
        return True

    def run_all_tests(self):
        """Run all supplier assignment tests"""
        self.log("🚀 Starting Suppliers Assignment System Testing")
        
        if not self.login_users():
            return False
        
        if not self.test_suppliers_assignment_system():
            return False
        
        self.log("✅ All Suppliers Assignment System tests passed!")
        return True

def main():
    """Main test execution"""
    tester = SuppliersAssignmentTester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())