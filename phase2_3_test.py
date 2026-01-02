#!/usr/bin/env python3
"""
PROCTO 13 Phase 2 & 3 Features Testing
Tests: No Response status, Undo functionality, On Hold status, Analytics page with KPI
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class Phase23Tester:
    def __init__(self, base_url: str = "https://brandsync-2.preview.emergentagent.com"):
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

    def setup_test_environment(self) -> bool:
        """Setup admin and searcher users with test brands"""
        self.log("=== SETTING UP TEST ENVIRONMENT ===")
        
        # Admin login
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
        
        if not success or 'token' not in response:
            self.log("❌ Failed to get admin token")
            return False
        
        self.admin_token = response['token']
        
        # Create searcher user
        searcher_data = {
            "email": f"phase23_searcher_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "test123",
            "secret_code": "TEST123",
            "nickname": f"Phase23Searcher_{datetime.now().strftime('%H%M%S')}",
            "role": "searcher",
            "work_hours_start": "09:00",
            "work_hours_end": "18:00"
        }
        
        success, response = self.run_test(
            "Create Test Searcher",
            "POST",
            "users",
            200,
            data=searcher_data,
            token=self.admin_token
        )
        
        if not success or 'id' not in response:
            return False
        
        self.searcher_user_id = response['id']
        
        # Searcher login
        success, response = self.run_test(
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
        
        if not success or 'token' not in response:
            return False
        
        self.searcher_token = response['token']
        
        # Claim brands for testing
        success, response = self.run_test(
            "Claim Test Brands",
            "POST",
            "brands/claim",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Get a brand for testing
        success, response = self.run_test(
            "Get My Brands",
            "GET",
            "brands",
            200,
            token=self.searcher_token
        )
        
        if success and response.get('brands'):
            self.test_brand_id = response['brands'][0]['id']
            self.log(f"✅ Using test brand ID: {self.test_brand_id}")
            return True
        
        return False

    def test_no_response_status(self) -> bool:
        """Test NO_RESPONSE status functionality"""
        self.log("=== TESTING NO RESPONSE STATUS ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Test setting NO_RESPONSE status
        success, response = self.run_test(
            "Set No Response Status",
            "POST",
            f"brands/{self.test_brand_id}/no-response",
            200,
            data={
                "note_text": "Contacted via email and phone, no response after 3 attempts"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify brand status changed to NO_RESPONSE
        success, response = self.run_test(
            "Verify No Response Status",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.searcher_token
        )
        
        if success:
            brand_status = response.get('brand', {}).get('status')
            if brand_status == "NO_RESPONSE":
                self.log("✅ Brand status correctly set to NO_RESPONSE")
                return True
            else:
                self.log(f"❌ Expected NO_RESPONSE status, got {brand_status}")
                return False
        
        return False

    def test_undo_functionality(self) -> bool:
        """Test Undo functionality"""
        self.log("=== TESTING UNDO FUNCTIONALITY ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # First, perform an action that can be undone (complete a stage)
        success, response = self.run_test(
            "Complete Stage for Undo Test",
            "POST",
            f"brands/{self.test_brand_id}/stage",
            200,
            data={
                "stage": "EMAIL_1_DONE",
                "note_text": "First email sent - testing undo functionality",
                "channel": "email"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Check if undo is available
        success, response = self.run_test(
            "Check Undo Availability",
            "GET",
            f"brands/{self.test_brand_id}/last-action",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        can_undo = response.get('can_undo', False)
        if not can_undo:
            self.log(f"❌ Undo not available: {response.get('reason', 'Unknown reason')}")
            return False
        
        self.log(f"✅ Undo available, {response.get('minutes_remaining', 0)} minutes remaining")
        
        # Perform undo
        success, response = self.run_test(
            "Perform Undo Action",
            "POST",
            f"brands/{self.test_brand_id}/undo",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify undo worked by checking brand stage
        success, response = self.run_test(
            "Verify Undo Result",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.searcher_token
        )
        
        if success:
            pipeline_stage = response.get('brand', {}).get('pipeline_stage')
            if pipeline_stage == "REVIEW":
                self.log("✅ Undo successful - stage reverted to REVIEW")
                return True
            else:
                self.log(f"❌ Undo failed - stage is still {pipeline_stage}")
                return False
        
        return False

    def test_on_hold_status(self) -> bool:
        """Test ON_HOLD status functionality"""
        self.log("=== TESTING ON HOLD STATUS ===")
        
        if not self.test_brand_id:
            self.log("❌ No test brand available")
            return False
        
        # Set brand to ON_HOLD
        review_date = "2024-12-31"  # Future date
        success, response = self.run_test(
            "Set On Hold Status",
            "POST",
            f"brands/{self.test_brand_id}/on-hold",
            200,
            data={
                "reason": "Website under maintenance",
                "review_date": review_date,
                "note_text": "Brand website is down for maintenance, will review after they fix it"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify brand status and details
        success, response = self.run_test(
            "Verify On Hold Status",
            "GET",
            f"brands/{self.test_brand_id}",
            200,
            token=self.searcher_token
        )
        
        if success:
            brand = response.get('brand', {})
            status = brand.get('status')
            hold_reason = brand.get('on_hold_reason')
            hold_review_date = brand.get('on_hold_review_date')
            
            if status == "ON_HOLD" and hold_reason and hold_review_date == review_date:
                self.log("✅ On Hold status correctly set with reason and review date")
                return True
            else:
                self.log(f"❌ On Hold verification failed - Status: {status}, Reason: {hold_reason}, Date: {hold_review_date}")
                return False
        
        return False

    def test_analytics_kpi(self) -> bool:
        """Test Analytics page KPI functionality"""
        self.log("=== TESTING ANALYTICS KPI ===")
        
        # Test KPI endpoint
        success, response = self.run_test(
            "Get KPI Analytics",
            "GET",
            "analytics/kpi?period_days=7",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify KPI structure
        kpi_data = response.get('kpi', [])
        if not kpi_data:
            self.log("❌ No KPI data returned")
            return False
        
        # Check first KPI entry structure
        first_kpi = kpi_data[0]
        required_fields = ['user_id', 'nickname', 'metrics', 'weighted_score', 'quality_ratio']
        
        for field in required_fields:
            if field not in first_kpi:
                self.log(f"❌ Missing KPI field: {field}")
                return False
        
        # Check metrics structure
        metrics = first_kpi.get('metrics', {})
        required_metrics = ['stages_completed', 'outcomes_set', 'returns', 'quick_returns']
        
        for metric in required_metrics:
            if metric not in metrics:
                self.log(f"❌ Missing metric: {metric}")
                return False
        
        self.log(f"✅ KPI data structure valid - {len(kpi_data)} users found")
        return True

    def test_analytics_timeouts(self) -> bool:
        """Test Analytics timeout checking"""
        self.log("=== TESTING ANALYTICS TIMEOUTS ===")
        
        # Test review timeout endpoint
        success, response = self.run_test(
            "Get Review Timeout Analytics",
            "GET",
            "analytics/review-timeout",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify timeout structure
        required_fields = ['count', 'threshold_days', 'brands']
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing timeout field: {field}")
                return False
        
        self.log(f"✅ Review timeout data valid - {response['count']} brands found")
        
        # Test inactive brands endpoint
        success, response = self.run_test(
            "Get Inactive Brands Analytics",
            "GET",
            "analytics/inactive-brands",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify inactive structure
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing inactive field: {field}")
                return False
        
        self.log(f"✅ Inactive brands data valid - {response['count']} brands found")
        return True

    def test_analytics_shared_contacts(self) -> bool:
        """Test Analytics shared contacts detection"""
        self.log("=== TESTING ANALYTICS SHARED CONTACTS ===")
        
        success, response = self.run_test(
            "Get Shared Contacts Analytics",
            "GET",
            "analytics/shared-contacts",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify shared contacts structure
        required_fields = ['total_found', 'shared_contacts']
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing shared contacts field: {field}")
                return False
        
        self.log(f"✅ Shared contacts data valid - {response['total_found']} duplicates found")
        return True

    def test_system_timeout_check(self) -> bool:
        """Test system timeout checking functionality"""
        self.log("=== TESTING SYSTEM TIMEOUT CHECK ===")
        
        success, response = self.run_test(
            "Run System Timeout Check",
            "POST",
            "system/check-timeouts",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify response structure
        if 'alerts_created' not in response:
            self.log("❌ Missing alerts_created field")
            return False
        
        alerts_created = response['alerts_created']
        self.log(f"✅ Timeout check completed - {alerts_created} alerts created")
        return True

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all Phase 2 & 3 tests"""
        self.log("🚀 Starting PROCTO 13 Phase 2 & 3 Testing Suite")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "tests": {}
        }
        
        # Setup environment first
        if not self.setup_test_environment():
            self.log("❌ Failed to setup test environment")
            return test_results
        
        # Run Phase 2 & 3 tests
        tests = [
            ("no_response_status", self.test_no_response_status),
            ("undo_functionality", self.test_undo_functionality),
            ("on_hold_status", self.test_on_hold_status),
            ("analytics_kpi", self.test_analytics_kpi),
            ("analytics_timeouts", self.test_analytics_timeouts),
            ("analytics_shared_contacts", self.test_analytics_shared_contacts),
            ("system_timeout_check", self.test_system_timeout_check)
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                test_results["tests"][test_name] = {
                    "passed": result,
                    "timestamp": datetime.now().isoformat()
                }
                if not result:
                    self.log(f"❌ Test failed: {test_name}")
            except Exception as e:
                self.log(f"💥 Test {test_name} crashed: {str(e)}")
                test_results["tests"][test_name] = {
                    "passed": False,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
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
    tester = Phase23Tester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/test_reports/phase2_3_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Return appropriate exit code
    return 0 if results["summary"]["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())