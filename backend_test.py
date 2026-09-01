import requests
import sys
import json
from datetime import datetime

class ArticleWriterAPITester:
    def __init__(self, base_url="https://rankmaster-12.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_article_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=120):
        """Run a single API test with extended timeout for AI generation"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    else:
                        print(f"   Response: Large data object")
                except:
                    print(f"   Response: Non-JSON content")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text[:200]}")

            return success, response.json() if success and response.content else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out after {timeout} seconds")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test(
            "API Root",
            "GET",
            "",
            200
        )

    def test_generate_article(self):
        """Test article generation with Claude Sonnet 4"""
        test_data = {
            "topic": "Benefits of Renewable Energy for Small Businesses",
            "keywords": "solar power, wind energy, cost savings, sustainability",
            "tone": "professional"
        }
        
        print("⏳ Generating article with Claude Sonnet 4 (this may take 30-60 seconds)...")
        success, response = self.run_test(
            "Generate Article",
            "POST",
            "articles/generate",
            200,
            data=test_data,
            timeout=120  # Extended timeout for AI generation
        )
        
        if success and 'article_id' in response:
            self.created_article_id = response['article_id']
            print(f"   Generated article ID: {self.created_article_id}")
            return True
        return False

    def test_get_articles(self):
        """Test getting all articles"""
        success, response = self.run_test(
            "Get All Articles",
            "GET",
            "articles",
            200
        )
        
        if success:
            print(f"   Found {len(response)} articles")
        return success

    def test_get_single_article(self):
        """Test getting a single article"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        success, response = self.run_test(
            "Get Single Article",
            "GET",
            f"articles/{self.created_article_id}",
            200
        )
        
        if success:
            required_fields = ['id', 'title', 'content', 'meta_title', 'meta_description', 'url_slug']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ⚠️  Missing fields: {missing_fields}")
            else:
                print(f"   ✅ All required fields present")
                print(f"   Title: {response.get('title', 'N/A')[:50]}...")
        return success

    def test_update_article(self):
        """Test updating an article"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        update_data = {
            "title": "Updated: Benefits of Renewable Energy for Small Businesses",
            "meta_title": "Updated Meta Title for SEO",
            "meta_description": "Updated meta description for better SEO optimization"
        }
        
        success, response = self.run_test(
            "Update Article",
            "PUT",
            f"articles/{self.created_article_id}",
            200,
            data=update_data
        )
        
        if success and response.get('title') == update_data['title']:
            print(f"   ✅ Article updated successfully")
        return success

    def test_export_markdown(self):
        """Test exporting article as markdown"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        success, response = self.run_test(
            "Export Article (Markdown)",
            "GET",
            f"articles/{self.created_article_id}/export/markdown",
            200
        )
        
        if success:
            expected_fields = ['format', 'content', 'filename']
            if all(field in response for field in expected_fields):
                print(f"   ✅ Export format: {response.get('format')}")
                print(f"   ✅ Filename: {response.get('filename')}")
                print(f"   ✅ Content length: {len(response.get('content', ''))} characters")
            else:
                print(f"   ⚠️  Missing export fields")
        return success

    def test_export_html(self):
        """Test exporting article as HTML"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        success, response = self.run_test(
            "Export Article (HTML)",
            "GET",
            f"articles/{self.created_article_id}/export/html",
            200
        )
        
        if success:
            content = response.get('content', '')
            if '<!DOCTYPE html>' in content and '<meta name="description"' in content:
                print(f"   ✅ Valid HTML with SEO meta tags")
            else:
                print(f"   ⚠️  HTML may be missing required elements")
        return success

    def test_delete_article(self):
        """Test deleting an article"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        success, response = self.run_test(
            "Delete Article",
            "DELETE",
            f"articles/{self.created_article_id}",
            200
        )
        
        if success:
            print(f"   ✅ Article deleted successfully")
        return success

    def test_get_deleted_article(self):
        """Test that deleted article returns 404"""
        if not self.created_article_id:
            print("❌ Skipping - No article ID available")
            return False
            
        success, response = self.run_test(
            "Get Deleted Article (should fail)",
            "GET",
            f"articles/{self.created_article_id}",
            404
        )
        
        if success:
            print(f"   ✅ Correctly returns 404 for deleted article")
        return success

def main():
    print("🚀 Starting AI-Powered Article Writer API Tests")
    print("=" * 60)
    
    tester = ArticleWriterAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_generate_article,  # This creates an article for subsequent tests
        tester.test_get_articles,
        tester.test_get_single_article,
        tester.test_update_article,
        tester.test_export_markdown,
        tester.test_export_html,
        tester.test_delete_article,
        tester.test_get_deleted_article
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())