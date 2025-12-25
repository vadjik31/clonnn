#!/usr/bin/env python3
"""
PROCTO 13 Role Audit Test - Focus on specific endpoints from review request
"""

import requests
import json
from datetime import datetime

class RoleAuditTester:
    def __init__(self, base_url: str = "https://brand-pipeline-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.searcher_token = None
        self.searcher_user_id = None
        self.results = []

    def log(self, message: str, status: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        self.results.append({"timestamp": timestamp, "status": status, "message": message})

    def test_endpoint(self, name: str, method: str, endpoint: str, token: str, expected_status: int = 200, data: dict = None):
        """Test a single endpoint"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if response.status_code == expected_status:
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"   Response: {response.text[:200]}", "FAIL")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def login_all_roles(self):
        """Login as all three roles"""
        self.log("=== LOGGING IN AS ALL ROLES ===")
        
        # Super Admin
        success, response = self.test_endpoint(
            "Super Admin Login", "POST", "auth/login", "",
            data={"email": "admin@procto13.com", "password": "admin123", "secret_code": "PROCTO13"}
        )
        if success and 'token' in response:
            self.super_admin_token = response['token']
            self.log(f"✅ Super Admin token obtained")
        
        # Admin
        success, response = self.test_endpoint(
            "Admin Login", "POST", "auth/login", "",
            data={"email": "azamat@gmail.com", "password": "azamat", "secret_code": "AZAMAT"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log(f"✅ Admin token obtained")
        
        # Searcher
        success, response = self.test_endpoint(
            "Searcher Login", "POST", "auth/login", "",
            data={"email": "searcher@procto13.com", "password": "searcher123", "secret_code": "PROCTO13"}
        )
        if success and 'token' in response:
            self.searcher_token = response['token']
            self.searcher_user_id = response['user']['id']
            self.log(f"✅ Searcher token obtained, ID: {self.searcher_user_id}")

    def test_sub_supplier_bulk_operations(self):
        """Test NEW sub-supplier bulk operations"""
        self.log("=== TESTING SUB-SUPPLIER BULK OPERATIONS ===")
        
        if not self.super_admin_token:
            self.log("❌ Missing super admin token", "FAIL")
            return
        
        # Get sub-supplier IDs
        success, response = self.test_endpoint(
            "Get Sub-Supplier IDs", "GET", "sub-suppliers/ids", self.super_admin_token
        )
        
        if success and response.get('ids'):
            ids = response['ids'][:2]  # Take first 2
            self.log(f"✅ Found {len(ids)} sub-supplier IDs for testing")
            
            # Test bulk release
            self.test_endpoint(
                "Bulk Release Sub-Suppliers", "POST", "sub-suppliers/bulk-release", 
                self.super_admin_token, data={"sub_supplier_ids": ids, "reason": "Test bulk release"}
            )
            
            # Test bulk assign
            if self.searcher_user_id:
                self.test_endpoint(
                    "Bulk Assign Sub-Suppliers", "POST", f"sub-suppliers/bulk-assign?user_id={self.searcher_user_id}", 
                    self.super_admin_token, data={"sub_supplier_ids": ids, "reason": "Test bulk assign"}
                )
            
            # Test bulk archive
            self.test_endpoint(
                "Bulk Archive Sub-Suppliers", "POST", "sub-suppliers/bulk-archive", 
                self.super_admin_token, data={"sub_supplier_ids": ids, "reason": "Test bulk archive"}
            )
            
            # Test bulk delete (super admin only)
            self.test_endpoint(
                "Bulk Delete Sub-Suppliers", "DELETE", "sub-suppliers/bulk-delete", 
                self.super_admin_token, data={"sub_supplier_ids": ids, "reason": "Test bulk delete"}
            )
        else:
            self.log("❌ No sub-supplier IDs available for testing", "FAIL")

    def test_super_admin_endpoints(self):
        """Test Super Admin specific endpoints"""
        self.log("=== TESTING SUPER ADMIN ENDPOINTS ===")
        
        if not self.super_admin_token:
            self.log("❌ Missing super admin token", "FAIL")
            return
        
        endpoints = [
            "super-admin/check-ins",
            "super-admin/imports", 
            "super-admin/settings",
            "super-admin/archived-brands",
            "super-admin/blacklisted-brands"
        ]
        
        for endpoint in endpoints:
            self.test_endpoint(f"Super Admin {endpoint.split('/')[-1].title()}", "GET", endpoint, self.super_admin_token)

    def test_admin_endpoints(self):
        """Test Admin endpoints"""
        self.log("=== TESTING ADMIN ENDPOINTS ===")
        
        if not self.admin_token:
            self.log("❌ Missing admin token", "FAIL")
            return
        
        # Dashboard
        self.test_endpoint("Admin Dashboard", "GET", "dashboard", self.admin_token)
        
        # Get brand IDs for bulk operations
        success, response = self.test_endpoint("Get Brand IDs", "GET", "brands/ids", self.admin_token)
        
        if success and response.get('ids'):
            ids = response['ids'][:2]
            self.log(f"✅ Found {len(ids)} brand IDs for testing")
            
            # Test admin bulk release
            self.test_endpoint(
                "Admin Bulk Release Brands", "POST", "admin/brands/bulk-release",
                self.admin_token, data={"brand_ids": ids, "reason": "Test admin bulk release"}
            )
        
        # Test super admin bulk archive (with super admin token)
        if self.super_admin_token and success and response.get('ids'):
            self.test_endpoint(
                "Super Admin Bulk Archive Brands", "POST", "super-admin/brands/bulk-archive",
                self.super_admin_token, data={"brand_ids": ids, "reason": "Test super admin bulk archive"}
            )

    def test_searcher_endpoints(self):
        """Test Searcher specific endpoints"""
        self.log("=== TESTING SEARCHER ENDPOINTS ===")
        
        if not self.searcher_token:
            self.log("❌ Missing searcher token", "FAIL")
            return
        
        # Test searcher's brands (filtered automatically)
        self.test_endpoint("Searcher Brands", "GET", "brands", self.searcher_token)
        
        # Test searcher's sub-suppliers (filtered automatically)
        self.test_endpoint("Searcher Sub-Suppliers", "GET", "sub-suppliers", self.searcher_token)
        
        # Test check-in
        self.test_endpoint(
            "Searcher Check-in", "POST", "auth/check-in", self.searcher_token,
            data={"message": "Testing check-in functionality"}
        )
        
        # Test brand claiming
        self.test_endpoint("Searcher Claim Brands", "POST", "brands/claim", self.searcher_token)

    def test_role_restrictions(self):
        """Test role-based access restrictions"""
        self.log("=== TESTING ROLE RESTRICTIONS ===")
        
        # Searcher should NOT access sub-suppliers/ids
        if self.searcher_token:
            self.test_endpoint(
                "Searcher Sub-Suppliers IDs (Should Fail)", "GET", "sub-suppliers/ids", 
                self.searcher_token, expected_status=403
            )
        
        # Admin should NOT bulk delete sub-suppliers
        if self.admin_token:
            self.test_endpoint(
                "Admin Bulk Delete Sub-Suppliers (Should Fail)", "DELETE", "sub-suppliers/bulk-delete",
                self.admin_token, expected_status=403, 
                data={"sub_supplier_ids": ["test-id"], "reason": "Test restriction"}
            )

    def run_full_audit(self):
        """Run complete role audit"""
        self.log("🚀 Starting PROCTO 13 Full Role Audit")
        
        # Login all roles
        self.login_all_roles()
        
        # Test all endpoints
        self.test_sub_supplier_bulk_operations()
        self.test_super_admin_endpoints()
        self.test_admin_endpoints()
        self.test_searcher_endpoints()
        self.test_role_restrictions()
        
        # Summary
        passed = len([r for r in self.results if r['status'] == 'PASS'])
        failed = len([r for r in self.results if r['status'] == 'FAIL'])
        errors = len([r for r in self.results if r['status'] == 'ERROR'])
        
        self.log("=" * 50)
        self.log(f"📊 AUDIT COMPLETE: {passed} passed, {failed} failed, {errors} errors")
        
        if failed > 0 or errors > 0:
            self.log("❌ FAILED/ERROR TESTS:")
            for r in self.results:
                if r['status'] in ['FAIL', 'ERROR']:
                    self.log(f"   - {r['message']}")
        
        return {"passed": passed, "failed": failed, "errors": errors, "results": self.results}

if __name__ == "__main__":
    tester = RoleAuditTester()
    results = tester.run_full_audit()
    
    # Save results
    with open('/app/test_reports/role_audit_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    exit(0 if results["failed"] == 0 and results["errors"] == 0 else 1)