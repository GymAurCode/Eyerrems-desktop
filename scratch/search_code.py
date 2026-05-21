import os
import re

frontend_dir = "d:/eyerrems-desktop-deployed/Eyerrems-desktop/frontend/src"
patterns = [
    r"isSuperAdmin",
    r"is_super_admin",
    r"companies",
    r"company_id",
    r"companyId"
]

results = {p: [] for p in patterns}

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for p in patterns:
                        if re.search(p, content):
                            results[p].append(os.path.relpath(path, frontend_dir))
            except Exception as e:
                pass

for pattern, files in results.items():
    print(f"Pattern: {pattern}")
    for file in files[:10]:
        print(f"  - {file}")
    if len(files) > 10:
        print(f"  - ... and {len(files) - 10} more files")
