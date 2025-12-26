#!/usr/bin/env python3
"""
PROCTO 13 - Comprehensive Chat and Notification System Testing
Tests all chat and notification endpoints with specific scenarios from review request
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class ChatNotificationTester:
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
        self.test_message_ids = []
        self.test_notification_ids = []

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
            self.admin_user_id = response['user']['id']
            self.log(f"✅ Admin authenticated: {self.admin_user_id}")
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
            self.searcher_user_id = response['user']['id']
            self.log(f"✅ Searcher authenticated: {self.searcher_user_id}")
        else:
            self.log("❌ Failed to authenticate Searcher")
            return False
        
        return True

    def test_chat_message_crud(self) -> bool:
        """Test Chat Message CRUD operations"""
        self.log("=== TESTING CHAT MESSAGE CRUD ===")
        
        # Get general chat first
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
        if not self.general_chat_id:
            self.log("❌ Could not get general chat ID")
            return False
        
        self.log(f"✅ Using general chat ID: {self.general_chat_id}")
        
        # Test 1: POST /api/chats/{chat_id}/messages - Send message as Admin
        success, response = self.run_test(
            "Send Message as Admin",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Test message from Admin for comprehensive testing 🚀",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_message_id = response.get('id')
        if not admin_message_id:
            self.log("❌ Could not get message ID from admin message")
            return False
        
        self.test_message_ids.append(admin_message_id)
        self.log(f"✅ Admin message sent with ID: {admin_message_id}")
        
        # Test 2: Send message as Searcher
        success, response = self.run_test(
            "Send Message as Searcher",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Test message from Searcher for deletion testing 📝",
                "message_type": "text"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        searcher_message_id = response.get('id')
        if not searcher_message_id:
            self.log("❌ Could not get message ID from searcher message")
            return False
        
        self.test_message_ids.append(searcher_message_id)
        self.log(f"✅ Searcher message sent with ID: {searcher_message_id}")
        
        # Test 3: GET /api/chats/{chat_id}/messages - Get messages with limit
        success, response = self.run_test(
            "Get Chat Messages with Limit",
            "GET",
            f"chats/{self.general_chat_id}/messages?limit=10",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        if len(messages) == 0:
            self.log("❌ No messages found in chat")
            return False
        
        self.log(f"✅ Retrieved {len(messages)} messages from chat")
        
        # Verify our test messages are in the list
        found_admin_msg = False
        found_searcher_msg = False
        for msg in messages:
            if msg.get('id') == admin_message_id:
                found_admin_msg = True
            if msg.get('id') == searcher_message_id:
                found_searcher_msg = True
        
        if not found_admin_msg:
            self.log("❌ Admin message not found in chat messages")
            return False
        
        if not found_searcher_msg:
            self.log("❌ Searcher message not found in chat messages")
            return False
        
        self.log("✅ Both test messages found in chat")
        
        return True

    def test_message_deletion_rules(self) -> bool:
        """Test message deletion rules as specified in review request"""
        self.log("=== TESTING MESSAGE DELETION RULES ===")
        
        if not self.test_message_ids or len(self.test_message_ids) < 2:
            self.log("❌ Need at least 2 test messages for deletion testing")
            return False
        
        admin_message_id = self.test_message_ids[0]
        searcher_message_id = self.test_message_ids[1]
        
        # Test 1: Admin deletes their OWN message (should succeed)
        success, response = self.run_test(
            "Admin Deletes Own Message (Should Succeed)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{admin_message_id}",
            200,
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Admin could not delete their own message")
            return False
        
        self.log("✅ Admin successfully deleted their own message")
        
        # Test 2: Admin tries to delete Searcher's message (should FAIL)
        success, response = self.run_test(
            "Admin Tries to Delete Searcher's Message (Should Fail)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{searcher_message_id}",
            403,  # Should be forbidden
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Admin was allowed to delete searcher's message (security issue)")
            return False
        
        self.log("✅ Admin correctly forbidden from deleting searcher's message")
        
        # Test 3: Super Admin deletes ANY message (should succeed)
        success, response = self.run_test(
            "Super Admin Deletes Any Message (Should Succeed)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{searcher_message_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Super Admin could not delete searcher's message")
            return False
        
        self.log("✅ Super Admin successfully deleted searcher's message")
        
        # Test 4: Verify messages are actually deleted
        success, response = self.run_test(
            "Verify Messages Deleted",
            "GET",
            f"chats/{self.general_chat_id}/messages",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        for msg in messages:
            if msg.get('id') in [admin_message_id, searcher_message_id]:
                self.log(f"❌ Deleted message still found: {msg.get('id')}")
                return False
        
        self.log("✅ Deleted messages no longer appear in chat")
        
        return True

    def test_message_reactions(self) -> bool:
        """Test message reactions functionality"""
        self.log("=== TESTING MESSAGE REACTIONS ===")
        
        # Send a new message for reaction testing
        success, response = self.run_test(
            "Send Message for Reaction Testing",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Test message for reactions! 👍❤️🎉",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        reaction_message_id = response.get('id')
        if not reaction_message_id:
            self.log("❌ Could not get message ID for reaction testing")
            return False
        
        self.log(f"✅ Message for reactions sent: {reaction_message_id}")
        
        # Test 1: POST /api/chats/{chat_id}/messages/{message_id}/reactions - Add reaction
        success, response = self.run_test(
            "Add Thumbs Up Reaction",
            "POST",
            f"chats/{self.general_chat_id}/messages/{reaction_message_id}/reactions",
            200,
            data={"emoji": "👍"},
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        self.log("✅ Thumbs up reaction added successfully")
        
        # Test 2: Add different reaction from different user
        success, response = self.run_test(
            "Add Heart Reaction from Different User",
            "POST",
            f"chats/{self.general_chat_id}/messages/{reaction_message_id}/reactions",
            200,
            data={"emoji": "❤️"},
            token=self.admin_token
        )
        
        if not success:
            return False
        
        self.log("✅ Heart reaction added successfully")
        
        # Test 3: Remove reaction (toggle behavior)
        success, response = self.run_test(
            "Remove Thumbs Up Reaction (Toggle)",
            "POST",
            f"chats/{self.general_chat_id}/messages/{reaction_message_id}/reactions",
            200,
            data={"emoji": "👍"},
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        self.log("✅ Thumbs up reaction removed successfully (toggle behavior)")
        
        # Test 4: Verify reactions in message
        success, response = self.run_test(
            "Verify Reactions in Message",
            "GET",
            f"chats/{self.general_chat_id}/messages",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        reaction_message = None
        for msg in messages:
            if msg.get('id') == reaction_message_id:
                reaction_message = msg
                break
        
        if not reaction_message:
            self.log("❌ Could not find reaction message")
            return False
        
        reactions = reaction_message.get('reactions', [])
        self.log(f"✅ Message has {len(reactions)} reactions")
        
        # Should have only heart reaction (thumbs up was removed)
        heart_found = False
        thumbs_found = False
        for reaction in reactions:
            if reaction.get('emoji') == '❤️':
                heart_found = True
            if reaction.get('emoji') == '👍':
                thumbs_found = True
        
        if not heart_found:
            self.log("❌ Heart reaction not found")
            return False
        
        if thumbs_found:
            self.log("❌ Thumbs up reaction should have been removed")
            return False
        
        self.log("✅ Reaction toggle behavior working correctly")
        
        return True

    def test_unread_count(self) -> bool:
        """Test unread message count functionality"""
        self.log("=== TESTING UNREAD COUNT ===")
        
        # Test: GET /api/chats/unread-count
        success, response = self.run_test(
            "Get Unread Count for Admin",
            "GET",
            "chats/unread-count",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        if 'unread_count' not in response:
            self.log("❌ Unread count not found in response")
            return False
        
        unread_count = response.get('unread_count', 0)
        self.log(f"✅ Admin has {unread_count} unread messages")
        
        # Test for other users
        success, response = self.run_test(
            "Get Unread Count for Searcher",
            "GET",
            "chats/unread-count",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        searcher_unread = response.get('unread_count', 0)
        self.log(f"✅ Searcher has {searcher_unread} unread messages")
        
        return True

    def test_chat_participants_update(self) -> bool:
        """Test chat participants update functionality"""
        self.log("=== TESTING CHAT PARTICIPANTS UPDATE ===")
        
        # Test: PUT /api/chats/{chat_id}/participants
        success, response = self.run_test(
            "Update Chat Participants",
            "PUT",
            f"chats/{self.general_chat_id}/participants",
            200,
            data={
                "participant_ids": [self.admin_user_id, self.searcher_user_id, self.super_admin_user_id]
            },
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        self.log("✅ Chat participants updated successfully")
        
        return True

    def test_notification_endpoints(self) -> bool:
        """Test notification endpoints"""
        self.log("=== TESTING NOTIFICATION ENDPOINTS ===")
        
        # Test 1: GET /api/notifications - List notifications (should NOT include chat messages)
        success, response = self.run_test(
            "Get Admin Notifications",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        notifications = response.get('notifications', [])
        self.log(f"✅ Admin has {len(notifications)} notifications")
        
        # Verify no chat message notifications
        chat_notifications = [n for n in notifications if n.get('type') == 'chat_message']
        if chat_notifications:
            self.log(f"❌ Found {len(chat_notifications)} chat message notifications (should be 0)")
            return False
        
        self.log("✅ No chat message notifications found (correct behavior)")
        
        # Test 2: Create a brand assignment notification
        # First get a brand to assign
        success, response = self.run_test(
            "Get Brands for Assignment Test",
            "GET",
            "brands?limit=1",
            200,
            token=self.super_admin_token
        )
        
        if success and response.get('brands'):
            brand_id = response['brands'][0]['id']
            
            # Assign brand to admin to create notification
            success, response = self.run_test(
                "Assign Brand to Create Notification",
                "POST",
                f"brands/{brand_id}/assign",
                200,
                data={
                    "user_id": self.admin_user_id,
                    "reason": "Testing notification creation"
                },
                token=self.super_admin_token
            )
            
            if success:
                self.log("✅ Brand assigned to create notification")
            else:
                self.log("⚠️ Could not assign brand for notification test")
        
        # Test 3: Check if notification was created
        success, response = self.run_test(
            "Check for Brand Assignment Notification",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        notifications = response.get('notifications', [])
        brand_notifications = [n for n in notifications if n.get('type') == 'brand_assigned']
        
        if brand_notifications:
            notification_id = brand_notifications[0]['id']
            self.test_notification_ids.append(notification_id)
            self.log(f"✅ Brand assignment notification created: {notification_id}")
            
            # Test 4: POST /api/notifications/{id}/read - Mark as read
            success, response = self.run_test(
                "Mark Notification as Read",
                "POST",
                f"notifications/{notification_id}/read",
                200,
                token=self.admin_token
            )
            
            if not success:
                return False
            
            self.log("✅ Notification marked as read successfully")
            
            # Verify it's marked as read
            success, response = self.run_test(
                "Verify Notification Marked as Read",
                "GET",
                "notifications",
                200,
                token=self.admin_token
            )
            
            if success:
                notifications = response.get('notifications', [])
                for notif in notifications:
                    if notif['id'] == notification_id:
                        if notif.get('is_read'):
                            self.log("✅ Notification correctly marked as read")
                        else:
                            self.log("❌ Notification not marked as read")
                            return False
                        break
        else:
            self.log("⚠️ No brand assignment notification found")
        
        return True

    def test_notification_creation_scenarios(self) -> bool:
        """Test specific notification creation scenarios"""
        self.log("=== TESTING NOTIFICATION CREATION SCENARIOS ===")
        
        # Test 1: Verify NO notification is created when sending chat messages
        initial_count = 0
        success, response = self.run_test(
            "Get Initial Notification Count",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if success:
            initial_count = len(response.get('notifications', []))
        
        # Send a chat message
        success, response = self.run_test(
            "Send Chat Message (Should Not Create Notification)",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "This message should NOT create a notification",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Check notification count hasn't increased
        success, response = self.run_test(
            "Check Notification Count After Chat Message",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if success:
            final_count = len(response.get('notifications', []))
            if final_count > initial_count:
                self.log("❌ Chat message created notification (should not)")
                return False
            else:
                self.log("✅ Chat message did not create notification (correct)")
        
        # Test 2: Task completion notification (if task system exists)
        success, response = self.run_test(
            "Create Task for Completion Test",
            "POST",
            "tasks",
            200,
            data={
                "title": "Test Task for Notification",
                "description": "Testing task completion notification",
                "assigned_to_id": self.admin_user_id,
                "priority": "medium"
            },
            token=self.super_admin_token
        )
        
        if success:
            task_id = response.get('id')
            if task_id:
                # Complete the task
                success, response = self.run_test(
                    "Complete Task to Create Notification",
                    "PUT",
                    f"tasks/{task_id}",
                    200,
                    data={
                        "status": "completed",
                        "completion_notes": "Task completed for notification testing"
                    },
                    token=self.admin_token
                )
                
                if success:
                    self.log("✅ Task completed successfully")
                else:
                    self.log("⚠️ Could not complete task for notification test")
            else:
                self.log("⚠️ Could not get task ID")
        else:
            self.log("⚠️ Could not create task for notification test")
        
        return True

    def test_comprehensive_scenarios(self) -> bool:
        """Test the comprehensive scenarios from review request"""
        self.log("=== TESTING COMPREHENSIVE SCENARIOS ===")
        
        # Scenario 1: Send message as Admin, verify it's stored
        success, response = self.run_test(
            "Scenario 1: Send Message as Admin",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Scenario 1: Admin message for comprehensive testing",
                "message_type": "text"
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        scenario1_message_id = response.get('id')
        self.log(f"✅ Scenario 1: Admin message sent and stored: {scenario1_message_id}")
        
        # Scenario 2: Delete that message as Admin (should succeed - own message)
        success, response = self.run_test(
            "Scenario 2: Admin Deletes Own Message",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{scenario1_message_id}",
            200,
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Scenario 2 failed: Admin could not delete own message")
            return False
        
        self.log("✅ Scenario 2: Admin successfully deleted own message")
        
        # Scenario 3: Send message as Searcher, try delete as Admin (should FAIL)
        success, response = self.run_test(
            "Scenario 3a: Send Message as Searcher",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Scenario 3: Searcher message for deletion test",
                "message_type": "text"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        scenario3_message_id = response.get('id')
        self.log(f"✅ Scenario 3a: Searcher message sent: {scenario3_message_id}")
        
        success, response = self.run_test(
            "Scenario 3b: Admin Tries to Delete Searcher Message (Should Fail)",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{scenario3_message_id}",
            403,
            token=self.admin_token
        )
        
        if not success:
            self.log("❌ Scenario 3 failed: Admin was allowed to delete searcher's message")
            return False
        
        self.log("✅ Scenario 3: Admin correctly forbidden from deleting searcher's message")
        
        # Scenario 4: Send message as Searcher, delete as Super_admin (should succeed)
        success, response = self.run_test(
            "Scenario 4: Super Admin Deletes Searcher Message",
            "DELETE",
            f"chats/{self.general_chat_id}/messages/{scenario3_message_id}",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            self.log("❌ Scenario 4 failed: Super Admin could not delete searcher's message")
            return False
        
        self.log("✅ Scenario 4: Super Admin successfully deleted searcher's message")
        
        # Scenario 5: Check unread-count returns correct number
        success, response = self.run_test(
            "Scenario 5: Check Unread Count",
            "GET",
            "chats/unread-count",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        unread_count = response.get('unread_count', 0)
        self.log(f"✅ Scenario 5: Unread count returned: {unread_count}")
        
        # Scenario 6: Verify NO notification is created when sending chat messages
        initial_notif_count = 0
        success, response = self.run_test(
            "Scenario 6a: Get Initial Notification Count",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if success:
            initial_notif_count = len(response.get('notifications', []))
        
        success, response = self.run_test(
            "Scenario 6b: Send Chat Message",
            "POST",
            f"chats/{self.general_chat_id}/messages",
            200,
            data={
                "text": "Scenario 6: This should not create notification",
                "message_type": "text"
            },
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        success, response = self.run_test(
            "Scenario 6c: Verify No Notification Created",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if success:
            final_notif_count = len(response.get('notifications', []))
            if final_notif_count > initial_notif_count:
                self.log("❌ Scenario 6 failed: Chat message created notification")
                return False
            else:
                self.log("✅ Scenario 6: No notification created for chat message")
        
        # Scenario 7: Create a brand assignment notification and verify it appears
        success, response = self.run_test(
            "Scenario 7: Get Brands for Assignment",
            "GET",
            "brands?limit=1",
            200,
            token=self.super_admin_token
        )
        
        if success and response.get('brands'):
            brand_id = response['brands'][0]['id']
            
            success, response = self.run_test(
                "Scenario 7: Create Brand Assignment Notification",
                "POST",
                f"brands/{brand_id}/assign",
                200,
                data={
                    "user_id": self.searcher_user_id,
                    "reason": "Scenario 7: Testing notification creation"
                },
                token=self.super_admin_token
            )
            
            if success:
                # Check if notification appears
                success, response = self.run_test(
                    "Scenario 7: Verify Brand Assignment Notification",
                    "GET",
                    "notifications",
                    200,
                    token=self.searcher_token
                )
                
                if success:
                    notifications = response.get('notifications', [])
                    brand_notifs = [n for n in notifications if n.get('type') == 'brand_assigned']
                    if brand_notifs:
                        self.log("✅ Scenario 7: Brand assignment notification created and appears")
                    else:
                        self.log("⚠️ Scenario 7: Brand assignment notification not found")
                else:
                    self.log("❌ Scenario 7: Could not check notifications")
                    return False
            else:
                self.log("⚠️ Scenario 7: Could not assign brand")
        else:
            self.log("⚠️ Scenario 7: No brands available for assignment test")
        
        return True

    def run_all_tests(self) -> bool:
        """Run all chat and notification tests"""
        self.log("🚀 STARTING COMPREHENSIVE CHAT AND NOTIFICATION TESTING")
        
        # Authenticate users
        if not self.authenticate_users():
            return False
        
        # Run all test suites
        test_suites = [
            ("Chat Message CRUD", self.test_chat_message_crud),
            ("Message Deletion Rules", self.test_message_deletion_rules),
            ("Message Reactions", self.test_message_reactions),
            ("Unread Count", self.test_unread_count),
            ("Chat Participants Update", self.test_chat_participants_update),
            ("Notification Endpoints", self.test_notification_endpoints),
            ("Notification Creation Scenarios", self.test_notification_creation_scenarios),
            ("Comprehensive Scenarios", self.test_comprehensive_scenarios),
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
    tester = ChatNotificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)