#!/usr/bin/env python3
"""
PROCTO 13 Brand Management System - Backend API Testing
Tests all API endpoints with proper authentication and data validation
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class PROCTO13APITester:
    def __init__(self, base_url: str = "https://brandsearch-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.searcher_token = None
        self.searcher_user_id = None
        self.test_brand_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, token: Optional[str] = None, 
                 files: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove Content-Type for file uploads
            headers.pop('Content-Type', None)

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
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

    def test_init_admin(self) -> bool:
        """Initialize admin user"""
        self.log("=== INITIALIZING ADMIN USER ===")
        success, response = self.run_test(
            "Initialize Admin",
            "POST",
            "init",
            200
        )
        return success

    def test_admin_login(self) -> bool:
        """Test admin login with provided credentials"""
        self.log("=== TESTING ADMIN LOGIN ===")
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
            self.log(f"✅ Admin token obtained: {self.admin_token[:20]}...")
            return True
        
        self.log("❌ Failed to get admin token")
        return False

    def test_admin_dashboard(self) -> bool:
        """Test admin dashboard access"""
        self.log("=== TESTING ADMIN DASHBOARD ===")
        success, response = self.run_test(
            "Admin Dashboard",
            "GET",
            "dashboard",
            200,
            token=self.admin_token
        )
        
        if success:
            required_fields = ['total_brands', 'brands_in_pool', 'brands_assigned', 'brands_overdue']
            for field in required_fields:
                if field not in response:
                    self.log(f"❌ Missing field in dashboard: {field}")
                    return False
            self.log("✅ Dashboard data structure is correct")
        
        return success

    def test_user_management(self) -> bool:
        """Test user creation and management"""
        self.log("=== TESTING USER MANAGEMENT ===")
        
        # Create searcher user
        searcher_data = {
            "email": f"searcher_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "test123",
            "secret_code": "TEST123",
            "nickname": f"TestSearcher_{datetime.now().strftime('%H%M%S')}",
            "role": "searcher",
            "work_hours_start": "09:00",
            "work_hours_end": "18:00"
        }
        
        success, response = self.run_test(
            "Create Searcher User",
            "POST",
            "users",
            200,
            data=searcher_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.searcher_user_id = response['id']
            self.log(f"✅ Searcher created with ID: {self.searcher_user_id}")
            
            # Test searcher login
            login_success, login_response = self.run_test(
                "Searcher Login",
                "POST",
                "auth/login",
                200,
                data={
                    "email": searcher_data["email"],
                    "password": searcher_data["password"],
                    "secret_code": searcher_data["secret_code"]
                }
            )
            
            if login_success and 'token' in login_response:
                self.searcher_token = login_response['token']
                self.log(f"✅ Searcher token obtained: {self.searcher_token[:20]}...")
                return True
        
        return False

    def test_excel_import(self) -> bool:
        """Test Excel import functionality with sample data"""
        self.log("=== TESTING EXCEL IMPORT ===")
        
        # Create a simple test CSV that mimics Excel structure
        import io
        import pandas as pd
        
        # Create sample data
        sample_data = {
            'Brand': ['TestBrand1', 'TestBrand2', 'TestBrand1', 'TestBrand3'],
            'ASIN': ['B001', 'B002', 'B003', 'B004'],
            'Title': ['Test Product 1', 'Test Product 2', 'Test Product 3', 'Test Product 4'],
            'Image': ['https://example.com/img1.jpg', 'https://example.com/img2.jpg', '', 'https://example.com/img4.jpg']
        }
        
        df = pd.DataFrame(sample_data)
        
        # Save to Excel bytes
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        
        # Test import
        files = {'file': ('test_brands.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        success, response = self.run_test(
            "Excel Import",
            "POST",
            "import/excel",
            200,
            files=files,
            token=self.admin_token
        )
        
        if success and 'stats' in response:
            stats = response['stats']
            self.log(f"✅ Import stats: {stats}")
            return True
        
        return False

    def test_brand_operations(self) -> bool:
        """Test brand listing and operations"""
        self.log("=== TESTING BRAND OPERATIONS ===")
        
        # List all brands (admin view)
        success, response = self.run_test(
            "List All Brands (Admin)",
            "GET",
            "brands",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        brands = response.get('brands', [])
        if not brands:
            self.log("❌ No brands found after import")
            return False
        
        # Get first brand for detailed testing
        self.test_brand_id = brands[0]['id']
        self.log(f"✅ Using brand ID for testing: {self.test_brand_id}")
        
        # Test brand detail view
        success, response = self.run_test(
            "Brand Detail View",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.admin_token
        )
        
        if success:
            required_fields = ['brand', 'items', 'notes', 'events']
            for field in required_fields:
                if field not in response:
                    self.log(f"❌ Missing field in brand detail: {field}")
                    return False
        
        return success

    def test_searcher_brand_claiming(self) -> bool:
        """Test searcher brand claiming functionality"""
        self.log("=== TESTING SEARCHER BRAND CLAIMING ===")
        
        if not self.searcher_token:
            self.log("❌ No searcher token available")
            return False
        
        # Test claiming brands
        success, response = self.run_test(
            "Claim Brands (Searcher)",
            "POST",
            "brands/claim",
            200,
            token=self.searcher_token
        )
        
        if success:
            count = response.get('count', 0)
            self.log(f"✅ Searcher claimed {count} brands")
            
            # Test viewing searcher's brands
            success, response = self.run_test(
                "List My Brands (Searcher)",
                "GET",
                "brands",
                200,
                token=self.searcher_token
            )
            
            if success:
                my_brands = response.get('brands', [])
                self.log(f"✅ Searcher has {len(my_brands)} brands")
                return True
        
        return False

    def test_brand_workflow(self) -> bool:
        """Test brand workflow operations"""
        self.log("=== TESTING BRAND WORKFLOW ===")
        
        if not self.searcher_token or not self.test_brand_id:
            self.log("❌ Missing searcher token or brand ID")
            return False
        
        # Test adding a note
        success, response = self.run_test(
            "Add Brand Note",
            "POST",
            f"brands/{self.test_brand_id}/note",
            200,
            data={
                "note_text": "Test note from automated testing",
                "note_type": "general"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test stage completion
        success, response = self.run_test(
            "Complete Stage",
            "POST",
            f"brands/{self.test_brand_id}/stage",
            200,
            data={
                "stage": "EMAIL_1_DONE",
                "note_text": "Completed first email stage in testing"
            },
            token=self.searcher_token
        )
        
        return success

    def test_authentication_security(self) -> bool:
        """Test authentication and security"""
        self.log("=== TESTING AUTHENTICATION SECURITY ===")
        
        # Test invalid login
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={
                "email": "invalid@test.com",
                "password": "wrong",
                "secret_code": "WRONG"
            }
        )
        
        if not success:
            return False
        
        # Test accessing protected endpoint without token
        success, response = self.run_test(
            "Unauthorized Access",
            "GET",
            "dashboard",
            401
        )
        
        return success

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return results"""
        self.log("🚀 Starting PROCTO 13 API Testing Suite")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "tests": {}
        }
        
        # Run tests in order
        tests = [
            ("init_admin", self.test_init_admin),
            ("admin_login", self.test_admin_login),
            ("admin_dashboard", self.test_admin_dashboard),
            ("user_management", self.test_user_management),
            ("excel_import", self.test_excel_import),
            ("brand_operations", self.test_brand_operations),
            ("searcher_claiming", self.test_searcher_brand_claiming),
            ("brand_workflow", self.test_brand_workflow),
            ("authentication_security", self.test_authentication_security)
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
    tester = PROCTO13APITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/test_reports/backend_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Return appropriate exit code
    return 0 if results["summary"]["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())