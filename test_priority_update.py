#!/usr/bin/env python3
"""
PROCTO 13 Brand Management System - Manual Priority Update Feature Testing
Tests the new manual priority update feature for brands with role-based access control
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class PriorityUpdateTester:
    def __init__(self, base_url: str = "https://brandsync-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.searcher_token = None
        self.test_brand_id = None
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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, json=data, headers=headers, timeout=30)
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

    def authenticate_users(self) -> bool:
        """Authenticate all three user types"""
        self.log("=== AUTHENTICATING USERS ===")
        
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
        
        if success and 'token' in response:
            self.super_admin_token = response['token']
            self.log(f"✅ Super Admin authenticated")
        else:
            self.log("❌ Failed to authenticate Super Admin")
            return False

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
        
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log(f"✅ Admin authenticated")
        else:
            self.log("❌ Failed to authenticate Admin")
            return False

        # Searcher Login
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
            self.log(f"✅ Searcher authenticated")
        else:
            self.log("❌ Failed to authenticate Searcher")
            return False

        return True

    def get_test_brand(self) -> bool:
        """Get a brand for testing priority updates"""
        self.log("=== GETTING TEST BRAND ===")
        
        # Get brands with limit=1
        success, response = self.run_test(
            "Get Brand for Testing",
            "GET",
            "brands?limit=1",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        brands = response.get('brands', [])
        if not brands:
            self.log("❌ No brands available for testing")
            return False
        
        self.test_brand_id = brands[0]['id']
        original_priority = brands[0].get('priority_score', 0)
        
        self.log(f"✅ Using brand ID: {self.test_brand_id}")
        self.log(f"✅ Original priority score: {original_priority}")
        
        return True

    def test_super_admin_priority_update(self) -> bool:
        """Test Super Admin can update brand priority"""
        self.log("=== TESTING SUPER ADMIN PRIORITY UPDATE ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Test updating priority to 1000
        new_priority = 1000
        success, response = self.run_test(
            "Super Admin Priority Update",
            "PUT",
            f"brands/{self.test_brand_id}/info",
            200,
            data={"priority_score": new_priority},
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Verify the priority was updated
        success, response = self.run_test(
            "Verify Super Admin Priority Update",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        updated_priority = response.get('brand', {}).get('priority_score')
        if updated_priority != new_priority:
            self.log(f"❌ Priority not updated. Expected: {new_priority}, Got: {updated_priority}")
            return False
        
        self.log(f"✅ Super Admin successfully updated priority to {new_priority}")
        return True

    def test_admin_priority_update(self) -> bool:
        """Test Admin can update brand priority"""
        self.log("=== TESTING ADMIN PRIORITY UPDATE ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Test updating priority to 2000
        new_priority = 2000
        success, response = self.run_test(
            "Admin Priority Update",
            "PUT",
            f"brands/{self.test_brand_id}/info",
            200,
            data={"priority_score": new_priority},
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify the priority was updated
        success, response = self.run_test(
            "Verify Admin Priority Update",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        updated_priority = response.get('brand', {}).get('priority_score')
        if updated_priority != new_priority:
            self.log(f"❌ Priority not updated. Expected: {new_priority}, Got: {updated_priority}")
            return False
        
        self.log(f"✅ Admin successfully updated priority to {new_priority}")
        return True

    def test_searcher_priority_update_blocked(self) -> bool:
        """Test Searcher cannot update brand priority (should be ignored)"""
        self.log("=== TESTING SEARCHER PRIORITY UPDATE (SHOULD BE BLOCKED) ===")
        
        # First, get a brand that belongs to the searcher
        success, response = self.run_test(
            "Get Searcher's Brands",
            "GET",
            "brands?limit=1",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        searcher_brands = response.get('brands', [])
        if not searcher_brands:
            # If searcher has no brands, claim some first
            self.log("Searcher has no brands, claiming some...")
            success, response = self.run_test(
                "Claim Brands for Searcher",
                "POST",
                "brands/claim",
                200,
                token=self.searcher_token
            )
            
            if not success:
                self.log("❌ Failed to claim brands for searcher")
                return False
            
            # Get brands again
            success, response = self.run_test(
                "Get Searcher's Brands After Claiming",
                "GET",
                "brands?limit=1",
                200,
                token=self.searcher_token
            )
            
            if not success or not response.get('brands'):
                self.log("❌ Still no brands for searcher after claiming")
                return False
            
            searcher_brands = response.get('brands', [])
        
        searcher_brand_id = searcher_brands[0]['id']
        original_priority = searcher_brands[0].get('priority_score', 0)
        
        self.log(f"✅ Using searcher's brand ID: {searcher_brand_id}")
        self.log(f"✅ Original priority score: {original_priority}")
        
        # Test updating priority to 99999 (should be ignored)
        new_priority = 99999
        success, response = self.run_test(
            "Searcher Priority Update (Should Be Ignored)",
            "PUT",
            f"brands/{searcher_brand_id}/info",
            200,  # Request should succeed but priority should be ignored
            data={"priority_score": new_priority},
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify the priority was NOT updated (should still be original value)
        success, response = self.run_test(
            "Verify Searcher Priority Update Was Ignored",
            "GET",
            f"brands/{searcher_brand_id}",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        current_priority = response.get('brand', {}).get('priority_score')
        if current_priority != original_priority:
            self.log(f"❌ Searcher priority update was NOT ignored! Original: {original_priority}, Current: {current_priority}")
            return False
        
        self.log(f"✅ Searcher priority update correctly ignored (priority remains {original_priority})")
        return True

    def test_priority_field_validation(self) -> bool:
        """Test priority field validation"""
        self.log("=== TESTING PRIORITY FIELD VALIDATION ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Test with invalid priority values
        test_cases = [
            {"priority_score": -1, "description": "negative priority"},
            {"priority_score": "invalid", "description": "string priority"},
            {"priority_score": None, "description": "null priority"},
        ]
        
        for test_case in test_cases:
            success, response = self.run_test(
                f"Invalid Priority Update ({test_case['description']})",
                "PUT",
                f"brands/{self.test_brand_id}/info",
                422,  # Should fail with validation error
                data={"priority_score": test_case["priority_score"]},
                token=self.super_admin_token
            )
            
            if not success:
                self.log(f"❌ Invalid priority ({test_case['description']}) was accepted")
                return False
        
        self.log("✅ Priority field validation working correctly")
        return True

    def test_other_fields_update(self) -> bool:
        """Test that other fields can still be updated normally"""
        self.log("=== TESTING OTHER FIELDS UPDATE ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Test updating other fields (should work for all roles)
        test_data = {
            "website_url": "https://test-updated-website.com",
            "website_found": True,
            "contacts_found": True
        }
        
        # Test with Super Admin
        success, response = self.run_test(
            "Super Admin Update Other Fields",
            "PUT",
            f"brands/{self.test_brand_id}/info",
            200,
            data=test_data,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        # Verify the fields were updated
        success, response = self.run_test(
            "Verify Other Fields Update",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        brand = response.get('brand', {})
        if brand.get('website_url') != test_data['website_url']:
            self.log(f"❌ Website URL not updated")
            return False
        
        if brand.get('website_found') != test_data['website_found']:
            self.log(f"❌ Website found not updated")
            return False
        
        self.log("✅ Other fields update working correctly")
        return True

    def run_all_tests(self) -> bool:
        """Run all priority update tests"""
        self.log("🚀 STARTING MANUAL PRIORITY UPDATE FEATURE TESTING")
        self.log("=" * 60)
        
        # Step 1: Authenticate users
        if not self.authenticate_users():
            self.log("❌ Authentication failed")
            return False
        
        # Step 2: Get test brand
        if not self.get_test_brand():
            self.log("❌ Failed to get test brand")
            return False
        
        # Step 3: Test Super Admin priority update
        if not self.test_super_admin_priority_update():
            self.log("❌ Super Admin priority update test failed")
            return False
        
        # Step 4: Test Admin priority update
        if not self.test_admin_priority_update():
            self.log("❌ Admin priority update test failed")
            return False
        
        # Step 5: Test Searcher priority update (should be blocked)
        if not self.test_searcher_priority_update_blocked():
            self.log("❌ Searcher priority update blocking test failed")
            return False
        
        # Step 6: Test priority field validation
        if not self.test_priority_field_validation():
            self.log("❌ Priority field validation test failed")
            return False
        
        # Step 7: Test other fields update
        if not self.test_other_fields_update():
            self.log("❌ Other fields update test failed")
            return False
        
        return True

    def print_summary(self):
        """Print test summary"""
        self.log("=" * 60)
        self.log("🏁 MANUAL PRIORITY UPDATE TESTING COMPLETE")
        self.log("=" * 60)
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                self.log(f"{i}. {failure.get('test', 'Unknown')}")
                if 'error' in failure:
                    self.log(f"   Error: {failure['error']}")
                else:
                    self.log(f"   Expected: {failure.get('expected')}, Got: {failure.get('actual')}")
                    self.log(f"   Response: {failure.get('response', '')[:100]}")
        else:
            self.log("\n✅ ALL TESTS PASSED!")

def main():
    """Main function to run priority update tests"""
    tester = PriorityUpdateTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        if success and len(tester.failed_tests) == 0:
            print("\n🎉 Manual Priority Update feature is working correctly!")
            sys.exit(0)
        else:
            print("\n⚠️  Some tests failed. Please check the results above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Testing interrupted by user")
        tester.print_summary()
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        tester.print_summary()
        sys.exit(1)

if __name__ == "__main__":
    main()