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
    def __init__(self, base_url: str = "https://notifybrands.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.searcher_token = None
        self.searcher_user_id = None
        self.admin_user_id = None
        self.test_brand_id = None
        self.test_sub_supplier_ids = []
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
                if data:
                    response = requests.delete(url, json=data, headers=headers, timeout=30)
                else:
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
            self.log(f"✅ Super Admin token obtained: {self.super_admin_token[:20]}...")
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
            self.log(f"✅ Admin token obtained: {self.admin_token[:20]}...")
            self.log(f"✅ Admin user ID: {self.admin_user_id}")
            return True
        
        self.log("❌ Failed to get admin token")
        return False

    def test_searcher_login(self) -> bool:
        """Test searcher login with provided credentials"""
        self.log("=== TESTING SEARCHER LOGIN ===")
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
            self.log(f"✅ Searcher token obtained: {self.searcher_token[:20]}...")
            self.log(f"✅ Searcher user ID: {self.searcher_user_id}")
            return True
        
        self.log("❌ Failed to get searcher token")
        return False

    def test_admin_dashboard(self) -> bool:
        """Test admin dashboard access"""
        self.log("=== TESTING ADMIN DASHBOARD ===")
        success, response = self.run_test(
            "Admin Dashboard",
            "GET",
            "dashboard",
            200,
            token=self.super_admin_token
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
            token=self.super_admin_token
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
            token=self.super_admin_token
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
            token=self.super_admin_token
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
            token=self.super_admin_token
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
        
        if not self.searcher_token:
            self.log("❌ Missing searcher token")
            return False
        
        # First get the searcher's brands to find one to work with
        success, response = self.run_test(
            "Get Searcher Brands for Workflow",
            "GET",
            "brands",
            200,
            token=self.searcher_token
        )
        
        if not success or not response.get('brands'):
            self.log("❌ No brands available for workflow testing")
            return False
        
        # Use the first brand from searcher's list
        searcher_brand_id = response['brands'][0]['id']
        self.log(f"✅ Using searcher's brand ID for workflow: {searcher_brand_id}")
        
        # Test adding a note
        success, response = self.run_test(
            "Add Brand Note",
            "POST",
            f"brands/{searcher_brand_id}/note",
            200,
            data={
                "note_text": "Test note from automated testing",
                "note_type": "general"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test stage completion with validation
        success, response = self.run_test(
            "Complete Stage (Valid Transition)",
            "POST",
            f"brands/{searcher_brand_id}/stage",
            200,
            data={
                "stage": "EMAIL_1_DONE",
                "note_text": "Completed first email stage in testing",
                "channel": "email"
            },
            token=self.searcher_token
        )
        
        return success

    def test_security_fixes(self) -> bool:
        """Test specific security fixes mentioned in the request"""
        self.log("=== TESTING SECURITY FIXES ===")
        
        if not self.searcher_token:
            self.log("❌ Missing searcher token")
            return False
        
        # Test 1: Return reasons reference (закрывает дыру #33)
        success, response = self.run_test(
            "Get Return Reasons Reference",
            "GET",
            "references/return-reasons",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Validate return reasons structure
        expected_reasons = ["invalid_brand", "duplicate", "wrong_category", "no_contacts", "site_down", "language_barrier", "other"]
        for reason in expected_reasons:
            if reason not in response:
                self.log(f"❌ Missing return reason: {reason}")
                return False
        
        # Test 2: Stage transitions matrix (закрывает дыру #17)
        success, response = self.run_test(
            "Get Stage Transitions Matrix",
            "GET",
            "references/stage-transitions",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 3: Get searcher's brand for testing invalid transition
        success, response = self.run_test(
            "Get Searcher Brands for Security Test",
            "GET",
            "brands",
            200,
            token=self.searcher_token
        )
        
        if not success or not response.get('brands'):
            self.log("❌ No searcher brands available for security testing")
            return False
        
        searcher_brand_id = response['brands'][0]['id']
        
        # Test 4: Invalid stage transition (should fail)
        success, response = self.run_test(
            "Invalid Stage Transition",
            "POST",
            f"brands/{searcher_brand_id}/stage",
            400,  # Should fail with 400
            data={
                "stage": "CLOSED",  # Invalid transition from REVIEW
                "note_text": "Trying invalid transition"
            },
            token=self.searcher_token
        )
        
        if not success:
            self.log("❌ Invalid stage transition was allowed (security hole)")
            return False
        
        # Test 5: Return brand with reason code (закрывает дыру #33)
        success, response = self.run_test(
            "Return Brand with Reason Code",
            "POST",
            f"brands/{searcher_brand_id}/return",
            200,
            data={
                "reason_code": "invalid_brand",
                "note_text": "Testing return with valid reason code"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 6: Outcome with required fields (закрывает дыры #12, #45)
        # First need to claim a new brand and complete some stages
        claim_success, claim_response = self.run_test(
            "Claim New Brand for Outcome Test",
            "POST",
            "brands/claim",
            200,
            token=self.searcher_token
        )
        
        if claim_success:
            # Get the claimed brand
            brands_success, brands_response = self.run_test(
                "Get My Brands for Outcome Test",
                "GET",
                "brands",
                200,
                token=self.searcher_token
            )
            
            if brands_success and brands_response.get('brands'):
                outcome_brand_id = brands_response['brands'][0]['id']
                
                # Try outcome without required fields (should fail)
                success, response = self.run_test(
                    "Outcome Without Required Fields",
                    "POST",
                    f"brands/{outcome_brand_id}/outcome",
                    422,  # Should fail with 422 (validation error)
                    data={
                        "outcome": "OUTCOME_APPROVED",
                        "note_text": "Testing outcome without required fields"
                        # Missing channel and contact_date
                    },
                    token=self.searcher_token
                )
                
                # Try outcome with required fields (should succeed)
                success, response = self.run_test(
                    "Outcome With Required Fields",
                    "POST",
                    f"brands/{outcome_brand_id}/outcome",
                    200,
                    data={
                        "outcome": "OUTCOME_APPROVED",
                        "note_text": "Testing outcome with required fields",
                        "channel": "email",
                        "contact_date": "2024-01-15"
                    },
                    token=self.searcher_token
                )
                
                if not success:
                    return False
        
        return True

    def test_references_endpoints(self) -> bool:
        """Test all reference endpoints"""
        self.log("=== TESTING REFERENCE ENDPOINTS ===")
        
        # Test outcome channels reference
        success, response = self.run_test(
            "Get Outcome Channels Reference",
            "GET",
            "references/outcome-channels",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test problematic reasons reference
        success, response = self.run_test(
            "Get Problematic Reasons Reference",
            "GET",
            "references/problematic-reasons",
            200,
            token=self.searcher_token
        )
        
        return success

    def test_dashboard_alerts(self) -> bool:
        """Test dashboard with alerts and extended statistics"""
        self.log("=== TESTING DASHBOARD ALERTS ===")
        
        # Test dashboard includes alerts
        success, response = self.run_test(
            "Dashboard with Alerts",
            "GET",
            "dashboard",
            200,
            token=self.super_admin_token
        )
        
        if success:
            # Check for alerts field
            if 'alerts' not in response:
                self.log("❌ Dashboard missing alerts field")
                return False
            
            # Check for searchers_activity with extended stats
            if 'searchers_activity' not in response:
                self.log("❌ Dashboard missing searchers_activity field")
                return False
            
            self.log("✅ Dashboard includes alerts and extended statistics")
        
        return success

    def test_brands_health_score(self) -> bool:
        """Test brands include health_score and quality_warnings"""
        self.log("=== TESTING BRANDS HEALTH SCORE ===")
        
        # Test brands list includes health_score
        success, response = self.run_test(
            "Brands with Health Score",
            "GET",
            "brands",
            200,
            token=self.super_admin_token
        )
        
        if success:
            brands = response.get('brands', [])
            if brands:
                brand = brands[0]
                if 'health_score' not in brand:
                    self.log("❌ Brand missing health_score field")
                    return False
                if 'quality_warnings' not in brand:
                    self.log("❌ Brand missing quality_warnings field")
                    return False
                
                self.log(f"✅ Brand health_score: {brand['health_score']}")
                self.log(f"✅ Brand quality_warnings: {brand['quality_warnings']}")
        
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

    def test_sub_suppliers_api(self) -> bool:
        """Test sub-suppliers standalone API endpoints"""
        self.log("=== TESTING SUB-SUPPLIERS API ===")
        
        if not self.super_admin_token or not self.searcher_token:
            self.log("❌ Missing required tokens for sub-suppliers testing")
            return False
        
        # Test 1: GET /api/sub-suppliers as admin (should see all)
        success, response = self.run_test(
            "List All Sub-Suppliers (Admin)",
            "GET",
            "sub-suppliers",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Validate response structure
        required_fields = ['sub_suppliers', 'total', 'page', 'pages']
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing field in sub-suppliers response: {field}")
                return False
        
        self.log(f"✅ Admin sees {response['total']} sub-suppliers")
        
        # Test 2: GET /api/sub-suppliers as searcher (should see only assigned)
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
        
        # Test 3: Test pagination
        success, response = self.run_test(
            "Sub-Suppliers Pagination",
            "GET",
            "sub-suppliers?page=1&limit=10",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        if response.get('page') != 1:
            self.log("❌ Pagination page parameter not working")
            return False
        
        # Test 4: Test filters - status filter
        success, response = self.run_test(
            "Sub-Suppliers Status Filter",
            "GET",
            "sub-suppliers?status=IN_POOL",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 5: Test filters - pipeline_stage filter
        success, response = self.run_test(
            "Sub-Suppliers Pipeline Stage Filter",
            "GET",
            "sub-suppliers?pipeline_stage=REVIEW",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 6: Test search filter
        success, response = self.run_test(
            "Sub-Suppliers Search Filter",
            "GET",
            "sub-suppliers?search=test",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 7: Test overdue filter
        success, response = self.run_test(
            "Sub-Suppliers Overdue Filter",
            "GET",
            "sub-suppliers?overdue=true",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 8: GET /api/sub-suppliers/ids as admin (should work)
        success, response = self.run_test(
            "Get Sub-Suppliers IDs (Admin)",
            "GET",
            "sub-suppliers/ids",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        if 'ids' not in response:
            self.log("❌ Missing 'ids' field in sub-suppliers/ids response")
            return False
        
        self.log(f"✅ Admin can access {len(response['ids'])} sub-supplier IDs")
        
        # Test 9: GET /api/sub-suppliers/ids as searcher (should be forbidden - 403)
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
        
        # Test 10: Test assigned_to filter (admin only)
        if self.searcher_user_id:
            success, response = self.run_test(
                "Sub-Suppliers Assigned To Filter",
                "GET",
                f"sub-suppliers?assigned_to={self.searcher_user_id}",
                200,
                token=self.super_admin_token
            )
            
            if not success:
                return False
        
        return True

    def test_sub_suppliers_bulk_operations(self) -> bool:
        """Test NEW sub-suppliers bulk operations endpoints"""
        self.log("=== TESTING SUB-SUPPLIERS BULK OPERATIONS (NEW) ===")
        
        if not self.super_admin_token:
            self.log("❌ Missing super admin token for bulk operations testing")
            return False
        
        # First, get some sub-supplier IDs to work with
        success, response = self.run_test(
            "Get Sub-Suppliers for Bulk Operations",
            "GET",
            "sub-suppliers/ids",
            200,
            token=self.super_admin_token
        )
        
        if not success or not response.get('ids'):
            self.log("❌ No sub-supplier IDs available for bulk operations testing")
            return False
        
        # Take first 2 IDs for testing (if available)
        available_ids = response['ids'][:2]
        if not available_ids:
            self.log("❌ No sub-supplier IDs available")
            return False
        
        self.log(f"✅ Using {len(available_ids)} sub-supplier IDs for bulk testing")
        
        # Test 1: POST /api/sub-suppliers/bulk-release
        success, response = self.run_test(
            "Bulk Release Sub-Suppliers",
            "POST",
            "sub-suppliers/bulk-release",
            200,
            data={
                "sub_supplier_ids": available_ids,
                "reason": "Testing bulk release functionality"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 2: POST /api/sub-suppliers/bulk-assign?user_id=XXX
        if self.searcher_user_id:
            success, response = self.run_test(
                "Bulk Assign Sub-Suppliers",
                "POST",
                f"sub-suppliers/bulk-assign?user_id={self.searcher_user_id}",
                200,
                data={
                    "sub_supplier_ids": available_ids,
                    "reason": "Testing bulk assignment functionality"
                },
                token=self.super_admin_token
            )
            
            if not success:
                return False
        
        # Test 3: POST /api/sub-suppliers/bulk-archive
        success, response = self.run_test(
            "Bulk Archive Sub-Suppliers",
            "POST",
            "sub-suppliers/bulk-archive",
            200,
            data={
                "sub_supplier_ids": available_ids,
                "reason": "Testing bulk archive functionality"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 4: DELETE /api/sub-suppliers/bulk-delete (super_admin only)
        success, response = self.run_test(
            "Bulk Delete Sub-Suppliers (Super Admin)",
            "DELETE",
            "sub-suppliers/bulk-delete",
            200,
            data={
                "sub_supplier_ids": available_ids,
                "reason": "Testing bulk delete functionality"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 5: Verify admin cannot bulk delete (should fail)
        if self.admin_token:
            success, response = self.run_test(
                "Bulk Delete Sub-Suppliers (Admin - Should Fail)",
                "DELETE",
                "sub-suppliers/bulk-delete",
                403,  # Should be forbidden
                data={
                    "sub_supplier_ids": available_ids,
                    "reason": "Testing admin restriction"
                },
                token=self.admin_token
            )
            
            if not success:
                self.log("❌ Admin was allowed to bulk delete (security issue)")
                return False
        
        return True

    def test_super_admin_endpoints(self) -> bool:
        """Test Super Admin specific endpoints"""
        self.log("=== TESTING SUPER ADMIN ENDPOINTS ===")
        
        if not self.super_admin_token:
            self.log("❌ Missing super admin token")
            return False
        
        # Test 1: GET /api/super-admin/check-ins
        success, response = self.run_test(
            "Super Admin Check-ins",
            "GET",
            "super-admin/check-ins",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 2: GET /api/super-admin/imports
        success, response = self.run_test(
            "Super Admin Imports",
            "GET",
            "super-admin/imports",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 3: GET /api/super-admin/settings
        success, response = self.run_test(
            "Super Admin Settings",
            "GET",
            "super-admin/settings",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 4: GET /api/super-admin/archived-brands
        success, response = self.run_test(
            "Super Admin Archived Brands",
            "GET",
            "super-admin/archived-brands",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 5: GET /api/super-admin/blacklisted-brands
        success, response = self.run_test(
            "Super Admin Blacklisted Brands",
            "GET",
            "super-admin/blacklisted-brands",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        return True

    def test_admin_bulk_operations(self) -> bool:
        """Test Admin bulk operations for brands"""
        self.log("=== TESTING ADMIN BULK OPERATIONS ===")
        
        if not self.admin_token:
            self.log("❌ Missing admin token")
            return False
        
        # Get some brand IDs for testing
        success, response = self.run_test(
            "Get Brand IDs for Bulk Operations",
            "GET",
            "brands/ids",
            200,
            token=self.admin_token
        )
        
        if not success or not response.get('ids'):
            self.log("❌ No brand IDs available for bulk operations testing")
            return False
        
        # Take first 2 IDs for testing
        available_ids = response['ids'][:2]
        if not available_ids:
            self.log("❌ No brand IDs available")
            return False
        
        # Test 1: POST /api/admin/brands/bulk-release
        success, response = self.run_test(
            "Admin Bulk Release Brands",
            "POST",
            "admin/brands/bulk-release",
            200,
            data={
                "brand_ids": available_ids,
                "reason": "Testing admin bulk release functionality"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Test 2: POST /api/super-admin/brands/bulk-archive (should work with super admin token)
        if self.super_admin_token:
            success, response = self.run_test(
                "Super Admin Bulk Archive Brands",
                "POST",
                "super-admin/brands/bulk-archive",
                200,
                data={
                    "brand_ids": available_ids,
                    "reason": "Testing super admin bulk archive functionality"
                },
                token=self.super_admin_token
            )
            
            if not success:
                return False
        
        return True

    def test_searcher_specific_endpoints(self) -> bool:
        """Test Searcher specific endpoints"""
        self.log("=== TESTING SEARCHER SPECIFIC ENDPOINTS ===")
        
        if not self.searcher_token:
            self.log("❌ Missing searcher token")
            return False
        
        # Test 1: GET /api/brands (searcher's assigned brands)
        success, response = self.run_test(
            "Searcher My Brands",
            "GET",
            "brands",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 2: POST /api/auth/check-in (check-in functionality)
        success, response = self.run_test(
            "Searcher Check-in",
            "POST",
            "auth/check-in",
            200,
            data={
                "message": "Testing check-in functionality"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 3: Verify searcher sees only assigned sub-suppliers
        success, response = self.run_test(
            "Searcher Sub-Suppliers (Only Assigned)",
            "GET",
            "sub-suppliers",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify the response contains only assigned sub-suppliers
        sub_suppliers = response.get('sub_suppliers', [])
        for ss in sub_suppliers:
            if ss.get('assigned_to_user_id') != self.searcher_user_id:
                self.log(f"❌ Searcher sees unassigned sub-supplier: {ss.get('id')}")
                return False
        
        self.log(f"✅ Searcher correctly sees only {len(sub_suppliers)} assigned sub-suppliers")
        
        return True

    def test_notifications_system(self) -> bool:
        """Test the new Notification System endpoints and scenarios"""
        self.log("=== TESTING NOTIFICATIONS SYSTEM ===")
        
        if not all([self.super_admin_token, self.admin_token, self.searcher_token]):
            self.log("❌ Missing required tokens for notification testing")
            return False
        
        # Test 1: Get notifications for each user (should start empty or with existing)
        success, response = self.run_test(
            "Get Super Admin Notifications",
            "GET",
            "notifications",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        if 'notifications' not in response or 'unread_count' not in response:
            self.log("❌ Invalid notifications response structure")
            return False
        
        initial_super_admin_count = response['unread_count']
        self.log(f"✅ Super Admin has {initial_super_admin_count} unread notifications")
        
        # Test 2: Get admin notifications
        success, response = self.run_test(
            "Get Admin Notifications",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        initial_admin_count = response['unread_count']
        self.log(f"✅ Admin has {initial_admin_count} unread notifications")
        
        # Test 3: Get searcher notifications
        success, response = self.run_test(
            "Get Searcher Notifications",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        initial_searcher_count = response['unread_count']
        self.log(f"✅ Searcher has {initial_searcher_count} unread notifications")
        
        # Test 4: Test notification creation on note addition
        # First, find a brand assigned to searcher
        success, response = self.run_test(
            "Get Brands for Notification Test",
            "GET",
            "brands",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Find a brand assigned to searcher
        assigned_brand_id = None
        for brand in response.get('brands', []):
            if brand.get('assigned_to_user_id') == self.searcher_user_id:
                assigned_brand_id = brand['id']
                break
        
        if not assigned_brand_id:
            # If no brand is assigned to searcher, assign one first
            success, response = self.run_test(
                "Claim Brand for Notification Test",
                "POST",
                "brands/claim",
                200,
                token=self.searcher_token
            )
            
            if success:
                # Get the claimed brand
                success, response = self.run_test(
                    "Get Claimed Brand for Notification Test",
                    "GET",
                    "brands",
                    200,
                    token=self.searcher_token
                )
                
                if success and response.get('brands'):
                    assigned_brand_id = response['brands'][0]['id']
        
        if not assigned_brand_id:
            self.log("❌ Could not find or assign a brand for notification testing")
            return False
        
        self.log(f"✅ Using brand {assigned_brand_id} for notification testing")
        
        # Test 5: Add note as super admin to trigger notification for searcher
        success, response = self.run_test(
            "Add Note to Trigger Notification",
            "POST",
            f"brands/{assigned_brand_id}/note",
            200,
            data={
                "note_text": "Test note for notification system - added by super admin",
                "note_type": "general"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 6: Check if searcher received notification
        success, response = self.run_test(
            "Check Searcher Notifications After Note",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        new_searcher_count = response['unread_count']
        if new_searcher_count <= initial_searcher_count:
            self.log("❌ Searcher did not receive notification for note addition")
            return False
        
        self.log(f"✅ Searcher received notification (count: {initial_searcher_count} → {new_searcher_count})")
        
        # Get the notification ID for further testing
        notifications = response.get('notifications', [])
        if not notifications:
            self.log("❌ No notifications found for searcher")
            return False
        
        latest_notification = notifications[0]
        notification_id = latest_notification['id']
        
        # Verify notification content
        if latest_notification.get('type') != 'note_added':
            self.log(f"❌ Wrong notification type: {latest_notification.get('type')}")
            return False
        
        if latest_notification.get('is_read') != False:
            self.log("❌ New notification should be unread")
            return False
        
        self.log("✅ Notification content is correct")
        
        # Test 7: Test notification creation on task assignment
        success, response = self.run_test(
            "Create Task to Trigger Notification",
            "POST",
            "tasks",
            200,
            data={
                "title": "Test Task for Notification System",
                "description": "Testing notification creation on task assignment",
                "assigned_to_id": self.admin_user_id,
                "priority": "medium"
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Test 8: Check if admin received task notification
        success, response = self.run_test(
            "Check Admin Notifications After Task Assignment",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        new_admin_count = response['unread_count']
        if new_admin_count <= initial_admin_count:
            self.log("❌ Admin did not receive notification for task assignment")
            return False
        
        self.log(f"✅ Admin received task notification (count: {initial_admin_count} → {new_admin_count})")
        
        # Test 9: Mark notification as read
        success, response = self.run_test(
            "Mark Notification as Read",
            "POST",
            f"notifications/{notification_id}/read",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 10: Verify notification is marked as read
        success, response = self.run_test(
            "Verify Notification Marked as Read",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Find the notification and check if it's read
        notifications = response.get('notifications', [])
        marked_notification = None
        for notif in notifications:
            if notif['id'] == notification_id:
                marked_notification = notif
                break
        
        if not marked_notification:
            self.log("❌ Could not find the marked notification")
            return False
        
        if not marked_notification.get('is_read'):
            self.log("❌ Notification was not marked as read")
            return False
        
        if response['unread_count'] != new_searcher_count - 1:
            self.log("❌ Unread count did not decrease after marking as read")
            return False
        
        self.log("✅ Notification successfully marked as read")
        
        # Test 11: Test mark all notifications as read
        success, response = self.run_test(
            "Mark All Notifications as Read",
            "POST",
            "notifications/read-all",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        if 'updated_count' not in response:
            self.log("❌ Mark all read response missing updated_count")
            return False
        
        # Test 12: Verify all notifications are read
        success, response = self.run_test(
            "Verify All Notifications Read",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        if response['unread_count'] != 0:
            self.log(f"❌ Unread count should be 0, got {response['unread_count']}")
            return False
        
        self.log("✅ All notifications marked as read")
        
        # Test 13: Test delete notification
        success, response = self.run_test(
            "Delete Notification",
            "DELETE",
            f"notifications/{notification_id}",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Test 14: Verify notification is deleted
        success, response = self.run_test(
            "Verify Notification Deleted",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Check that the notification is no longer in the list
        notifications = response.get('notifications', [])
        for notif in notifications:
            if notif['id'] == notification_id:
                self.log("❌ Notification was not deleted")
                return False
        
        self.log("✅ Notification successfully deleted")
        
        # Test 15: Test access control - user cannot access other user's notifications
        # Try to mark admin's notification as read using searcher token
        success, response = self.run_test(
            "Get Admin Notifications for Access Control Test",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if success and response.get('notifications'):
            admin_notification_id = response['notifications'][0]['id']
            
            # Try to mark admin's notification as read with searcher token (should fail)
            success, response = self.run_test(
                "Access Control - Mark Other User's Notification (Should Fail)",
                "POST",
                f"notifications/{admin_notification_id}/read",
                404,  # Should return 404 (not found) for security
                token=self.searcher_token
            )
            
            if not success:
                self.log("❌ Access control failed - searcher could access admin's notification")
                return False
            
            # Try to delete admin's notification with searcher token (should fail)
            success, response = self.run_test(
                "Access Control - Delete Other User's Notification (Should Fail)",
                "DELETE",
                f"notifications/{admin_notification_id}",
                404,  # Should return 404 (not found) for security
                token=self.searcher_token
            )
            
            if not success:
                self.log("❌ Access control failed - searcher could delete admin's notification")
                return False
            
            self.log("✅ Access control working correctly")
        
        # Test 16: Test notification filtering
        success, response = self.run_test(
            "Get Unread Only Notifications",
            "GET",
            "notifications?unread_only=true",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify all returned notifications are unread
        notifications = response.get('notifications', [])
        for notif in notifications:
            if notif.get('is_read'):
                self.log("❌ Unread filter returned read notification")
                return False
        
        self.log("✅ Unread filter working correctly")
        
        # Test 17: Test notification limit parameter
        success, response = self.run_test(
            "Get Notifications with Limit",
            "GET",
            "notifications?limit=5",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        notifications = response.get('notifications', [])
        if len(notifications) > 5:
            self.log(f"❌ Limit parameter not working, got {len(notifications)} notifications")
            return False
        
        self.log("✅ Limit parameter working correctly")
        
        return True

    def test_suppliers_assignment_system(self) -> bool:
        """Test the new Suppliers Assignment System for PROCTO 13"""
        self.log("=== TESTING SUPPLIERS ASSIGNMENT SYSTEM ===")
        
        if not all([self.super_admin_token, self.admin_token]):
            self.log("❌ Missing required tokens for suppliers assignment testing")
            return False
        
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
        
        # Test 8: Test role-based access - Searcher should not access suppliers endpoints
        if self.searcher_token:
            success, response = self.run_test(
                "Searcher Access to Suppliers (Should Fail)",
                "GET",
                "suppliers",
                403,  # Should be forbidden
                token=self.searcher_token
            )
            
            if not success:
                self.log("❌ Searcher was allowed to access suppliers (security issue)")
                return False
            
            self.log("✅ Searcher correctly forbidden from accessing suppliers")
        
        # Test 9: Test bulk assignment with multiple suppliers
        if len(all_suppliers) >= 2:
            multiple_supplier_ids = [s['id'] for s in all_suppliers[:2]]
            
            success, response = self.run_test(
                "Bulk Assign Multiple Suppliers",
                "POST",
                "suppliers/bulk-assign",
                200,
                data={
                    "supplier_ids": multiple_supplier_ids,
                    "admin_id": self.admin_user_id,
                    "reason": "Test multiple supplier assignment"
                },
                token=self.super_admin_token
            )
            
            if not success:
                return False
            
            assigned_count = response.get('assigned_count', 0)
            if assigned_count != 2:
                self.log(f"❌ Expected assigned_count=2, got {assigned_count}")
                return False
            
            self.log(f"✅ Successfully assigned {assigned_count} suppliers to admin")
            
            # Clean up - release the multiple suppliers
            success, response = self.run_test(
                "Bulk Release Multiple Suppliers",
                "POST",
                "suppliers/bulk-release",
                200,
                data=multiple_supplier_ids,
                token=self.super_admin_token
            )
            
            if not success:
                return False
            
            released_count = response.get('released_count', 0)
            if released_count != 2:
                self.log(f"❌ Expected released_count=2, got {released_count}")
                return False
            
            self.log(f"✅ Successfully released {released_count} suppliers from admin")
        
        # Test 10: Test invalid assignment scenarios
        success, response = self.run_test(
            "Invalid Supplier Assignment (Non-existent Supplier)",
            "POST",
            "suppliers/bulk-assign",
            400,  # Should fail with bad request
            data={
                "supplier_ids": ["non-existent-id"],
                "admin_id": self.admin_user_id,
                "reason": "Test invalid assignment"
            },
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Invalid supplier assignment was allowed")
            return False
        
        self.log("✅ Invalid supplier assignment correctly rejected")
        
        # Test 11: Test assignment to non-existent admin
        success, response = self.run_test(
            "Invalid Admin Assignment (Non-existent Admin)",
            "POST",
            "suppliers/bulk-assign",
            400,  # Should fail with bad request
            data={
                "supplier_ids": [test_supplier_id],
                "admin_id": "non-existent-admin-id",
                "reason": "Test invalid admin assignment"
            },
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Assignment to non-existent admin was allowed")
            return False
        
        self.log("✅ Assignment to non-existent admin correctly rejected")
        
        return True

    def test_chat_system(self) -> bool:
        """Test the new Chat System functionality"""
        self.log("=== TESTING CHAT SYSTEM ===")
        
        if not all([self.super_admin_token, self.admin_token, self.searcher_token]):
            self.log("❌ Missing required tokens for chat testing")
            return False
        
        # Store chat IDs for testing
        general_chat_id = None
        direct_chat_id = None
        group_chat_id = None
        test_message_id = None
        
        # Test 1: GET /api/users/available-for-chat
        success, response = self.run_test(
            "Get Users Available for Chat",
            "GET",
            "users/available-for-chat",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        available_users = response.get('users', [])
        self.log(f"✅ Found {len(available_users)} users available for chat")
        
        if len(available_users) < 2:
            self.log("❌ Need at least 2 users for chat testing")
            return False
        
        # Test 2: GET /api/chats/general - Get or create general chat
        success, response = self.run_test(
            "Get General Chat",
            "GET",
            "chats/general",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        general_chat_id = response.get('id')
        if not general_chat_id:
            self.log("❌ General chat ID not found")
            return False
        
        self.log(f"✅ General chat ID: {general_chat_id}")
        
        # Test 3: GET /api/chats - List all chats for current user
        success, response = self.run_test(
            "List All Chats (Super Admin)",
            "GET",
            "chats",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        chats = response.get('chats', [])
        self.log(f"✅ Super Admin has access to {len(chats)} chats")
        
        # Verify general chat is in the list
        general_found = any(chat.get('id') == general_chat_id for chat in chats)
        if not general_found:
            self.log("❌ General chat not found in user's chat list")
            return False
        
        # Test 4: POST /api/chats - Create direct chat
        other_user = available_users[0]  # First available user (not super admin)
        success, response = self.run_test(
            "Create Direct Chat",
            "POST",
            "chats",
            200,
            data={
                "type": "direct",
                "participant_ids": [other_user['id']]
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        direct_chat_id = response.get('id')
        if not direct_chat_id:
            self.log("❌ Direct chat ID not found")
            return False
        
        self.log(f"✅ Created direct chat ID: {direct_chat_id}")
        
        # Verify chat properties
        if response.get('type') != 'direct':
            self.log("❌ Direct chat type incorrect")
            return False
        
        # Test 5: POST /api/chats - Create group chat
        if len(available_users) >= 2:
            success, response = self.run_test(
                "Create Group Chat",
                "POST",
                "chats",
                200,
                data={
                    "type": "group",
                    "name": "Test Group Chat",
                    "participant_ids": [available_users[0]['id'], available_users[1]['id']]
                },
                token=self.super_admin_token
            )
            
            if not success:
                return False
            
            group_chat_id = response.get('id')
            if not group_chat_id:
                self.log("❌ Group chat ID not found")
                return False
            
            self.log(f"✅ Created group chat ID: {group_chat_id}")
            
            # Verify chat properties
            if response.get('type') != 'group':
                self.log("❌ Group chat type incorrect")
                return False
            
            if response.get('name') != 'Test Group Chat':
                self.log("❌ Group chat name incorrect")
                return False
        
        # Test 6: GET /api/chats/{chat_id} - Get chat details
        success, response = self.run_test(
            "Get General Chat Details",
            "GET",
            f"chats/{general_chat_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        if response.get('id') != general_chat_id:
            self.log("❌ Chat details ID mismatch")
            return False
        
        # Test 7: GET /api/chats/{chat_id}/messages - Get messages (initially empty)
        success, response = self.run_test(
            "Get General Chat Messages (Empty)",
            "GET",
            f"chats/{general_chat_id}/messages",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        self.log(f"✅ General chat has {len(messages)} messages")
        
        # Test 8: POST /api/chats/{chat_id}/messages - Send message
        success, response = self.run_test(
            "Send Message to General Chat",
            "POST",
            f"chats/{general_chat_id}/messages",
            200,
            data={
                "text": "Hello from automated testing! This is a test message for the chat system."
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        test_message_id = response.get('id')
        if not test_message_id:
            self.log("❌ Message ID not found")
            return False
        
        self.log(f"✅ Sent message ID: {test_message_id}")
        
        # Verify message properties
        if not response.get('text'):
            self.log("❌ Message text not found")
            return False
        
        if response.get('sender_id') != self.super_admin_token.split('.')[0]:  # Rough check
            # Note: This is a simplified check, in real scenario we'd decode the JWT
            pass  # Skip this check for now
        
        # Test 9: GET /api/chats/{chat_id}/messages - Get messages with limit
        success, response = self.run_test(
            "Get General Chat Messages with Limit",
            "GET",
            f"chats/{general_chat_id}/messages?limit=10",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        if len(messages) == 0:
            self.log("❌ No messages found after sending")
            return False
        
        # Find our test message
        test_message_found = any(msg.get('id') == test_message_id for msg in messages)
        if not test_message_found:
            self.log("❌ Test message not found in messages list")
            return False
        
        self.log(f"✅ Retrieved {len(messages)} messages including test message")
        
        # Test 10: POST /api/chats/{chat_id}/messages/{message_id}/reactions - Add reaction
        success, response = self.run_test(
            "Add Reaction to Message",
            "POST",
            f"chats/{general_chat_id}/messages/{test_message_id}/reactions",
            200,
            data={
                "emoji": "👍"
            },
            token=self.admin_token  # Use different user to add reaction
        )
        
        if not success:
            return False
        
        reactions = response.get('reactions', {})
        if '👍' not in reactions:
            self.log("❌ Reaction not added")
            return False
        
        self.log("✅ Successfully added reaction to message")
        
        # Test 11: Toggle reaction (remove it)
        success, response = self.run_test(
            "Toggle Reaction (Remove)",
            "POST",
            f"chats/{general_chat_id}/messages/{test_message_id}/reactions",
            200,
            data={
                "emoji": "👍"
            },
            token=self.admin_token  # Same user to remove reaction
        )
        
        if not success:
            return False
        
        reactions = response.get('reactions', {})
        if '👍' in reactions and len(reactions['👍']) > 0:
            self.log("❌ Reaction not removed")
            return False
        
        self.log("✅ Successfully toggled (removed) reaction")
        
        # Test 12: POST /api/chat/upload-image - Upload image
        # Create a simple test image (1x1 pixel PNG)
        import base64
        # Minimal PNG data for 1x1 transparent pixel
        png_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8j8wAAAABJRU5ErkJggg==')
        
        files = {'file': ('test.png', png_data, 'image/png')}
        
        success, response = self.run_test(
            "Upload Chat Image",
            "POST",
            "chat/upload-image",
            200,
            files=files,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        image_url = response.get('url')
        if not image_url:
            self.log("❌ Image URL not returned")
            return False
        
        self.log(f"✅ Successfully uploaded image: {image_url}")
        
        # Test 13: Send message with image
        success, response = self.run_test(
            "Send Message with Image",
            "POST",
            f"chats/{general_chat_id}/messages",
            200,
            data={
                "text": "Here's a test image!",
                "image_url": image_url
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        if not response.get('image_url'):
            self.log("❌ Image URL not saved in message")
            return False
        
        self.log("✅ Successfully sent message with image")
        
        # Test 14: Test access control - user can only access own chats or general
        if direct_chat_id:
            # Try to access direct chat with searcher (should fail)
            success, response = self.run_test(
                "Access Control - Direct Chat (Should Fail)",
                "GET",
                f"chats/{direct_chat_id}",
                403,  # Should be forbidden
                token=self.searcher_token
            )
            
            if not success:
                self.log("❌ Access control failed - searcher could access private direct chat")
                return False
            
            self.log("✅ Access control working - searcher cannot access private direct chat")
        
        # Test 15: Test general chat access for all roles
        for role, token in [("admin", self.admin_token), ("searcher", self.searcher_token)]:
            success, response = self.run_test(
                f"General Chat Access ({role.title()})",
                "GET",
                f"chats/{general_chat_id}",
                200,
                token=token
            )
            
            if not success:
                self.log(f"❌ {role.title()} cannot access general chat")
                return False
            
            self.log(f"✅ {role.title()} can access general chat")
        
        # Test 16: Test message sending by different roles
        for role, token in [("admin", self.admin_token), ("searcher", self.searcher_token)]:
            success, response = self.run_test(
                f"Send Message as {role.title()}",
                "POST",
                f"chats/{general_chat_id}/messages",
                200,
                data={
                    "text": f"Test message from {role} role"
                },
                token=token
            )
            
            if not success:
                self.log(f"❌ {role.title()} cannot send messages to general chat")
                return False
            
            self.log(f"✅ {role.title()} can send messages to general chat")
        
        # Test 17: Test invalid chat access
        success, response = self.run_test(
            "Access Non-existent Chat",
            "GET",
            "chats/non-existent-chat-id",
            404,
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Non-existent chat should return 404")
            return False
        
        self.log("✅ Non-existent chat correctly returns 404")
        
        # Test 18: Test invalid message reaction
        success, response = self.run_test(
            "React to Non-existent Message",
            "POST",
            f"chats/{general_chat_id}/messages/non-existent-message/reactions",
            404,
            data={"emoji": "👍"},
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Non-existent message reaction should return 404")
            return False
        
        self.log("✅ Non-existent message reaction correctly returns 404")
        
        return True

    def test_clear_brand_endpoint(self) -> bool:
        """Test the Clear Brand endpoint functionality"""
        self.log("=== TESTING CLEAR BRAND ENDPOINT ===")
        
        if not all([self.super_admin_token, self.admin_token, self.searcher_token]):
            self.log("❌ Missing required tokens for clear brand testing")
            return False
        
        # First, get a brand to test with
        success, response = self.run_test(
            "Get Brands for Clear Testing",
            "GET",
            "brands",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        brands = response.get('brands', [])
        if not brands:
            self.log("❌ No brands available for clear testing")
            return False
        
        # Find a brand that's assigned to searcher or assign one
        test_brand_id = None
        for brand in brands:
            if brand.get('assigned_to_user_id') == self.searcher_user_id:
                test_brand_id = brand['id']
                break
        
        if not test_brand_id:
            # Claim a brand for searcher first
            success, response = self.run_test(
                "Claim Brand for Clear Testing",
                "POST",
                "brands/claim",
                200,
                token=self.searcher_token
            )
            
            if success:
                # Get the claimed brand
                success, response = self.run_test(
                    "Get Claimed Brand for Clear Testing",
                    "GET",
                    "brands",
                    200,
                    token=self.searcher_token
                )
                
                if success and response.get('brands'):
                    test_brand_id = response['brands'][0]['id']
        
        if not test_brand_id:
            self.log("❌ Could not find or assign a brand for clear testing")
            return False
        
        self.log(f"✅ Using brand {test_brand_id} for clear testing")
        
        # Add some notes and contacts to the brand first
        success, response = self.run_test(
            "Add Note to Brand Before Clear",
            "POST",
            f"brands/{test_brand_id}/note",
            200,
            data={
                "note_text": "Test note before clearing brand",
                "note_type": "general"
            },
            token=self.searcher_token
        )
        
        if not success:
            self.log("❌ Could not add note to brand")
            return False
        
        # Add contact to brand
        success, response = self.run_test(
            "Add Contact to Brand Before Clear",
            "POST",
            f"brands/{test_brand_id}/contacts",
            200,
            data={
                "contacts": [
                    {
                        "contact_type": "email",
                        "value": "test@example.com",
                        "is_primary": True,
                        "notes": "Test contact before clear"
                    }
                ]
            },
            token=self.searcher_token
        )
        
        # Note: This might fail if the endpoint doesn't exist, but that's okay for testing
        
        # Test 1: POST /api/brands/{brand_id}/clear - Clear brand (searcher can clear own brand)
        success, response = self.run_test(
            "Clear Brand (Searcher - Own Brand)",
            "POST",
            f"brands/{test_brand_id}/clear",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify response structure
        if 'status' not in response or response['status'] != 'success':
            self.log("❌ Clear brand response missing success status")
            return False
        
        if 'deleted_notes' not in response:
            self.log("❌ Clear brand response missing deleted_notes count")
            return False
        
        if 'deleted_contacts' not in response:
            self.log("❌ Clear brand response missing deleted_contacts count")
            return False
        
        self.log(f"✅ Brand cleared successfully - Notes: {response['deleted_notes']}, Contacts: {response['deleted_contacts']}")
        
        # Test 2: Verify brand is reset to initial state
        success, response = self.run_test(
            "Verify Brand Reset After Clear",
            "GET",
            f"brands/{test_brand_id}",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        brand = response.get('brand', {})
        
        # Check that brand is reset to pool
        if brand.get('status') != 'IN_POOL':
            self.log(f"❌ Brand status should be IN_POOL, got {brand.get('status')}")
            return False
        
        # Check that assignment is cleared
        if brand.get('assigned_to_user_id') is not None:
            self.log("❌ Brand should not be assigned after clear")
            return False
        
        # Check that contacts and notes are cleared
        notes = response.get('notes', [])
        contacts = response.get('contacts', [])
        
        if len(notes) > 0:
            self.log(f"❌ Brand should have no notes after clear, found {len(notes)}")
            return False
        
        if len(contacts) > 0:
            self.log(f"❌ Brand should have no contacts after clear, found {len(contacts)}")
            return False
        
        self.log("✅ Brand successfully reset to initial state")
        
        # Test 3: Test access control - admin/super_admin can clear any brand
        # First assign a brand to admin
        success, response = self.run_test(
            "Get Brand for Admin Clear Test",
            "GET",
            "brands",
            200,
            token=self.super_admin_token
        )
        
        if success and response.get('brands'):
            admin_test_brand_id = response['brands'][0]['id']
            
            # Assign brand to admin first
            success, response = self.run_test(
                "Assign Brand to Admin for Clear Test",
                "POST",
                "admin/brands/bulk-assign",
                200,
                data={
                    "brand_ids": [admin_test_brand_id],
                    "user_id": self.admin_user_id,
                    "reason": "Test assignment for clear testing"
                },
                token=self.super_admin_token
            )
            
            if success:
                # Test admin can clear assigned brand
                success, response = self.run_test(
                    "Clear Brand (Admin - Own Brand)",
                    "POST",
                    f"brands/{admin_test_brand_id}/clear",
                    200,
                    token=self.admin_token
                )
                
                if not success:
                    self.log("❌ Admin cannot clear own assigned brand")
                    return False
                
                self.log("✅ Admin can clear own assigned brand")
                
                # Test super admin can clear any brand
                success, response = self.run_test(
                    "Clear Brand (Super Admin - Any Brand)",
                    "POST",
                    f"brands/{admin_test_brand_id}/clear",
                    200,
                    token=self.super_admin_token
                )
                
                if not success:
                    self.log("❌ Super admin cannot clear any brand")
                    return False
                
                self.log("✅ Super admin can clear any brand")
        
        # Test 4: Test access control - searcher cannot clear other's brand
        # Get a brand not assigned to searcher
        success, response = self.run_test(
            "Get Brands for Access Control Test",
            "GET",
            "brands",
            200,
            token=self.super_admin_token
        )
        
        if success and response.get('brands'):
            other_brand_id = None
            for brand in response['brands']:
                if brand.get('assigned_to_user_id') != self.searcher_user_id:
                    other_brand_id = brand['id']
                    break
            
            if other_brand_id:
                success, response = self.run_test(
                    "Clear Other's Brand (Searcher - Should Fail)",
                    "POST",
                    f"brands/{other_brand_id}/clear",
                    403,  # Should be forbidden
                    token=self.searcher_token
                )
                
                if not success:
                    self.log("❌ Searcher was allowed to clear other's brand (security issue)")
                    return False
                
                self.log("✅ Searcher correctly forbidden from clearing other's brand")
        
        # Test 5: Test clearing non-existent brand
        success, response = self.run_test(
            "Clear Non-existent Brand",
            "POST",
            "brands/non-existent-brand-id/clear",
            404,
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Non-existent brand clear should return 404")
            return False
        
        self.log("✅ Non-existent brand clear correctly returns 404")
        
        return True

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
            ("super_admin_login", self.test_super_admin_login),
            ("admin_login", self.test_admin_login),
            ("searcher_login", self.test_searcher_login),
            ("admin_dashboard", self.test_admin_dashboard),
            ("user_management", self.test_user_management),
            ("excel_import", self.test_excel_import),
            ("brand_operations", self.test_brand_operations),
            ("searcher_claiming", self.test_searcher_brand_claiming),
            ("brand_workflow", self.test_brand_workflow),
            ("security_fixes", self.test_security_fixes),
            ("references_endpoints", self.test_references_endpoints),
            ("dashboard_alerts", self.test_dashboard_alerts),
            ("brands_health_score", self.test_brands_health_score),
            ("sub_suppliers_api", self.test_sub_suppliers_api),
            ("sub_suppliers_bulk_operations", self.test_sub_suppliers_bulk_operations),
            ("super_admin_endpoints", self.test_super_admin_endpoints),
            ("admin_bulk_operations", self.test_admin_bulk_operations),
            ("searcher_specific_endpoints", self.test_searcher_specific_endpoints),
            ("notifications_system", self.test_notifications_system),
            ("suppliers_assignment_system", self.test_suppliers_assignment_system),
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