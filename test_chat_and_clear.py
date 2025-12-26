#!/usr/bin/env python3
"""
PROCTO 13 Chat and Clear Brand Testing
Focused testing for new chat functionality and clear brand endpoint
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class ChatAndClearTester:
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
            self.log("❌ Failed to get super admin token")
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
            self.log(f"✅ Admin token obtained")
        else:
            self.log("❌ Failed to get admin token")
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
            self.log(f"✅ Searcher token obtained")
            return True
        else:
            self.log("❌ Failed to get searcher token")
            return False

    def test_chat_system(self) -> bool:
        """Test the new Chat System functionality"""
        self.log("=== TESTING CHAT SYSTEM ===")
        
        # Store chat IDs for testing
        general_chat_id = None
        direct_chat_id = None
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
        
        # Test 4: POST /api/chats - Create direct chat
        other_user = available_users[0]  # First available user
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
            
            if success:
                self.log(f"✅ Created group chat ID: {response.get('id')}")
        
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
        
        # Test 7: POST /api/chats/{chat_id}/messages - Send message
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
        
        # Test 8: GET /api/chats/{chat_id}/messages - Get messages
        success, response = self.run_test(
            "Get General Chat Messages",
            "GET",
            f"chats/{general_chat_id}/messages?limit=10",
            200,
            token=self.super_admin_token
        )
        
        if not success:
            return False
        
        messages = response.get('messages', [])
        self.log(f"✅ Retrieved {len(messages)} messages")
        
        # Test 9: POST /api/chats/{chat_id}/messages/{message_id}/reactions - Add reaction
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
        
        self.log("✅ Successfully added reaction to message")
        
        # Test 10: POST /api/chat/upload-image - Upload image
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
        
        # Test 11: Send message with image
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
        
        self.log("✅ Successfully sent message with image")
        
        # Test 12: Test general chat access for all roles
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
        
        return True

    def test_clear_brand_endpoint(self) -> bool:
        """Test the Clear Brand endpoint functionality"""
        self.log("=== TESTING CLEAR BRAND ENDPOINT ===")
        
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
        
        # Add a note to the brand first
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
        
        # Test 1: POST /api/brands/{brand_id}/clear - Clear brand
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
        
        self.log(f"✅ Brand cleared successfully - Notes: {response.get('deleted_notes', 0)}, Contacts: {response.get('deleted_contacts', 0)}")
        
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
        
        self.log("✅ Brand successfully reset to initial state")
        
        # Test 3: Test access control - searcher cannot clear other's brand
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
        
        # Test 4: Test clearing non-existent brand
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
        self.log("🚀 Starting PROCTO 13 Chat and Clear Brand Testing")
        self.log(f"🎯 Target URL: {self.base_url}")
        
        # Setup authentication
        if not self.setup_auth():
            self.log("❌ Authentication setup failed")
            return {"success": False, "error": "Authentication failed"}
        
        # Run tests
        tests = [
            ("chat_system", self.test_chat_system),
            ("clear_brand_endpoint", self.test_clear_brand_endpoint)
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n🔄 Running {test_name}...")
            try:
                success = test_func()
                if not success:
                    self.log(f"❌ Test suite stopped at: {test_name}")
                    break
            except Exception as e:
                self.log(f"❌ Test {test_name} failed with exception: {str(e)}")
                break
        
        # Final results
        self.log("=" * 50)
        self.log(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            self.log("❌ FAILED TESTS:")
            for failed in self.failed_tests:
                self.log(f"   - {failed.get('test', 'Unknown')}: {failed.get('error', failed.get('response', 'Unknown error'))}")
        
        return {
            "success": self.tests_passed == self.tests_run,
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.failed_tests
        }

if __name__ == "__main__":
    tester = ChatAndClearTester()
    results = tester.run_all_tests()
    
    if results["success"]:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n💥 {len(results['failed_tests'])} tests failed!")
        sys.exit(1)