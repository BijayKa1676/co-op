"""
RAG Service API Tests
=====================
Tests for the lazy-loading RAG service.
Note: This service returns context only, NOT LLM-generated answers.
"""

import requests
import uuid

API_URL = "http://localhost:8000"
API_KEY = ""  # Set if RAG_API_KEY is configured


def get_headers():
    """Get headers with optional API key."""
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


def test_health():
    """Test health endpoint."""
    print("Testing health endpoint...")
    response = requests.get(f"{API_URL}/health")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Health Check Passed")
        print(f"   Status: {data['status']}")
        print(f"   DB: {data['db']}")
        print(f"   Vector: {data['vector']}")
        print(f"   Storage: {data['storage']}")
        print(f"   Domains: {data['domains']}")
        print(f"   Sectors: {data['sectors']}")
    else:
        print("❌ Health Check Failed:", response.text)


def test_register_file():
    """Test file registration (lazy loading - no vectors created yet)."""
    print("\nTesting file registration...")
    
    file_id = str(uuid.uuid4())
    payload = {
        "file_id": file_id,
        "filename": "test_document.pdf",
        "storage_path": "documents/test_document.pdf",
        "domain": "legal",
        "sector": "saas",
        "content_type": "application/pdf"
    }
    
    response = requests.post(
        f"{API_URL}/rag/register",
        json=payload,
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Registration Success")
        print(f"   File ID: {data['file_id']}")
        print(f"   Message: {data['message']}")
        return file_id
    else:
        print("❌ Registration Failed:", response.text)
        return None


def test_query(domain="legal", sector="saas"):
    """Test RAG query (returns context, not answers)."""
    print(f"\nTesting query for {domain}/{sector}...")
    
    payload = {
        "query": "What are the key legal considerations for a SaaS startup?",
        "domain": domain,
        "sector": sector,
        "limit": 5
    }
    
    response = requests.post(
        f"{API_URL}/rag/query",
        json=payload,
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Query Success")
        print(f"   Domain: {data['domain']}")
        print(f"   Sector: {data['sector']}")
        print(f"   Vectors Loaded: {data['vectors_loaded']}")
        print(f"   Chunks Found: {data['chunks_found']}")
        
        if data.get('error'):
            print(f"   ⚠️ Error: {data['error']}")
        
        if data['context']:
            print(f"   Context Preview: {data['context'][:200]}...")
        else:
            print("   No context found (no documents indexed for this domain/sector)")
        
        if data['sources']:
            print("   Sources:")
            for source in data['sources']:
                print(f"     - {source['filename']} (score: {source['score']:.2f})")
    else:
        print("❌ Query Failed:", response.text)


def test_list_files():
    """Test listing files."""
    print("\nTesting file listing...")
    
    response = requests.get(
        f"{API_URL}/rag/files",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ List Files Success")
        print(f"   Total Files: {data['count']}")
        
        for f in data['files'][:5]:  # Show first 5
            print(f"   - {f['filename']} ({f['domain']}/{f['sector']}) - {f['vector_status']}")
    else:
        print("❌ List Files Failed:", response.text)


def test_cleanup(days=30):
    """Test cleanup of expired vectors."""
    print(f"\nTesting cleanup (files not accessed in {days} days)...")
    
    response = requests.post(
        f"{API_URL}/rag/cleanup?days={days}",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Cleanup Success")
        print(f"   Files Cleaned: {data['files_cleaned']}")
        print(f"   Vectors Removed: {data['vectors_removed']}")
        print(f"   Message: {data['message']}")
    else:
        print("❌ Cleanup Failed:", response.text)


if __name__ == "__main__":
    print("=" * 50)
    print("Co-Op RAG Service API Tests")
    print("=" * 50)
    
    # Run tests
    test_health()
    test_list_files()
    test_query("legal", "saas")
    test_query("finance", "fintech")
    
    # Uncomment to test registration (requires Supabase storage setup)
    # test_register_file()
    
    # Uncomment to test cleanup
    # test_cleanup(30)
    
    print("\n" + "=" * 50)
    print("Tests Complete")
    print("=" * 50)
