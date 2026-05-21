import os
import re

FRONTEND_DIR = r"d:\eyerrems-desktop-deployed\Eyerrems-desktop\frontend\src"

def search_files():
    print("🔍 Scanning frontend files for residual super-admin or company selection references...")
    patterns = {
        "companies_route": re.compile(r"['\"]/companies['\"]"),
        "is_super_admin": re.compile(r"is_super_admin"),
        "isSuperAdmin": re.compile(r"isSuperAdmin"),
    }
    
    found_matches = False
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if not file.endswith((".tsx", ".ts", ".js", ".jsx")):
                continue
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                for key, pattern in patterns.items():
                    matches = pattern.findall(content)
                    if matches:
                        # Exclude store/auth.ts since isSuperAdmin: false is allowed
                        if "store\\auth.ts" in path or "store/auth.ts" in path:
                            if key == "isSuperAdmin" and len(matches) <= 10:
                                continue
                        # Exclude App.tsx isSuperAdmin references if any, but let's check
                        print(f"📍 Found {len(matches)} matches of {key} in: {os.path.relpath(path, FRONTEND_DIR)}")
                        found_matches = True
            except Exception as e:
                print(f"⚠️ Error reading {file}: {e}")
                
    if not found_matches:
        print("✅ Clean! No residual references found in frontend.")

if __name__ == "__main__":
    search_files()
