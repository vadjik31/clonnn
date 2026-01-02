#!/usr/bin/env python3
"""
Test script for Notifications Page functionality
"""

import requests
import sys
import json
from datetime import datetime

class NotificationsPageTester:
    def __init__(self, base_url: str = "https://brandsync-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.searcher_token = None

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data=None, token=None) -> tuple[bool, dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

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
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"   Response: {response.text[:200]}", "FAIL")
                try:
                    return False, response.json()
                except:
                    return False, {"error": response.text}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def login_users(self):
        """Login admin and searcher users"""
        self.log("=== LOGGING IN USERS ===")
        
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
        
        if not success or 'token' not in response:
            self.log("❌ Failed to login admin")
            return False
        
        self.admin_token = response['token']
        self.log(f"✅ Admin logged in")
        
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
        
        if not success or 'token' not in response:
            self.log("❌ Failed to login searcher")
            return False
        
        self.searcher_token = response['token']
        self.log(f"✅ Searcher logged in")
        
        return True

    def test_notifications_page(self):
        """Test the notifications page functionality"""
        self.log("=== TESTING NOTIFICATIONS PAGE ===")
        
        # Test 1: Searcher can access /notifications page
        success, response = self.run_test(
            "Searcher Access Notifications",
            "GET",
            "notifications",
            200,
            token=self.searcher_token
        )
        
        if not success:
            return False
        
        # Verify response structure
        if 'notifications' not in response or 'unread_count' not in response:
            self.log("❌ Invalid notifications response structure")
            return False
        
        searcher_notifications = response.get('notifications', [])
        searcher_unread_count = response.get('unread_count', 0)
        self.log(f"✅ Searcher can access notifications page - {len(searcher_notifications)} notifications, {searcher_unread_count} unread")
        
        # Test 2: Admin can access /notifications page
        success, response = self.run_test(
            "Admin Access Notifications",
            "GET",
            "notifications",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        admin_notifications = response.get('notifications', [])
        admin_unread_count = response.get('unread_count', 0)
        self.log(f"✅ Admin can access notifications page - {len(admin_notifications)} notifications, {admin_unread_count} unread")
        
        # Test 3: Notifications display with correct filtering - unread only
        success, response = self.run_test(
            "Notifications Unread Filter",
            "GET",
            "notifications?unread_only=true",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        unread_notifications = response.get('notifications', [])
        # Verify all returned notifications are unread
        for notif in unread_notifications:
            if notif.get('is_read'):
                self.log("❌ Unread filter returned read notification")
                return False
        
        self.log(f"✅ Unread filter working correctly - {len(unread_notifications)} unread notifications")
        
        # Test 4: Notifications display with limit filter
        success, response = self.run_test(
            "Notifications Limit Filter",
            "GET",
            "notifications?limit=5",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        limited_notifications = response.get('notifications', [])
        if len(limited_notifications) > 5:
            self.log(f"❌ Limit filter not working - got {len(limited_notifications)} notifications")
            return False
        
        self.log(f"✅ Limit filter working correctly - {len(limited_notifications)} notifications returned")
        
        # Test 5: Mark as read action works (if there are notifications)
        if admin_notifications:
            notification_id = admin_notifications[0]['id']
            
            success, response = self.run_test(
                "Mark Notification as Read",
                "POST",
                f"notifications/{notification_id}/read",
                200,
                token=self.admin_token
            )
            
            if not success:
                return False
            
            self.log("✅ Mark as read action working")
            
            # Test 6: Mark all as read action works
            success, response = self.run_test(
                "Mark All Notifications as Read",
                "POST",
                "notifications/read-all",
                200,
                token=self.admin_token
            )
            
            if not success:
                return False
            
            if 'updated_count' not in response:
                self.log("❌ Mark all read response missing updated_count")
                return False
            
            self.log(f"✅ Mark all as read action working - {response['updated_count']} notifications marked")
            
            # Test 7: Delete action works
            success, response = self.run_test(
                "Delete Notification",
                "DELETE",
                f"notifications/{notification_id}",
                200,
                token=self.admin_token
            )
            
            if not success:
                return False
            
            self.log("✅ Delete action working")
        else:
            self.log("ℹ️ No notifications available to test mark as read/delete actions")
        
        return True

    def run_all_tests(self):
        """Run all notifications page tests"""
        self.log("🚀 Starting Notifications Page Testing")
        
        if not self.login_users():
            return False
        
        if not self.test_notifications_page():
            return False
        
        self.log("✅ All Notifications Page tests passed!")
        return True

def main():
    """Main test execution"""
    tester = NotificationsPageTester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())