#!/usr/bin/env python3
"""
PROCTO 13 - Focused Chat and Notification Testing
Tests the specific scenarios from the review request
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class FocusedChatNotificationTester:
    def __init__(self, base_url: str = "https://notifybrands.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.admin_token = None
        self.searcher_token = None
        self.super_admin_user_id = None
        self.admin_user_id = None
        self.searcher_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test data storage
        self.general_chat_id = None

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

    def authenticate_users(self) -> bool:
        """Authenticate all test users"""
        self.log("=== AUTHENTICATING TEST USERS ===")
        
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
            self.super_admin_user_id = response['user']['id']
            self.log(f"✅ Super Admin authenticated: {self.super_admin_user_id}")
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
            self.log(f"✅ Admin authenticated: {self.admin_user_id}")
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
            self.log(f"✅ Searcher authenticated: {self.searcher_user_id}")
        else:
            return False
        
        return True

    def test_review_request_scenarios(self) -> bool:
        """Test the exact scenarios from the review request"""
        self.log("=== TESTING REVIEW REQUEST SCENARIOS ===")
        
        # Get general chat
        success, response = self.run_test(
            "Get General Chat",
            "GET",
            "chats/general",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        self.general_chat_id = response.get('id')
        self.log(f"✅ Using general chat ID: {self.general_chat_id}")
        
        # Scenario 1: Send message as Admin, verify it's stored
        success, response = self.run_test(
            "1. Send Message as Admin",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Admin message for comprehensive testing",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_message_id = response.get('id')
        self.log(f"✅ Admin message sent and stored: {admin_message_id}")
        
        # Scenario 2: Delete that message as Admin (should succeed - own message)
        success, response = self.run_test(
            "2. Admin Deletes Own Message (Should Succeed)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{admin_message_id}",
            200,
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Scenario 2 failed: Admin could not delete own message")
            return False
        
        self.log("✅ Admin successfully deleted own message")
        
        # Scenario 3: Send message as Searcher, try delete as Admin (should FAIL)
        success, response = self.run_test(
            "3a. Send Message as Searcher",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Searcher message for deletion test",
                "message_type": "text"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        searcher_message_id = response.get('id')
        self.log(f"✅ Searcher message sent: {searcher_message_id}")
        
        success, response = self.run_test(
            "3b. Admin Tries to Delete Searcher Message (Should Fail)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{searcher_message_id}",
            403,
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Scenario 3 failed: Admin was allowed to delete searcher's message")
            return False
        
        self.log("✅ Admin correctly forbidden from deleting searcher's message")
        
        # Scenario 4: Send message as Searcher, delete as Super_admin (should succeed)
        success, response = self.run_test(
            "4. Super Admin Deletes Searcher Message (Should Succeed)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{searcher_message_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Scenario 4 failed: Super Admin could not delete searcher's message")
            return False
        
        self.log("✅ Super Admin successfully deleted searcher's message")
        
        # Scenario 5: Check unread-count returns correct number
        success, response = self.run_test(
            "5. Check Unread Count",
            "GET",
            "chats/unread-count",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        unread_count = response.get('unread_count', 0)
        self.log(f"✅ Unread count returned: {unread_count}")
        
        return True

    def test_chat_endpoints(self) -> bool:
        """Test all chat endpoints from review request"""
        self.log("=== TESTING CHAT ENDPOINTS ===")
        
        # Test message reactions
        success, response = self.run_test(
            "Send Message for Reactions",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Test message for reactions! 👍❤️",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        message_id = response.get('id')
        
        # Add reaction
        success, response = self.run_test(
            "Add Reaction",
            "POST",
            f"chats/{self.general_chat_id}/messages/{message_id}/reactions",
            200,
            data={"emoji": "👍"},
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        self.log("✅ Reaction added successfully")
        
        # Test GET messages with limit
        success, response = self.run_test(
            "Get Messages with Limit",
            "GET",
            f"chats/{self.general_chat_id}/messages?limit=5",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        self.log(f"✅ Retrieved {len(messages)} messages with limit")
        
        return True

    def test_notification_endpoints(self) -> bool:
        """Test notification endpoints"""
        self.log("=== TESTING NOTIFICATION ENDPOINTS ===")
        
        # Test 1: GET /api/notifications (should NOT include chat messages)
        success, response = self.run_test(
            "Get Notifications (No Chat Messages)",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        notifications = response.get('notifications', [])
        chat_notifications = [n for n in notifications if n.get('type') == 'chat_message']
        
        if chat_notifications:
            self.log(f"❌ Found {len(chat_notifications)} chat message notifications (should be 0)")
            return False
        
        self.log("✅ No chat message notifications found (correct)")
        
        # Test 2: Mark notification as read (if any exist)
        if notifications:
            notification_id = notifications[0]['id']
            success, response = self.run_test(
                "Mark Notification as Read",
                "POST",
                f"notifications/{notification_id}/read",
                200,
                token=self.admin_token
            )
            
            if success:
                self.log("✅ Notification marked as read")
            else:
                self.log("⚠️ Could not mark notification as read")
        
        # Test 3: Verify NO notification created when sending chat messages
        initial_count = len(notifications)
        
        success, response = self.run_test(
            "Send Chat Message (Should Not Create Notification)",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "This should NOT create a notification",
                "message_type": "text"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Check notification count hasn't increased
        success, response = self.run_test(
            "Verify No Notification Created",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if success:
            final_count = len(response.get('notifications', []))
            if final_count > initial_count:
                self.log("❌ Chat message created notification (should not)")
                return False
            else:
                self.log("✅ Chat message did not create notification (correct)")
        
        return True

    def run_all_tests(self) -> bool:
        """Run all focused tests"""
        self.log("🚀 STARTING FOCUSED CHAT AND NOTIFICATION TESTING")
        
        # Authenticate users
        if not self.authenticate_users():
            return False
        
        # Run test suites
        test_suites = [
            ("Review Request Scenarios", self.test_review_request_scenarios),
            ("Chat Endpoints", self.test_chat_endpoints),
            ("Notification Endpoints", self.test_notification_endpoints),
        ]
        
        failed_suites = []
        
        for suite_name, test_func in test_suites:
            self.log(f"\n{'='*50}")
            self.log(f"RUNNING: {suite_name}")
            self.log(f"{'='*50}")
            
            try:
                if not test_func():
                    failed_suites.append(suite_name)
                    self.log(f"❌ {suite_name} FAILED")
                else:
                    self.log(f"✅ {suite_name} PASSED")
            except Exception as e:
                failed_suites.append(suite_name)
                self.log(f"❌ {suite_name} ERROR: {str(e)}")
        
        # Print final results
        self.log(f"\n{'='*60}")
        self.log("FINAL RESULTS")
        self.log(f"{'='*60}")
        self.log(f"Total Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {self.tests_run - self.tests_passed}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if failed_suites:
            self.log(f"\n❌ FAILED TEST SUITES:")
            for suite in failed_suites:
                self.log(f"  - {suite}")
        
        if self.failed_tests:
            self.log(f"\n❌ DETAILED FAILURES:")
            for failure in self.failed_tests:
                self.log(f"  - {failure}")
        
        return len(failed_suites) == 0

if __name__ == "__main__":
    tester = FocusedChatNotificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)