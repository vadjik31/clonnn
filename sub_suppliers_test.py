#!/usr/bin/env python3
"""
Sub-Suppliers Standalone API Testing
Tests the new sub-suppliers endpoints as requested in the review
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class SubSuppliersAPITester:
    def __init__(self, base_url: str = "https://notifyflow-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.searcher_token = None
        self.searcher_user_id = None
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

    def login_admin(self) -> bool:
        """Login as admin"""
        self.log("=== ADMIN LOGIN ===")
        success, response = self.run_test(
            "Admin Login",
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
            self.admin_token = response['token']
            self.log(f"✅ Admin token obtained")
            return True
        
        self.log("❌ Failed to get admin token")
        return False

    def login_searcher(self) -> bool:
        """Login as searcher"""
        self.log("=== SEARCHER LOGIN ===")
        success, response = self.run_test(
            "Searcher Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "searcher@procto13.com",
                "password": "searcher123",
                "secret_code": "PROCTO13"
            }
        )
        
        if success and 'token' in response:
            self.searcher_token = response['token']
            self.searcher_user_id = response['user']['id']
            self.log(f"✅ Searcher token obtained")
            self.log(f"✅ Searcher user ID: {self.searcher_user_id}")
            return True
        
        self.log("❌ Failed to get searcher token")
        return False

    def test_sub_suppliers_list_admin(self) -> bool:
        """Test GET /api/sub-suppliers as admin"""
        self.log("=== TESTING SUB-SUPPLIERS LIST (ADMIN) ===")
        
        success, response = self.run_test(
            "List All Sub-Suppliers (Admin)",
            "GET",
            "sub-suppliers",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Validate response structure
        required_fields = ['sub_suppliers', 'total', 'page', 'pages']
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing field in response: {field}")
                return False
        
        total_count = response.get('total', 0)
        sub_suppliers = response.get('sub_suppliers', [])
        self.log(f"✅ Admin sees {total_count} sub-suppliers")
        
        # Validate sub-supplier structure if any exist
        if sub_suppliers:
            ss = sub_suppliers[0]
            expected_fields = ['id', 'name', 'parent_brand_id', 'parent_brand_name', 'status', 'pipeline_stage']
            for field in expected_fields:
                if field not in ss:
                    self.log(f"❌ Missing field in sub-supplier: {field}")
                    return False
            self.log(f"✅ Sub-supplier structure is correct")
        
        return True

    def test_sub_suppliers_list_searcher(self) -> bool:
        """Test GET /api/sub-suppliers as searcher (should see only assigned)"""
        self.log("=== TESTING SUB-SUPPLIERS LIST (SEARCHER) ===")
        
        success, response = self.run_test(
            "List My Sub-Suppliers (Searcher)",
            "GET",
            "sub-suppliers",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        searcher_count = response.get('total', 0)
        self.log(f"✅ Searcher sees {searcher_count} sub-suppliers")
        
        # Verify searcher only sees their assigned sub-suppliers
        sub_suppliers = response.get('sub_suppliers', [])
        for ss in sub_suppliers:
            if ss.get('assigned_to_user_id') and ss['assigned_to_user_id'] != self.searcher_user_id:
                self.log(f"❌ Searcher sees sub-supplier not assigned to them: {ss['id']}")
                return False
        
        self.log("✅ Searcher correctly sees only their assigned sub-suppliers")
        return True

    def test_sub_suppliers_pagination(self) -> bool:
        """Test pagination parameters"""
        self.log("=== TESTING SUB-SUPPLIERS PAGINATION ===")
        
        success, response = self.run_test(
            "Sub-Suppliers Pagination",
            "GET",
            "sub-suppliers?page=1&limit=5",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        if response.get('page') != 1:
            self.log("❌ Pagination page parameter not working")
            return False
        
        if len(response.get('sub_suppliers', [])) > 5:
            self.log("❌ Pagination limit parameter not working")
            return False
        
        self.log("✅ Pagination working correctly")
        return True

    def test_sub_suppliers_filters(self) -> bool:
        """Test various filters"""
        self.log("=== TESTING SUB-SUPPLIERS FILTERS ===")
        
        # Test status filter
        success, response = self.run_test(
            "Status Filter",
            "GET",
            "sub-suppliers?status=IN_POOL",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Test pipeline_stage filter
        success, response = self.run_test(
            "Pipeline Stage Filter",
            "GET",
            "sub-suppliers?pipeline_stage=REVIEW",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Test search filter
        success, response = self.run_test(
            "Search Filter",
            "GET",
            "sub-suppliers?search=test",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Test overdue filter
        success, response = self.run_test(
            "Overdue Filter",
            "GET",
            "sub-suppliers?overdue=true",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Test assigned_to filter (admin only)
        if self.searcher_user_id:
            success, response = self.run_test(
                "Assigned To Filter",
                "GET",
                f"sub-suppliers?assigned_to={self.searcher_user_id}",
                200,
                token=self.admin_token
            )
            
            if not success:
                return False
        
        self.log("✅ All filters working correctly")
        return True

    def test_sub_suppliers_ids_admin(self) -> bool:
        """Test GET /api/sub-suppliers/ids as admin (should work)"""
        self.log("=== TESTING SUB-SUPPLIERS IDS (ADMIN) ===")
        
        success, response = self.run_test(
            "Get Sub-Suppliers IDs (Admin)",
            "GET",
            "sub-suppliers/ids",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        if 'ids' not in response:
            self.log("❌ Missing 'ids' field in response")
            return False
        
        ids_count = len(response['ids'])
        self.log(f"✅ Admin can access {ids_count} sub-supplier IDs")
        return True

    def test_sub_suppliers_ids_searcher(self) -> bool:
        """Test GET /api/sub-suppliers/ids as searcher (should be forbidden - 403)"""
        self.log("=== TESTING SUB-SUPPLIERS IDS (SEARCHER - SHOULD FAIL) ===")
        
        success, response = self.run_test(
            "Get Sub-Suppliers IDs (Searcher - Should Fail)",
            "GET",
            "sub-suppliers/ids",
            403,  # Should be forbidden
            token=self.searcher_token
        )
        
        if not success:
            self.log("❌ Searcher was allowed to access sub-suppliers/ids (security issue)")
            return False
        
        self.log("✅ Searcher correctly forbidden from accessing sub-suppliers/ids")
        return True

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all sub-suppliers tests"""
        self.log("🚀 Starting Sub-Suppliers API Testing")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "tests": {}
        }
        
        # Run tests in order
        tests = [
            ("admin_login", self.login_admin),
            ("searcher_login", self.login_searcher),
            ("sub_suppliers_list_admin", self.test_sub_suppliers_list_admin),
            ("sub_suppliers_list_searcher", self.test_sub_suppliers_list_searcher),
            ("sub_suppliers_pagination", self.test_sub_suppliers_pagination),
            ("sub_suppliers_filters", self.test_sub_suppliers_filters),
            ("sub_suppliers_ids_admin", self.test_sub_suppliers_ids_admin),
            ("sub_suppliers_ids_searcher", self.test_sub_suppliers_ids_searcher)
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
    tester = SubSuppliersAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/test_reports/sub_suppliers_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Return appropriate exit code
    return 0 if results["summary"]["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())