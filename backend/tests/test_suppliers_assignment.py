#!/usr/bin/env python3
"""
PROCTO 13 Suppliers Assignment System - Backend API Testing
Tests all suppliers assignment endpoints with proper authentication and data validation
As requested in the review: Save test file to /app/backend/tests/test_suppliers_assignment.py
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class SuppliersAssignmentTester:
    def __init__(self, base_url: str = "https://brandsync-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.admin_user_id = "f41bdabf-7a8b-4db6-8a8c-694407544480"  # azamat's ID from review request
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, token: Optional[str] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
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
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"   Response: {response.text[:200]}", "FAIL")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                try:
                    return False, response.json()
                except:
                    return False, {"error": response.text}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_super_admin_login(self) -> bool:
        """Test super admin login with provided credentials"""
        self.log("=== TESTING SUPER ADMIN LOGIN ===")
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
        
        if success and 'token' in response:
            self.super_admin_token = response['token']
            self.log(f"✅ Super Admin token obtained")
            return True
        
        self.log("❌ Failed to get super admin token")
        return False

    def test_admin_login(self) -> bool:
        """Test admin login with provided credentials"""
        self.log("=== TESTING ADMIN LOGIN ===")
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
        
        if success and 'token' in response:
            self.admin_token = response['token']
            self.admin_user_id = response['user']['id']
            self.log(f"✅ Admin token obtained, user ID: {self.admin_user_id}")
            return True
        
        self.log("❌ Failed to get admin token")
        return False

    def test_suppliers_role_based_access(self) -> bool:
        """Test role-based access to suppliers endpoints"""
        self.log("=== TESTING ROLE-BASED ACCESS ===")
        
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
        
        # Store supplier ID for testing
        self.test_supplier_id = all_suppliers[0]['id']
        self.log(f"✅ Using supplier ID for testing: {self.test_supplier_id}")
        
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
        
        self.admin_suppliers_before = response.get('suppliers', [])
        self.log(f"✅ Admin initially sees {len(self.admin_suppliers_before)} suppliers")
        
        return True

    def test_supplier_assignment(self) -> bool:
        """Test supplier assignment functionality"""
        self.log("=== TESTING SUPPLIER ASSIGNMENT ===")
        
        # Test 3: POST /api/suppliers/bulk-assign - Assign supplier to admin
        success, response = self.run_test(
            "Bulk Assign Supplier to Admin",
            "POST",
            "suppliers/bulk-assign",
            200,
            data={
                "supplier_ids": [self.test_supplier_id],
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
        return True

    def test_assignment_notification(self) -> bool:
        """Test that admin receives notification after assignment"""
        self.log("=== TESTING ASSIGNMENT NOTIFICATION ===")
        
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
        return True

    def test_admin_sees_assigned_supplier(self) -> bool:
        """Test that admin now sees the assigned supplier"""
        self.log("=== TESTING ADMIN SEES ASSIGNED SUPPLIER ===")
        
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
        if len(admin_suppliers_after) != len(self.admin_suppliers_before) + 1:
            self.log(f"❌ Admin supplier count should increase by 1. Before: {len(self.admin_suppliers_before)}, After: {len(admin_suppliers_after)}")
            return False
        
        # Verify the assigned supplier is in the list
        assigned_supplier_found = False
        for supplier in admin_suppliers_after:
            if supplier['id'] == self.test_supplier_id:
                assigned_supplier_found = True
                break
        
        if not assigned_supplier_found:
            self.log("❌ Assigned supplier not found in admin's supplier list")
            return False
        
        self.log(f"✅ Admin now sees {len(admin_suppliers_after)} suppliers (including assigned one)")
        return True

    def test_supplier_release(self) -> bool:
        """Test supplier release functionality"""
        self.log("=== TESTING SUPPLIER RELEASE ===")
        
        # Test 6: POST /api/suppliers/bulk-release - Release supplier from admin
        success, response = self.run_test(
            "Bulk Release Supplier from Admin",
            "POST",
            "suppliers/bulk-release",
            200,
            data=[self.test_supplier_id],
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
        return True

    def test_admin_no_longer_sees_supplier(self) -> bool:
        """Test that admin no longer sees the released supplier"""
        self.log("=== TESTING ADMIN NO LONGER SEES SUPPLIER ===")
        
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
        if len(admin_suppliers_final) != len(self.admin_suppliers_before):
            self.log(f"❌ Admin supplier count should return to original. Expected: {len(self.admin_suppliers_before)}, Got: {len(admin_suppliers_final)}")
            return False
        
        # Verify the released supplier is no longer in the list
        released_supplier_found = False
        for supplier in admin_suppliers_final:
            if supplier['id'] == self.test_supplier_id:
                released_supplier_found = True
                break
        
        if released_supplier_found:
            self.log("❌ Released supplier still found in admin's supplier list")
            return False
        
        self.log(f"✅ Admin now sees {len(admin_suppliers_final)} suppliers (released supplier removed)")
        return True

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all suppliers assignment tests and return results"""
        self.log("🚀 Starting PROCTO 13 Suppliers Assignment System Testing")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "test_type": "suppliers_assignment_system",
            "tests": {}
        }
        
        # Run tests in order
        tests = [
            ("super_admin_login", self.test_super_admin_login),
            ("admin_login", self.test_admin_login),
            ("suppliers_role_based_access", self.test_suppliers_role_based_access),
            ("supplier_assignment", self.test_supplier_assignment),
            ("assignment_notification", self.test_assignment_notification),
            ("admin_sees_assigned_supplier", self.test_admin_sees_assigned_supplier),
            ("supplier_release", self.test_supplier_release),
            ("admin_no_longer_sees_supplier", self.test_admin_no_longer_sees_supplier)
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                test_results["tests"][test_name] = {
                    "passed": result,
                    "timestamp": datetime.now().isoformat()
                }
                if not result:
                    self.log(f"❌ Test suite stopped at: {test_name}")
                    break
            except Exception as e:
                self.log(f"💥 Test {test_name} crashed: {str(e)}")
                test_results["tests"][test_name] = {
                    "passed": False,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
                break
        
        # Final results
        self.log("=" * 50)
        self.log(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            self.log("❌ FAILED TESTS:")
            for failure in self.failed_tests:
                self.log(f"   - {failure}")
        
        test_results.update({
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "failed_tests": len(self.failed_tests),
                "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
            },
            "failed_tests": self.failed_tests
        })
        
        return test_results

def main():
    """Main test execution"""
    tester = SuppliersAssignmentTester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/backend/tests/suppliers_assignment_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Return appropriate exit code
    return 0 if results["summary"]["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())