#!/usr/bin/env python3
"""
PROCTO 13 Notification System Testing
Tests only the notification endpoints and scenarios
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class NotificationTester:
    def __init__(self, base_url: str = "https://notifybrands.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.searcher_token = None
        self.searcher_user_id = None
        self.admin_user_id = None
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

    def setup_auth(self) -> bool:
        """Setup authentication tokens"""
        self.log("=== SETTING UP AUTHENTICATION ===")
        
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
            self.log(f"✅ Super Admin token obtained")
        else:
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
            self.admin_user_id = response['user']['id']
            self.log(f"✅ Admin token obtained, ID: {self.admin_user_id}")
        else:
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
            self.searcher_user_id = response['user']['id']
            self.log(f"✅ Searcher token obtained, ID: {self.searcher_user_id}")
        else:
            return False
        
        return True

    def test_notifications_system(self) -> bool:
        """Test the Notification System endpoints and scenarios"""
        self.log("=== TESTING NOTIFICATIONS SYSTEM ===")
        
        # Test 1: Get initial notifications for each user
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
        
        # Test 4: Find or create a brand assigned to searcher for testing
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

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all notification tests"""
        self.log("🚀 Starting PROCTO 13 Notification System Testing")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        # Setup authentication
        if not self.setup_auth():
            self.log("❌ Failed to setup authentication")
            return {"error": "Authentication failed"}
        
        # Run notification tests
        result = self.test_notifications_system()
        
        # Final results
        self.log("=" * 50)
        self.log(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            self.log("❌ FAILED TESTS:")
            for failure in self.failed_tests:
                self.log(f"   - {failure}")
        
        return {
            "success": result,
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": len(self.failed_tests),
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "failed_details": self.failed_tests
        }

def main():
    """Main test execution"""
    tester = NotificationTester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results.get("success", False) else 1

if __name__ == "__main__":
    sys.exit(main())